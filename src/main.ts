import * as core from '@actions/core'
import * as github from '@actions/github'
import {Octokit} from '@octokit/rest'
import {parseTestReports} from './testParser'

export async function run(): Promise<void> {
  try {
    core.startGroup(`📘 Reading input values`)

    const reportPaths = core.getInput('report_paths')
    const token = core.getInput('token') || process.env.GITHUB_TOKEN

    const checkName = core.getInput('check_name')
    const commit = core.getInput('commit')

    core.endGroup()
    core.startGroup(`📘 Process test results`)

    const testResult = await parseTestReports(reportPaths)
    const foundResults = testResult.count > 0 || testResult.skipped > 0
    const title = foundResults
      ? `${testResult.count} tests run, ${testResult.skipped} skipped, ${testResult.annotations.length} failed.`
      : 'No test results found!'
    core.info(`Result: ${title}`)

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
      `Posting status '${status}' with conclusion '${conclusion}' to ${link} (sha: ${head_sha})`
    )

    const createCheckRequest = {
      ...github.context.repo,
      name: checkName,
      head_sha,
      status,
      conclusion,
      output: {
        title,
        summary: '',
        annotations: testResult.annotations.slice(0, 50)
      }
    }

    core.debug(JSON.stringify(createCheckRequest, null, 2))
    core.endGroup()

    core.startGroup(`📘 Publish results`)

    try {
      const octokit = new Octokit({
        auth: token
      })
      await octokit.checks.create(createCheckRequest)
    } catch (error) {
      core.error(`Failed to create checks using the provided token. (${error})`)
      core.warning(
        `This usually indicates insufficient permissions. More details: https://github.com/mikepenz/action-junit-report/issues/32`
      )
    }

    core.endGroup()
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
