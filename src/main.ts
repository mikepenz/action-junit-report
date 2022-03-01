import * as core from '@actions/core'
import * as github from '@actions/github'
import {parseTestReports} from './testParser'

export async function run(): Promise<void> {
  try {
    core.startGroup(`📘 Reading input values`)

    const summary = core.getInput('summary')
    const checkTitleTemplate = core.getInput('check_title_template')
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

    const updateCheck = core.getInput('update_check') === 'true'
    const checkName = core.getInput('check_name')
    const commit = core.getInput('commit')
    const failOnFailure = core.getInput('fail_on_failure') === 'true'
    const requireTests = core.getInput('require_tests') === 'true'
    const includePassed = core.getInput('include_passed') === 'true'
    const excludeSources = core.getInput('exclude_sources')
      ? core.getInput('exclude_sources').split(',')
      : []
    const checkRetries = core.getInput('check_retries') === 'true'

    core.endGroup()
    core.startGroup(`📦 Process test results`)

    const testResult = await parseTestReports(
      reportPaths,
      suiteRegex,
      includePassed,
      checkRetries,
      excludeSources,
      checkTitleTemplate
    )
    const foundResults = testResult.count > 0 || testResult.skipped > 0

    // get the count of passed and failed tests.
    const passed = testResult.annotations.filter(
      a => a.annotation_level === 'notice'
    ).length
    const failed = testResult.annotations.length - passed

    core.setOutput('passed', passed)
    core.setOutput('failed', failed)

    let title = 'No test results found!'
    if (foundResults) {
      if (includePassed) {
        title = `${testResult.count} tests run, ${passed} passed, ${testResult.skipped} skipped, ${failed} failed.`
      } else {
        title = `${testResult.count} tests run, ${testResult.skipped} skipped, ${failed} failed.`
      }
    }

    core.info(`ℹ️ ${title}`)

    if (!foundResults) {
      if (requireTests) {
        core.setFailed('❌ No test results found')
        return
      }
     core.info(`ℹ️ No tests found, but test results no rquired`)
    }

    const pullRequest = github.context.payload.pull_request
    const link = (pullRequest && pullRequest.html_url) || github.context.ref
    const conclusion: 'success' | 'failure' =
      testResult.annotations.length === 0
        ? 'success'
        : 'failure'
    const status: 'completed' = 'completed'
    const head_sha =
      commit || (pullRequest && pullRequest.head.sha) || github.context.sha
    core.info(
      `ℹ️ Posting with conclusion '${conclusion}' to ${link} (sha: ${head_sha})`
    )

    core.endGroup()

    core.startGroup(`🚀 Publish results`)

    try {
      const octokit = github.getOctokit(token)

      if (updateCheck) {
        const checks = await octokit.rest.checks.listForRef({
          ...github.context.repo,
          ref: head_sha,
          check_name: github.context.job,
          status: 'in_progress',
          filter: 'latest'
        })

        core.debug(JSON.stringify(checks, null, 2))

        const check_run_id = checks.data.check_runs[0].id

        core.info(`ℹ️ Updating checks ${testResult.annotations.length}`)
        for (let i = 0; i < testResult.annotations.length; i = i + 50) {
          const sliced = testResult.annotations.slice(i, i + 50)

          const updateCheckRequest = {
            ...github.context.repo,
            check_run_id,
            output: {
              title,
              summary,
              annotations: sliced
            }
          }

          core.debug(JSON.stringify(updateCheckRequest, null, 2))

          await octokit.rest.checks.update(updateCheckRequest)
        }
      } else {
        const createCheckRequest = {
          ...github.context.repo,
          name: checkName,
          head_sha,
          status: 'completed',
          conclusion,
          output: {
            title,
            summary,
            annotations: testResult.annotations.slice(0, 50)
          }
        }

        core.debug(JSON.stringify(createCheckRequest, null, 2))

        core.info(`ℹ️ Creating check`)
        await octokit.rest.checks.create(createCheckRequest)
      }

      if (failOnFailure && conclusion === 'failure') {
        core.setFailed(`❌ Tests reported ${failed} failures`)
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
