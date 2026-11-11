import * as core from '@actions/core'
import {Annotation, TestResult} from './testParser.js'
import * as github from '@actions/github'
import {buildLink, buildList, buildTable, escapeHtml, truncate, truncateBytes} from './utils.js'
import {SummaryTableRow} from './types.js'

type GitHub = ReturnType<typeof github.getOctokit>
const context = github.context

// the Checks API accepts at most 50 annotations per request
const MAX_ANNOTATIONS_PER_REQUEST = 50

// maximum annotation sizes of the checks API: https://docs.github.com/en/rest/checks/runs#create-a-check-run
const ANNOTATION_TITLE_MAX_LENGTH = 255
const ANNOTATION_TEXT_MAX_BYTES = 65535

// maximum length of a comment body accepted by GitHub
const MAX_COMMENT_LENGTH = 65536

/**
 * Shortens the annotation fields to the sizes accepted by the checks API, one oversized annotation fails the whole request.
 */
function limitAnnotation(annotation: Annotation): Annotation {
  return {
    ...annotation,
    title: truncate(annotation.title, ANNOTATION_TITLE_MAX_LENGTH),
    message: truncateBytes(annotation.message, ANNOTATION_TEXT_MAX_BYTES),
    raw_details: truncateBytes(annotation.raw_details, ANNOTATION_TEXT_MAX_BYTES)
  }
}

export interface CheckInfo {
  name: string
  url: string
}

export async function annotateTestResult(
  testResult: TestResult,
  token: string,
  headSha: string,
  checkAnnotations: boolean,
  annotateOnly: boolean,
  updateCheck: boolean,
  annotateNotice: boolean,
  jobName: string
): Promise<CheckInfo | undefined> {
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
    return undefined // No check created, so no URL to return
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

      const checkRun = checks.data.check_runs[0]
      if (!checkRun) {
        core.warning(
          `⚠️ No in progress check named '${jobName}' found for ${headSha}, skipped updating it with ${testResult.checkName}. Make sure 'job_name' matches the check name of the running job, including a custom job 'name' or matrix values.`
        )
        return undefined
      }

      const check_run_id = checkRun.id
      const checkUrl = `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/runs/${check_run_id}`

      if (checkAnnotations) {
        core.info(`ℹ️ - ${testResult.checkName} - Updating checks (Annotations: ${annotations.length})`)
        // the first update also sets the title and summary, so it has to be sent even without annotations
        for (let i = 0; i === 0 || i < annotations.length; i = i + MAX_ANNOTATIONS_PER_REQUEST) {
          const sliced = annotations.slice(i, i + MAX_ANNOTATIONS_PER_REQUEST)
          await updateChecks(octokit, check_run_id, title, testResult.summary, sliced)
        }
      } else {
        core.info(`ℹ️ - ${testResult.checkName} - Updating checks (disabled annotations)`)
        await updateChecks(octokit, check_run_id, title, testResult.summary, [])
      }

      return {
        name: testResult.checkName,
        url: checkUrl
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
          annotations: adjustedAnnotations.slice(0, MAX_ANNOTATIONS_PER_REQUEST).map(limitAnnotation)
        }
      }

      core.debug(JSON.stringify(createCheckRequest, null, 2))

      core.info(`ℹ️ - ${testResult.checkName} - Creating check (Annotations: ${adjustedAnnotations.length})`)
      const checkResponse = await octokit.rest.checks.create(createCheckRequest)

      // the remaining annotations are appended by updating the created check
      try {
        for (let i = MAX_ANNOTATIONS_PER_REQUEST; i < adjustedAnnotations.length; i = i + MAX_ANNOTATIONS_PER_REQUEST) {
          const sliced = adjustedAnnotations.slice(i, i + MAX_ANNOTATIONS_PER_REQUEST)
          await updateChecks(octokit, checkResponse.data.id, title, testResult.summary, sliced)
        }
      } catch (error) {
        // the check exists at this point, keep its link and continue publishing the other results
        core.warning(`⚠️ Failed to append all annotations to ${testResult.checkName}. (${error})`)
      }

      // Return the check URL for use in job summary
      return {
        name: testResult.checkName,
        url: `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/runs/${checkResponse.data.id}`
      }
    }
  }
}

