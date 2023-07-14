import * as core from '@actions/core'
import {TestResult} from './testParser'
import * as github from '@actions/github'
import {SummaryTableRow} from '@actions/core/lib/summary'

export async function annotateTestResult(
  testResult: TestResult,
  token: string,
  headSha: string,
  annotateOnly: boolean,
  updateCheck: boolean,
  annotateNotice: boolean,
  jobName: string
): Promise<void> {
  const annotations = testResult.annotations.filter(
    annotation => annotateNotice || annotation.annotation_level !== 'notice'
  )
  const foundResults = testResult.totalCount > 0 || testResult.skipped > 0

  let title = 'No test results found!'
  if (foundResults) {
    title = `${testResult.totalCount} tests run, ${testResult.passed} passed, ${testResult.skipped} skipped, ${testResult.failed} failed.`
  }

  core.info(`ℹ️ - ${testResult.checkName} - ${title}`)

  const conclusion: 'success' | 'failure' = testResult.failed <= 0 ? 'success' : 'failure'

  for (const annotation of annotations) {
    core.info(`   🧪 - ${annotation.path} | ${annotation.message.split('\n', 1)[0]}`)
  }

  const octokit = github.getOctokit(token)
  if (annotateOnly) {
    for (const annotation of annotations) {
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
      } else if (annotateNotice) {
        core.notice(annotation.message, properties)
      }
    }
  } else {
    if (updateCheck) {
      const checks = await octokit.rest.checks.listForRef({
        ...github.context.repo,
        ref: headSha,
        check_name: jobName,
        status: 'in_progress',
        filter: 'latest'
      })

      core.debug(JSON.stringify(checks, null, 2))

      const check_run_id = checks.data.check_runs[0].id

      core.info(`ℹ️ - ${testResult.checkName} - Updating checks ${annotations.length}`)
      for (let i = 0; i < annotations.length; i = i + 50) {
        const sliced = annotations.slice(i, i + 50)

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
          annotations: annotations.slice(0, 50)
        }
      }

      core.debug(JSON.stringify(createCheckRequest, null, 2))

      core.info(`ℹ️ - ${testResult.checkName} - Creating check for`)
      await octokit.rest.checks.create(createCheckRequest)
    }
  }
}

export async function attachSummary(
  testResults: TestResult[],
  detailedSummary: boolean,
  includePassed: boolean
): Promise<void> {
  const table: SummaryTableRow[] = [
    [
      {data: '', header: true},
      {data: 'Tests', header: true},
      {data: 'Passed ✅', header: true},
      {data: 'Skipped ⏭️', header: true},
      {data: 'Failed ❌', header: true}
    ]
  ]

  const detailsTable: SummaryTableRow[] = [
    [
      {data: '', header: true},
      {data: 'Test', header: true},
      {data: 'Result', header: true}
    ]
  ]

  for (const testResult of testResults) {
    table.push([
      `${testResult.checkName}`,
      `${testResult.totalCount} ran`,
      `${testResult.passed} passed`,
      `${testResult.skipped} skipped`,
      `${testResult.failed} failed`
    ])

    if (detailedSummary) {
      const annotations = testResult.annotations.filter(
        annotation => includePassed || annotation.annotation_level !== 'notice'
      )

      if (annotations.length === 0) {
        if (!includePassed) {
          core.info(
            `⚠️ No annotations found for ${testResult.checkName}. If you want to include passed results in this table please configure 'include_passed' as 'true'`
          )
        }
        detailsTable.push([`-`, `No test annotations available`, `-`])
      } else {
        for (const annotation of annotations) {
          detailsTable.push([
            `${testResult.checkName}`,
            `${annotation.title}`,
            `${
              annotation.status === 'success'
                ? '✅ pass'
                : annotation.status === 'skipped'
                ? `⏭️ skipped`
                : `❌ ${annotation.annotation_level}`
            }`
          ])
        }
      }
    }
  }

  await core.summary.addTable(table).write()
  if (detailedSummary) {
    await core.summary.addTable(detailsTable).write()
  }
}
