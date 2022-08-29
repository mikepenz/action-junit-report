import * as core from '@actions/core'
import * as github from '@actions/github'
import {annotateTestResult, attachSummary} from './annotator'
import {parseTestReports, TestResult} from './testParser'
import {readTransformers, retrieve} from './utils'

export async function run(): Promise<void> {
  try {
    core.startGroup(`📘 Reading input values`)

    const token = core.getInput('token') || core.getInput('github_token') || process.env.GITHUB_TOKEN
    if (!token) {
      core.setFailed('❌ A token is required to execute this action')
      return
    }

    const annotateOnly = core.getInput('annotate_only') === 'true'
    const updateCheck = core.getInput('update_check') === 'true'
    const commit = core.getInput('commit')
    const failOnFailure = core.getInput('fail_on_failure') === 'true'
    const requireTests = core.getInput('require_tests') === 'true'
    const includePassed = core.getInput('include_passed') === 'true'
    const checkRetries = core.getInput('check_retries') === 'true'
    const annotateNotice = core.getInput('annotate_notice') === 'true'
    const jobSummary = core.getInput('job_summary') === 'true'
    const detailedSummary = core.getInput('detailed_summary') === 'true'

    const reportPaths = core.getMultilineInput('report_paths')
    const summary = core.getMultilineInput('summary')
    const checkName = core.getMultilineInput('check_name')
    const testFilesPrefix = core.getMultilineInput('test_files_prefix')
    const suiteRegex = core.getMultilineInput('suite_regex')
    const excludeSources = core.getMultilineInput('exclude_sources') ? core.getMultilineInput('exclude_sources') : []
    const checkTitleTemplate = core.getMultilineInput('check_title_template')
    const transformers = readTransformers(core.getInput('transformers', {trimWhitespace: true}))

    core.endGroup()
    core.startGroup(`📦 Process test results`)

    const reportsCount = reportPaths.length

    const testResults: TestResult[] = []
    const mergedResult: TestResult = {
      checkName: '',
      summary: '',
      totalCount: 0,
      skipped: 0,
      failed: 0,
      passed: 0,
      annotations: []
    }

    core.info(`Retrieved ${reportsCount} reports to process.`)

    for (let i = 0; i < reportsCount; i++) {
      const testResult = await parseTestReports(
        retrieve('checkName', checkName, i, reportsCount),
        retrieve('summary', summary, i, reportsCount),
        retrieve('reportPaths', reportPaths, i, reportsCount),
        retrieve('suiteRegex', suiteRegex, i, reportsCount),
        includePassed && annotateNotice,
        checkRetries,
        excludeSources,
        retrieve('checkTitleTemplate', checkTitleTemplate, i, reportsCount),
        retrieve('testFilesPrefix', testFilesPrefix, i, reportsCount),
        transformers
      )

      mergedResult.totalCount += testResult.totalCount
      mergedResult.skipped += testResult.skipped
      mergedResult.failed += testResult.failed
      mergedResult.passed += testResult.passed

      const foundResults = testResult.totalCount > 0 || testResult.skipped > 0
      if (!foundResults) {
        if (requireTests) {
          core.setFailed(`❌ No test results found for ${checkName}`)
        }
        return
      }

      testResults.push(testResult)
    }

    core.setOutput('total', mergedResult.totalCount)
    core.setOutput('passed', mergedResult.passed)
    core.setOutput('skipped', mergedResult.skipped)
    core.setOutput('failed', mergedResult.failed)

    const pullRequest = github.context.payload.pull_request
    const link = (pullRequest && pullRequest.html_url) || github.context.ref
    const conclusion: 'success' | 'failure' =
      mergedResult.totalCount > 0 && mergedResult.failed <= 0 ? 'success' : 'failure'
    const headSha = commit || (pullRequest && pullRequest.head.sha) || github.context.sha
    core.info(`ℹ️ Posting with conclusion '${conclusion}' to ${link} (sha: ${headSha})`)

    core.endGroup()
    core.startGroup(`🚀 Publish results`)

    try {
      for (const testResult of testResults) {
        await annotateTestResult(testResult, token, headSha, annotateOnly, updateCheck, annotateNotice)
      }
    } catch (error) {
      core.error(`❌ Failed to create checks using the provided token. (${error})`)
      core.warning(
        `⚠️ This usually indicates insufficient permissions. More details: https://github.com/mikepenz/action-junit-report/issues/23`
      )
    }

    const supportsJobSummary = process.env['GITHUB_STEP_SUMMARY']
    if (jobSummary && supportsJobSummary) {
      try {
        await attachSummary(testResults, detailedSummary, includePassed)
      } catch (error) {
        core.error(`❌ Failed to set the summary using the provided token. (${error})`)
      }
    } else if (jobSummary && !supportsJobSummary) {
      core.warning(`⚠️ Your environment seems to not support job summaries.`)
    } else {
      core.info('⏩ Skipped creation of job summary')
    }

    if (failOnFailure && conclusion === 'failure') {
      core.setFailed(`❌ Tests reported ${mergedResult.failed} failures`)
    }

    core.endGroup()
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    core.setFailed(error.message)
  }
}

run()
