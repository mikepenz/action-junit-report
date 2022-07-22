import * as core from '@actions/core'
import * as github from '@actions/github'
import {annotateTestResult, attachSummary} from './annotator'
import {parseTestReports} from './testParser'

export async function run(): Promise<void> {
  try {
    core.startGroup(`📘 Reading input values`)

    const summary = core.getInput('summary')
    const checkTitleTemplate = core.getInput('check_title_template')
    const reportPaths = core.getInput('report_paths')
    const testFilesPrefix = core.getInput('test_files_prefix')
    const suiteRegex = core.getInput('suite_regex')
    const token = core.getInput('token') || core.getInput('github_token') || process.env.GITHUB_TOKEN

    if (!token) {
      core.setFailed('❌ A token is required to execute this action')
      return
    }

    const annotateOnly = core.getInput('annotate_only') === 'true'
    const updateCheck = core.getInput('update_check') === 'true'
    const checkName = core.getInput('check_name')
    const commit = core.getInput('commit')
    const failOnFailure = core.getInput('fail_on_failure') === 'true'
    const requireTests = core.getInput('require_tests') === 'true'
    const includePassed = core.getInput('include_passed') === 'true'
    const excludeSources = core.getInput('exclude_sources') ? core.getInput('exclude_sources').split(',') : []
    const checkRetries = core.getInput('check_retries') === 'true'

    core.endGroup()
    core.startGroup(`📦 Process test results`)

    const testResult = await parseTestReports(
      reportPaths,
      suiteRegex,
      includePassed,
      checkRetries,
      excludeSources,
      checkTitleTemplate,
      testFilesPrefix
    )

    core.setOutput('total', testResult.totalCount)
    core.setOutput('passed', testResult.passed)
    core.setOutput('skipped', testResult.skipped)
    core.setOutput('failed', testResult.failed)

    const foundResults = testResult.totalCount > 0 || testResult.skipped > 0
    if (!foundResults) {
      if (requireTests) {
        core.setFailed(`❌ No test results found for ${checkName}`)
      }
      return
    }

    const pullRequest = github.context.payload.pull_request
    const link = (pullRequest && pullRequest.html_url) || github.context.ref
    const conclusion: 'success' | 'failure' = foundResults && testResult.failed <= 0 ? 'success' : 'failure'
    const headSha = commit || (pullRequest && pullRequest.head.sha) || github.context.sha
    core.info(`ℹ️ Posting with conclusion '${conclusion}' to ${link} (sha: ${headSha})`)

    core.endGroup()
    core.startGroup(`🚀 Publish results`)

    try {
      annotateTestResult(testResult, token, checkName, summary, headSha, annotateOnly, updateCheck)
    } catch (error) {
      core.error(`❌ Failed to create checks using the provided token. (${error})`)
      core.warning(
        `⚠️ This usually indicates insufficient permissions. More details: https://github.com/mikepenz/action-junit-report/issues/23`
      )
    }

    try {
      attachSummary([testResult], checkName)
    } catch (error) {
      core.error(`❌ Failed to set the summary using the provided token. (${error})`)
    }

    if (failOnFailure && conclusion === 'failure') {
      core.setFailed(`❌ Tests reported ${testResult.failed} failures`)
    }

    core.endGroup()
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    core.setFailed(error.message)
  }
}

run()
