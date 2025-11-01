import * as core from '@actions/core'
import * as github from '@actions/github'
import {annotateTestResult, attachComment, attachSummary, CheckInfo} from './annotator.js'
import {parseTestReports, TestResult} from './testParser.js'
import {buildTable, readTransformers, retrieve} from './utils.js'
import {GitHub} from '@actions/github/lib/utils.js'
import {buildSummaryTables} from './table.js'

export async function run(): Promise<void> {
  try {
    core.startGroup(`📘 Reading input values`)

    const token = core.getInput('token') || core.getInput('github_token') || process.env.GITHUB_TOKEN
    if (!token) {
      core.setFailed('❌ A token is required to execute this action')
      return
    }

    const groupReports = core.getInput('group_reports') === 'true'
    const annotateOnly = core.getInput('annotate_only') === 'true'
    const updateCheck = core.getInput('update_check') === 'true'
    const checkAnnotations = core.getInput('check_annotations') === 'true'
    const commit = core.getInput('commit')
    const failOnFailure = core.getInput('fail_on_failure') === 'true'
    const failOnParseError = core.getInput('fail_on_parse_error') === 'true'
    const requireTests = core.getInput('require_tests') === 'true'
    const requirePassedTests = core.getInput('require_passed_tests') === 'true'
    const includePassed = core.getInput('include_passed') === 'true'
    const includeSkipped = core.getInput('include_skipped') === 'true'
    const checkRetries = core.getInput('check_retries') === 'true'
    const annotateNotice = core.getInput('annotate_notice') === 'true'
    const jobSummary = core.getInput('job_summary') === 'true'
    const jobSummaryText = core.getInput('job_summary_text')
    const detailedSummary = core.getInput('detailed_summary') === 'true'
    const flakySummary = core.getInput('flaky_summary') === 'true'
    const verboseSummary = core.getInput('verbose_summary') === 'true'
    const skipSuccessSummary = core.getInput('skip_success_summary') === 'true'
    const includeEmptyInSummary = core.getInput('include_empty_in_summary') === 'true'
    const includeTimeInSummary = core.getInput('include_time_in_summary') === 'true'
    const simplifiedSummary = core.getInput('simplified_summary') === 'true'
    const groupSuite = core.getInput('group_suite') === 'true'
    const comment = core.getInput('comment') === 'true'
    const updateComment = core.getInput('updateComment') === 'true'
    const jobName = core.getInput('job_name')
    const skipCommentWithoutTests = core.getInput('skip_comment_without_tests') === 'true'
    const prId = core.getInput('pr_id').trim() || undefined

    const reportPaths = core.getMultilineInput('report_paths')
    const summary = core.getMultilineInput('summary')
    const checkName = core.getMultilineInput('check_name')
    const testFilesPrefix = core.getMultilineInput('test_files_prefix')
    const suiteRegex = core.getMultilineInput('suite_regex')
    let excludeSources = core.getMultilineInput('exclude_sources') ? core.getMultilineInput('exclude_sources') : []
    const checkTitleTemplate = core.getMultilineInput('check_title_template')
    const breadCrumbDelimiter = core.getInput('bread_crumb_delimiter')
    const transformers = readTransformers(core.getInput('transformers', {trimWhitespace: true}))
    const followSymlink = core.getBooleanInput('follow_symlink')
    const annotationsLimit = Number(core.getInput('annotations_limit') || -1)
    const skipAnnotations = core.getInput('skip_annotations') === 'true'
    const truncateStackTraces = core.getBooleanInput('truncate_stack_traces')
    const resolveIgnoreClassname = core.getBooleanInput('resolve_ignore_classname')

    if (excludeSources.length === 0) {
      excludeSources = ['/build/', '/__pycache__/']
    }

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
      retried: 0,
      time: 0,
      foundFiles: 0,
      globalAnnotations: [],
      testResults: []
    }

    core.info(`Preparing ${reportsCount} report as configured.`)

    for (let i = 0; i < reportsCount; i++) {
      const testResult = await parseTestReports(
        retrieve('checkName', checkName, i, reportsCount),
        retrieve('summary', summary, i, reportsCount),
        retrieve('reportPaths', reportPaths, i, reportsCount),
        retrieve('suiteRegex', suiteRegex, i, reportsCount),
        includePassed,
        annotateNotice,
        checkRetries,
        excludeSources,
        retrieve('checkTitleTemplate', checkTitleTemplate, i, reportsCount),
        breadCrumbDelimiter,
        retrieve('testFilesPrefix', testFilesPrefix, i, reportsCount),
        transformers,
        followSymlink,
        annotationsLimit,
        truncateStackTraces,
        failOnParseError,
        resolveIgnoreClassname
      )
      mergedResult.totalCount += testResult.totalCount
      mergedResult.skipped += testResult.skipped
      mergedResult.failed += testResult.failed
      mergedResult.passed += testResult.passed
      mergedResult.retried += testResult.retried
      mergedResult.time += testResult.time

      if (groupReports) {
        testResults.push(testResult)
      } else {
        for (const actualTestResult of testResult.testResults) {
          testResults.push({
            checkName: `${testResult.checkName} | ${actualTestResult.name}`,
            summary: testResult.summary,
            totalCount: actualTestResult.totalCount,
            skipped: actualTestResult.skippedCount,
            failed: actualTestResult.failedCount,
            passed: actualTestResult.passedCount,
            retried: actualTestResult.retriedCount,
            time: actualTestResult.time,
            foundFiles: 1,
            globalAnnotations: actualTestResult.annotations,
            testResults: actualTestResult.testResults
          })
        }
      }
    }

    core.setOutput('total', mergedResult.totalCount)
    core.setOutput('passed', mergedResult.passed)
    core.setOutput('skipped', mergedResult.skipped)
    core.setOutput('failed', mergedResult.failed)
    core.setOutput('retried', mergedResult.retried)
    core.setOutput('time', mergedResult.time)

    if (!(mergedResult.totalCount > 0 || mergedResult.skipped > 0) && requireTests) {
      core.setFailed(`❌ No test results found for ${checkName}`)
      return // end if we failed due to no tests, but configured to require tests
    } else if (!(mergedResult.passed > 0) && requirePassedTests) {
      core.setFailed(`❌ No passed test results found for ${checkName}`)
      return // end if we failed due to no passed tests, but configured to require passed tests
    }

    const pullRequest = github.context.payload.pull_request
    const link = (pullRequest && pullRequest.html_url) || github.context.ref
    const conclusion: 'success' | 'failure' = mergedResult.failed <= 0 ? 'success' : 'failure'
    const headSha = commit || (pullRequest && pullRequest.head.sha) || github.context.sha
    core.info(`ℹ️ Posting with conclusion '${conclusion}' to ${link} (sha: ${headSha})`)

    core.endGroup()
    core.startGroup(`🚀 Publish results`)

    const checkInfos: CheckInfo[] = []
    if (!skipAnnotations) {
      try {
        for (const testResult of testResults) {
          const checkInfo = await annotateTestResult(
            testResult,
            token,
            headSha,
            checkAnnotations,
            annotateOnly,
            updateCheck,
            annotateNotice,
            jobName
          )
          if (checkInfo) {
            checkInfos.push(checkInfo)
          }
        }
      } catch (error) {
        core.error(`❌ Failed to create checks using the provided token. (${error})`)
        core.warning(
          `⚠️ This usually indicates insufficient permissions. More details: https://github.com/mikepenz/action-junit-report/issues/23`
        )
      }
    }

    const supportsJobSummary = process.env['GITHUB_STEP_SUMMARY']
    const [table, detailTable, flakyTable] = buildSummaryTables(
      testResults,
      includePassed,
      includeSkipped,
      detailedSummary,
      flakySummary,
      verboseSummary,
      skipSuccessSummary,
      groupSuite,
      includeEmptyInSummary,
      includeTimeInSummary,
      simplifiedSummary
    )
    if (jobSummary && supportsJobSummary) {
      try {
        await attachSummary(table, detailTable, flakyTable, checkInfos, jobSummaryText)
      } catch (error) {
        core.error(`❌ Failed to set the summary using the provided token. (${error})`)
      }
    } else if (jobSummary && !supportsJobSummary) {
      core.warning(`⚠️ Your environment seems to not support job summaries.`)
    } else {
      core.info('⏩ Skipped creation of job summary')
    }

    if (comment && (!skipCommentWithoutTests || mergedResult.totalCount > 0)) {
      const octokit: InstanceType<typeof GitHub> = github.getOctokit(token)
      await attachComment(octokit, checkName, updateComment, table, detailTable, flakyTable, checkInfos, prId)
    }

    core.setOutput('summary', buildTable(table))
    core.setOutput('detailed_summary', buildTable(detailTable))
    core.setOutput('flaky_summary', buildTable(flakyTable))

    // Set report URLs as output (newline-separated for multiple reports)
    const reportUrls = checkInfos.map(info => info.url).join('\n')
    core.setOutput('report_url', reportUrls)

    if (failOnFailure && conclusion === 'failure') {
      core.setFailed(`❌ Tests reported ${mergedResult.failed} failures`)
    }

    core.endGroup()
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    core.setFailed(error.message)
  }
}

run()
