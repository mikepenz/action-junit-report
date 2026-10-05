import * as core from '@actions/core'
import {SummaryTableRow} from './types.js'
import {ActualTestResult, Annotation, TestResult} from './testParser.js'
import {escapeHtml, toFormatedTime} from './utils.js'

export function buildSummaryTables(
  testResults: TestResult[],
  includePassed: boolean,
  includeSkipped: boolean,
  detailedSummary: boolean,
  flakySummary: boolean,
  verboseSummary: boolean,
  skipSuccessSummary: boolean,
  groupSuite = false,
  includeEmptyInSummary = true,
  includeTimeInSummary = true,
  simplifiedSummary = false,
  failedSummary = true,
  failedSummaryLogs = false
): [SummaryTableRow[], SummaryTableRow[], SummaryTableRow[], (maxLength?: number) => string] {
  // only include a warning icon if there are skipped tests
  const hasPassed = testResults.some(testResult => testResult.passed > 0)
  const hasSkipped = testResults.some(testResult => testResult.skipped > 0)
  const hasFailed = testResults.some(testResult => testResult.failed > 0)
  const hasTests = testResults.some(testResult => testResult.totalCount > 0)

  if (skipSuccessSummary && !hasFailed) {
    // if we have skip success summary enabled, and we don't have any test failures, return empty tables
    return [[], [], [], () => '']
  }

  const passedHeader = hasTests ? (hasPassed ? (hasFailed ? 'Passed ☑️' : 'Passed ✅') : 'Passed') : 'Passed ❌️'
  const skippedHeader = hasSkipped ? 'Skipped ⚠️' : 'Skipped'
  const failedHeader = hasFailed ? 'Failed ❌️' : 'Failed'
  const timeHeader = 'Time ⏱'

  const passedIcon = simplifiedSummary ? '✅' : 'passed'
  const skippedIcon = simplifiedSummary ? '⚠️' : 'skipped'
  const failedIcon = simplifiedSummary ? '❌' : 'failed'
  const passedDetailIcon = simplifiedSummary ? '✅' : '✅ passed'
  const skippedDetailIcon = simplifiedSummary ? '⚠️' : '⚠️ skipped'

  const table: SummaryTableRow[] = [
    [
      {data: '', header: true},
      {data: 'Tests', header: true},
      {data: passedHeader, header: true},
      {data: skippedHeader, header: true},
      {data: failedHeader, header: true}
    ]
  ]
  if (includeTimeInSummary) {
    table[0].push({data: timeHeader, header: true})
  }

  const detailsTable: SummaryTableRow[] = !detailedSummary
    ? []
    : [
        [
          {data: 'Test', header: true},
          {data: 'Result', header: true}
        ]
      ]

  if (detailedSummary && includeTimeInSummary) {
    detailsTable[0].push({data: timeHeader, header: true})
  }

  const flakyTable: SummaryTableRow[] = !flakySummary
    ? []
    : [
        [
          {data: 'Test', header: true},
          {data: 'Retries', header: true}
        ]
      ]

  if (flakySummary && includeTimeInSummary) {
    flakyTable[0].push({data: timeHeader, header: true})
  }

  // failed tests are rendered as collapsible blocks with their logs, instead of rows in the details table
  const inlineFailures = detailedSummary && failedSummary && failedSummaryLogs
  const excludeFailed = !failedSummary || inlineFailures
  const failedEntries: [string, Annotation[]][] = []
  const colspan = includeTimeInSummary ? '3' : '2'
  for (const testResult of testResults) {
    const row = [
      `${testResult.checkName}`,
      includeEmptyInSummary || testResult.totalCount > 0 ? `${testResult.totalCount} ran` : ``,
      includeEmptyInSummary || testResult.passed > 0 ? `${testResult.passed} ${passedIcon}` : ``,
      includeEmptyInSummary || testResult.skipped > 0 ? `${testResult.skipped} ${skippedIcon}` : ``,
      includeEmptyInSummary || testResult.failed > 0 ? `${testResult.failed} ${failedIcon}` : ``
    ]
    if (includeTimeInSummary) {
      row.push(toFormatedTime(testResult.time))
    }
    table.push(row)

    const failures = inlineFailures ? groupFailures(collectAnnotations(testResult)) : []
    for (const group of failures) failedEntries.push([testResult.checkName, group])

    const annotations = testResult.globalAnnotations.filter(
      annotation =>
        (includePassed || annotation.status !== 'success' || annotation.retries > 0) &&
        (includeSkipped || annotation.status !== 'skipped')
    )
    const detailAnnotations = excludeFailed
      ? annotations.filter(annotation => annotation.status !== 'failure')
      : annotations

    if (annotations.length === 0 && failures.length === 0) {
      if (!includePassed) {
        core.info(
          `⚠️ No annotations found for ${testResult.checkName}. If you want to include passed results in this table please configure 'include_passed' as 'true'`
        )
      }
      if (verboseSummary) {
        detailsTable.push([{data: `No test annotations available`, colspan}])
      }
    } else {
      if (detailedSummary) {
        const headingIndex = detailsTable.length
        detailsTable.push([{data: `<strong>${testResult.checkName}</strong>`, colspan}])
        if (!groupSuite) {
          for (const annotation of detailAnnotations) {
            // Skip passed tests (including flaky ones) in details table when includePassed is false
            // Note: skipped tests have status='skipped' and are handled separately by includeSkipped
            if (!includePassed && annotation.status === 'success') {
              continue
            }
            const detailsRow = [
              `${annotation.title}`,
              `${
                annotation.status === 'success'
                  ? passedDetailIcon
                  : annotation.status === 'skipped'
                    ? skippedDetailIcon
                    : `❌ ${annotation.annotation_level}`
              }`
            ]
            if (includeTimeInSummary) {
              detailsRow.push(toFormatedTime(annotation.time))
            }
            detailsTable.push(detailsRow)
          }
        } else {
          for (const internalTestResult of testResult.testResults) {
            appendDetailsTable(
              internalTestResult,
              detailsTable,
              includePassed,
              includeSkipped,
              includeTimeInSummary,
              passedDetailIcon,
              skippedDetailIcon,
              excludeFailed
            )
          }
        }
        if (excludeFailed && detailsTable.length === headingIndex + 1) {
          detailsTable.pop()
        }
      }

      if (flakySummary) {
        const flakyAnnotations = annotations.filter(annotation => annotation.retries > 0)
        if (flakyAnnotations.length > 0) {
          flakyTable.push([{data: `<strong>${testResult.checkName}</strong>`, colspan}])
          for (const annotation of flakyAnnotations) {
            const flakyRow = [`${annotation.title}`, `${annotation.retries}`]
            if (includeTimeInSummary) {
              flakyRow.push(toFormatedTime(annotation.time))
            }
            flakyTable.push(flakyRow)
          }
        }
      }
    }
  }
  // drop the details table when failed tests were its only content, leaving just the header
  if (excludeFailed && detailsTable.length === 1) {
    detailsTable.length = 0
  }
  return [
    table,
    detailsTable,
    flakyTable,
    maxLength => buildFailedSection(failedEntries, includeTimeInSummary, maxLength)
  ]
}

