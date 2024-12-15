import * as core from '@actions/core'
import {Annotation, TestResult} from './testParser.js'
import * as github from '@actions/github'
// eslint-disable-next-line import/extensions
import {SummaryTableRow} from '@actions/core/lib/summary.js'
// eslint-disable-next-line import/extensions
import {GitHub, context} from '@actions/github/lib/utils.js'
import {buildTable} from './utils.js'

export async function annotateTestResult(
  testResult: TestResult,
  token: string,
  headSha: string,
  checkAnnotations: boolean,
  annotateOnly: boolean,
  updateCheck: boolean,
  annotateNotice: boolean,
  jobName: string
): Promise<void> {
  const annotations = testResult.globalAnnotations.filter(
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
    // only create annotaitons, no check
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
    // check status is being created, annotations are included in this (if not diasbled by "checkAnnotations")
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

      if (checkAnnotations) {
        core.info(`ℹ️ - ${testResult.checkName} - Updating checks (Annotations: ${annotations.length})`)
        for (let i = 0; i < annotations.length; i = i + 50) {
          const sliced = annotations.slice(i, i + 50)
          await updateChecks(octokit, check_run_id, title, testResult.summary, sliced)
        }
      } else {
        core.info(`ℹ️ - ${testResult.checkName} - Updating checks (disabled annotations)`)
        await updateChecks(octokit, check_run_id, title, testResult.summary, [])
      }
    } else {
      const status: 'completed' | 'in_progress' | 'queued' | undefined = 'completed'
      // don't send annotations if disabled
      const adjustedAnnotations = checkAnnotations ? annotations : []
      const createCheckRequest = {
        ...github.context.repo,
        name: testResult.checkName,
        head_sha: headSha,
        status,
        conclusion,
        output: {
          title,
          summary: testResult.summary,
          annotations: adjustedAnnotations.slice(0, 50)
        }
      }

      core.debug(JSON.stringify(createCheckRequest, null, 2))

      core.info(`ℹ️ - ${testResult.checkName} - Creating check (Annotations: ${adjustedAnnotations.length})`)
      await octokit.rest.checks.create(createCheckRequest)
    }
  }
}

async function updateChecks(
  octokit: InstanceType<typeof GitHub>,
  check_run_id: number,
  title: string,
  summary: string,
  annotations: Annotation[]
): Promise<void> {
  const updateCheckRequest = {
    ...github.context.repo,
    check_run_id,
    output: {
      title,
      summary,
      annotations
    }
  }

  core.debug(JSON.stringify(updateCheckRequest, null, 2))
  await octokit.rest.checks.update(updateCheckRequest)
}

export async function attachSummary(
  table: SummaryTableRow[],
  detailsTable: SummaryTableRow[],
  flakySummary: SummaryTableRow[]
): Promise<void> {
  await core.summary.addTable(table).write()
  if (detailsTable.length > 1) {
    await core.summary.addTable(detailsTable).write()
  }
  if (flakySummary.length > 1) {
    await core.summary.addTable(flakySummary).write()
  }
}

export function buildCommentIdentifier(checkName: string[]): string {
  return `<!-- Summary comment for ${JSON.stringify(checkName)} by mikepenz/action-junit-report -->`
}

export async function attachComment(
  octokit: InstanceType<typeof GitHub>,
  checkName: string[],
  updateComment: boolean,
  table: SummaryTableRow[],
  detailsTable: SummaryTableRow[],
  flakySummary: SummaryTableRow[]
): Promise<void> {
  if (!context.issue.number) {
    core.warning(`⚠️ Action requires a valid issue number (PR reference) to be able to attach a comment..`)
    return
  }

  const identifier = buildCommentIdentifier(checkName)

  let comment = buildTable(table)
  if (detailsTable.length > 0) {
    comment += '\n\n'
    comment += buildTable(detailsTable)
  }
  if (flakySummary.length > 1) {
    comment += '\n\n'
    comment += buildTable(flakySummary)
  }
  comment += `\n\n${identifier}`

  const priorComment = updateComment ? await findPriorComment(octokit, identifier) : undefined
  if (priorComment) {
    await octokit.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: priorComment,
      body: comment
    })
  } else {
    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: comment
    })
  }
}

async function findPriorComment(octokit: InstanceType<typeof GitHub>, identifier: string): Promise<number | undefined> {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number
  })

  const foundComment = comments.find(comment => comment.body?.endsWith(identifier))
  return foundComment?.id
}