async function updateChecks(
  octokit: GitHub,
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
      annotations: annotations.map(limitAnnotation)
    }
  }

  core.debug(JSON.stringify(updateCheckRequest, null, 2))
  await octokit.rest.checks.update(updateCheckRequest)
}

export async function attachSummary(
  table: SummaryTableRow[],
  detailsTable: SummaryTableRow[],
  flakySummary: SummaryTableRow[],
  checkInfos: CheckInfo[] = [],
  summaryText?: string,
  failedSection = ''
): Promise<void> {
  // Add summary text if provided
  if (summaryText) {
    core.summary.addRaw(summaryText)
  }

  if (table.length > 0) {
    core.summary.addTable(table)
  }
  if (detailsTable.length > 1) {
    core.summary.addTable(detailsTable)
  }
  if (failedSection) {
    core.summary.addRaw(failedSection, true)
  }
  if (flakySummary.length > 1) {
    core.summary.addTable(flakySummary)
  }

  // Add check links to the job summary if any checks were created
  if (checkInfos.length > 0) {
    const links = checkInfos.map(checkInfo => {
      return buildLink(`View ${escapeHtml(checkInfo.name)}`, checkInfo.url)
    })
    core.summary.addList(links)
  }
  core.summary.addSeparator()
  await core.summary.write()
}

export function buildCommentIdentifier(checkName: string[]): string {
  return `<!-- Summary comment for ${JSON.stringify(checkName)} by mikepenz/action-junit-report -->`
}

export async function attachComment(
  octokit: GitHub,
  checkName: string[],
  updateComment: boolean,
  table: SummaryTableRow[],
  detailsTable: SummaryTableRow[],
  flakySummary: SummaryTableRow[],
  checkInfos: CheckInfo[] = [],
  prId?: string,
  renderFailures: (maxLength?: number) => string = () => ''
): Promise<void> {
  // Use provided prId or fall back to context issue number
  const issueNumber = prId ? parseInt(prId, 10) : context.issue.number

  if (!issueNumber) {
    core.warning(
      `⚠️ Action requires a valid issue number (PR reference) or pr_id input to be able to attach a comment..`
    )
    return
  }

  if (table.length === 0 && detailsTable.length === 0 && flakySummary.length === 0) {
    core.debug(`Tables for comment were empty. 'skip_success_summary' enabled?`)
    return
  }

  const identifier = buildCommentIdentifier(checkName)

  // Add check links to the job summary if any checks were created
  let footer = ''
  if (checkInfos.length > 0) {
    const links = checkInfos.map(checkInfo => {
      return buildLink(`View ${escapeHtml(checkInfo.name)}`, checkInfo.url)
    })
    footer += buildList(links)
    footer += `\n\n`
  }

  footer += `\n\n${identifier}`

  // shorten the tables in order to fit the size limit, the comment has to end with the identifier to be found again
  let head = buildTable(table, MAX_COMMENT_LENGTH - footer.length)
  if (detailsTable.length > 1) {
    head += '\n\n'
    head += buildTable(detailsTable, MAX_COMMENT_LENGTH - head.length - footer.length)
  }

  let tail = ''
  if (flakySummary.length > 1) {
    tail += '\n\n'
    tail += buildTable(flakySummary, MAX_COMMENT_LENGTH - head.length - tail.length - footer.length)
  }

  tail += footer

  let comment = head
  const failedSection = renderFailures(MAX_COMMENT_LENGTH - head.length - tail.length - 2)
  if (failedSection) {
    comment += '\n\n'
    comment += failedSection
  }
  comment += tail

  const priorComment = updateComment ? await findPriorComment(octokit, identifier, issueNumber) : undefined
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
      issue_number: issueNumber,
      body: comment
    })
  }
}

async function findPriorComment(octokit: GitHub, identifier: string, issueNumber: number): Promise<number | undefined> {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber
  })

  const foundComment = comments.find(comment => comment.body?.endsWith(identifier))
  return foundComment?.id
}
