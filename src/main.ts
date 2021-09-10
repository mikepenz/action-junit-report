import * as core from '@actions/core'
import * as github from '@actions/github'
import {parseTestReports} from './testParser'

export async function run(): Promise<void> {
  try {
    core.startGroup(`📘 Reading input values`)

    const summary = core.getInput('summary')
    const reportPaths = core.getInput('report_paths')
    const suiteRegex = core.getInput('suite_regex')
    const token =
      core.getInput('token') ||
      core.getInput('github_token') ||
      process.env.GITHUB_TOKEN

    if (!token) {
      core.setFailed('❌ A token is required to execute this action')
      return
    }

    const checkName = core.getInput('check_name')
    const commit = core.getInput('commit')
    const failOnFailure = core.getInput('fail_on_failure') === 'true'
    const requireTests = core.getInput('require_tests') === 'true'

    core.endGroup()
    core.startGroup(`📦 Process test results`)

    const testResult = await parseTestReports(reportPaths, suiteRegex)
    const foundResults = testResult.count > 0 || testResult.skipped > 0
    const title = foundResults
      ? `${testResult.count} tests run, ${testResult.skipped} skipped, ${testResult.annotations.length} failed.`
      : 'No test results found!'
    core.info(`ℹ️ ${title}`)

    if (!foundResults) {
      if (requireTests) {
        core.setFailed('❌ No test results found')
      }
      return
    }

    const pullRequest = github.context.payload.pull_request
    const link = (pullRequest && pullRequest.html_url) || github.context.ref
    const conclusion: 'success' | 'failure' =
      foundResults && testResult.annotations.length === 0
        ? 'success'
        : 'failure'
    const status: 'completed' = 'completed'
    const head_sha =
      commit || (pullRequest && pullRequest.head.sha) || github.context.sha
    core.info(
      `ℹ️ Posting status '${status}' with conclusion '${conclusion}' to ${link} (sha: ${head_sha})`
    )

    const createCheckRequest = {
      ...github.context.repo,
      name: checkName,
      head_sha,
      status,
      conclusion,
      output: {
        title,
        summary,
        annotations: testResult.annotations.slice(0, 50)
      }
    }

    core.debug(JSON.stringify(createCheckRequest, null, 2))
    core.endGroup()

    core.startGroup(`🚀 Publish results`)

    try {
      const octokit = github.getOctokit(token)
      await octokit.rest.checks.create(createCheckRequest)

      if (failOnFailure && conclusion === 'failure') {
        core.setFailed(
          `❌ Tests reported ${testResult.annotations.length} failures`
        )
      }
    } catch (error) {
      core.error(
        `❌ Failed to create checks using the provided token. (${error})`
      )
      core.warning(
        `⚠️ This usually indicates insufficient permissions. More details: https://github.com/mikepenz/action-junit-report/issues/23`
      )
    }

    core.endGroup()
  } catch (error: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
    core.setFailed(error.message)
  }
}

run()
