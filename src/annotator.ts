import * as core from '@actions/core'
import {TestResult} from './testParser'
import * as github from '@actions/github'
import {SummaryTableRow} from '@actions/core/lib/summary'

export async function annotateTestResult(
  testResult: TestResult,
  token: string,
  headSha: string,
  annotateOnly: boolean,
  updateCheck: boolean
): Promise<void> {
  const foundResults = testResult.totalCount > 0 || testResult.skipped > 0

  let title = 'No test results found!'
  if (foundResults) {
    title = `${testResult.totalCount} tests run, ${testResult.passed} passed, ${testResult.skipped} skipped, ${testResult.failed} failed.`
  }

  core.info(`ℹ️ - ${testResult.checkName} - ${title}`)

  const conclusion: 'success' | 'failure' = foundResults && testResult.failed <= 0 ? 'success' : 'failure'

  const octokit = github.getOctokit(token)
  if (annotateOnly) {
    for (const annotation of testResult.annotations) {
      const properties: core.AnnotationProperties = {
        title: annotation.title,
        file: annotation.path,
        startLine: annotation.start_line,
        endLine: annotation.end_line,
        startColumn: annotation.start_column,
        endColumn: annotation.end_column
      }
      if (annotation.annotation_level === 'failure') {
        core.error(annotation.message, properties)
      } else if (annotation.annotation_level === 'warning') {
        core.warning(annotation.message, properties)
      } else {
        core.notice(annotation.message, properties)
      }
    }
  } else {
    if (updateCheck) {
      const checks = await octokit.rest.checks.listForRef({
        ...github.context.repo,
        ref: headSha,
        check_name: github.context.job,
        status: 'in_progress',
        filter: 'latest'
      })

      core.debug(JSON.stringify(checks, null, 2))

      const check_run_id = checks.data.check_runs[0].id

      core.info(`ℹ️ - ${testResult.checkName} - Updating checks ${testResult.annotations.length}`)
      for (let i = 0; i < testResult.annotations.length; i = i + 50) {
        const sliced = testResult.annotations.slice(i, i + 50)

        const updateCheckRequest = {
          ...github.context.repo,
          check_run_id,
          output: {
            title,
            summary: testResult.summary,
            annotations: sliced
          }
        }

        core.debug(JSON.stringify(updateCheckRequest, null, 2))

        await octokit.rest.checks.update(updateCheckRequest)
      }
    } else {
      const createCheckRequest = {
        ...github.context.repo,
        name: testResult.checkName,
        head_sha: headSha,
        status: 'completed',
        conclusion,
        output: {
          title,
          summary: testResult.summary,
          annotations: testResult.annotations.slice(0, 50)
        }
      }

      core.debug(JSON.stringify(createCheckRequest, null, 2))

      core.info(`ℹ️ - ${testResult.checkName} - Creating check for`)
      await octokit.rest.checks.create(createCheckRequest)
    }
  }
}

export async function attachSummary(testResults: TestResult[]): Promise<void> {
  const table: SummaryTableRow[] = [
    [
      {data: '', header: true},
      {data: 'Tests', header: true},
      {data: 'Passed ✅', header: true},
      {data: 'Skipped ↪️', header: true},
      {data: 'Failed ❌', header: true}
    ]
  ]

  for (const testResult of testResults) {
    table.push([
      `${testResult.checkName}`,
      `${testResult.totalCount} run`,
      `${testResult.passed} passed`,
      `${testResult.skipped} skipped`,
      `${testResult.failed} failed`
    ])
  }

  await core.summary.addTable(table).write()
}