// Render for each destination's remaining budget, keeping titles before spending space on logs.
function buildFailedSection(
  groups: [string, Annotation[]][],
  includeTimeInSummary: boolean,
  maxLength = 50000
): string {
  if (groups.length === 0) return ''
  const limit = Math.min(maxLength, 50000)
  const header = '<p><strong>Failed tests</strong></p>'
  const omittedNotice = (count: number): string => `<p><em>Logs omitted for ${count} failed tests (size limit)</em></p>`
  const hiddenNotice = (count: number): string => `<p><em>… ${count} more failed tests not shown (size limit)</em></p>`
  const budget = limit - omittedNotice(groups.length).length - hiddenNotice(groups.length).length - 2
  if (budget < header.length) return hiddenNotice(groups.length).length <= limit ? hiddenNotice(groups.length) : ''

  const titles: string[] = []
  const rendered: string[] = []
  let used = header.length
  for (const [checkName, [first]] of groups) {
    if (checkName.length > budget) break
    const context = `<strong>${escapeHtml(checkName)}</strong> › `
    const testTitle = buildFailedTitle(first, includeTimeInSummary, budget - context.length)
    if (testTitle === undefined) break
    const title = context + testTitle
    const entry = `<p>❌ ${title}</p>`
    if (used + entry.length + 1 > budget) break
    titles.push(title)
    rendered.push(entry)
    used += entry.length + 1
  }

  let omittedLogs = 0
  for (let i = 0; i < rendered.length; i++) {
    const prefix = `<details><summary>❌ ${titles[i]}</summary><br><pre>`
    const suffix = '</pre></details>'
    const logs = buildFailedLogs(groups[i][1], budget - used + rendered[i].length - prefix.length - suffix.length)
    if (logs === undefined) {
      omittedLogs++
    } else {
      const entry = prefix + logs + suffix
      used += entry.length - rendered[i].length
      rendered[i] = entry
    }
  }
  const lines = [header, ...rendered]
  if (omittedLogs) lines.push(omittedNotice(omittedLogs))
  if (titles.length < groups.length) lines.push(hiddenNotice(groups.length - titles.length))
  return lines.join('\n')
}

function buildFailedLogs(failures: Annotation[], budget: number): string | undefined {
  if (budget < 0) return undefined
  let logs = ''
  const seen = new Set<string>()
  for (const failure of failures) {
    for (const part of [failure.message, failure.raw_details]) {
      if (!part || seen.has(part)) continue
      const separator = logs ? '\n\n' : ''
      if (logs.length + separator.length + part.length > budget) return undefined
      const escaped = escapeHtml(part)
      if (logs.length + separator.length + escaped.length > budget) return undefined
      logs += separator + escaped
      seen.add(part)
    }
  }
  return logs.trim()
}

function collectAnnotations(testResult: TestResult): Annotation[] {
  const collected = new Set<Annotation>(testResult.globalAnnotations)
  const visit = (suite: ActualTestResult): void => {
    suite.annotations.forEach(annotation => collected.add(annotation))
    suite.testResults.forEach(visit)
  }
  testResult.testResults.forEach(visit)
  return [...collected]
}

// the parser numbers the failures of one testcase `(failure i/n)`, in order, each with its own source path
function groupFailures(annotations: Annotation[]): Annotation[][] {
  const failures = annotations.filter(annotation => annotation.status === 'failure')
  const suffix = / \(failure (\d+)\/(\d+)\)$/
  const groups: Annotation[][] = []
  for (let i = 0; i < failures.length;) {
    const match = failures[i].title.match(suffix)
    let size = 1
    if (match && match[1] === '1') {
      const total = Number(match[2])
      while (size < total && failures[i + size]?.title.match(suffix)?.slice(1).join('/') === `${size + 1}/${total}`) {
        size++
      }
    }
    groups.push(failures.slice(i, i + size))
    i += size
  }
  return groups
}

function buildFailedTitle(first: Annotation, includeTimeInSummary: boolean, budget: number): string | undefined {
  if (first.path.length > budget) return undefined
  const baseTitle = first.title.replace(/ \(failure \d+\/\d+\)$/, '')
  // Normalize only for matching, preserving backslashes in the actual test name.
  const path = first.path.replace(/\\/g, '/')
  const normalizedTitle = baseTitle.replace(/\\/g, '/')
  let prefix = path
  while (prefix && !normalizedTitle.startsWith(`${prefix}.`)) {
    const separator = prefix.indexOf('/')
    prefix = separator < 0 ? '' : prefix.slice(separator + 1)
  }
  const className = path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]*$/, '')
  if (!prefix && className && normalizedTitle.startsWith(`${className}.`)) prefix = className
  const testName = prefix ? baseTitle.slice(prefix.length + 1) : baseTitle
  if (first.path.length + testName.length > budget) return undefined
  const name = [first.path, testName]
    .filter(Boolean)
    .map(part => `<code>${escapeHtml(part)}</code>`)
    .join(' › ')
  return name + (includeTimeInSummary ? ` <i>(${toFormatedTime(first.time) || '0ms'})</i>` : '')
}

function appendDetailsTable(
  testResult: ActualTestResult,
  detailsTable: SummaryTableRow[],
  includePassed: boolean,
  includeSkipped: boolean,
  includeTimeInSummary: boolean,
  passedDetailIcon: string,
  skippedDetailIcon: string,
  excludeFailed: boolean
): void {
  const colspan = includeTimeInSummary ? '3' : '2'
  // For details table, don't include passed tests when includePassed is false (even if flaky)
  // Note: skipped tests have status='skipped' and are handled separately by includeSkipped
  const annotations = testResult.annotations.filter(
    annotation =>
      (includePassed || annotation.status !== 'success') &&
      (includeSkipped || annotation.status !== 'skipped') &&
      !(excludeFailed && annotation.status === 'failure')
  )
  if (annotations.length > 0) {
    detailsTable.push([{data: `<em>${testResult.name}</em>`, colspan}])
    for (const annotation of annotations) {
      const row = [
        `${annotation.title}`,
        `${
          annotation.status === 'success'
            ? passedDetailIcon
            : annotation.status === 'skipped'
              ? skippedDetailIcon
              : `❌ ${annotation.annotation_level}`
        }`
      ]
      if (includeTimeInSummary) {
        row.push(toFormatedTime(annotation.time))
      }
      detailsTable.push(row)
    }
  }
  for (const childTestResult of testResult.testResults) {
    appendDetailsTable(
      childTestResult,
      detailsTable,
      includePassed,
      includeSkipped,
      includeTimeInSummary,
      passedDetailIcon,
      skippedDetailIcon,
      excludeFailed
    )
  }
}
