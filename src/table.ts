import * as core from '@actions/core'
import {SummaryTableRow} from '@actions/core/lib/summary.js'
import {ActualTestResult, TestResult} from './testParser.js'
import {toFormatedTime} from './utils.js'

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
  simplifiedSummary = false
): [SummaryTableRow[], SummaryTableRow[], SummaryTableRow[]] {
  // only include a warning icon if there are skipped tests
  const hasPassed = testResults.some(testResult => testResult.passed > 0)
  const hasSkipped = testResults.some(testResult => testResult.skipped > 0)
  const hasFailed = testResults.some(testResult => testResult.failed > 0)
  const hasTests = testResults.some(testResult => testResult.totalCount > 0)

  if (skipSuccessSummary && !hasFailed) {
    // if we have skip success summary enabled, and we don't have any test failures, return empty tables
    return [[], [], []]
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

    const annotations = testResult.globalAnnotations.filter(
      annotation =>
        (includePassed || annotation.status !== 'success' || annotation.retries > 0) &&
        (includeSkipped || annotation.status !== 'skipped')
    )

    if (annotations.length === 0) {
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
        detailsTable.push([{data: `<strong>${testResult.checkName}</strong>`, colspan}])
        if (!groupSuite) {
          for (const annotation of annotations) {
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
              skippedDetailIcon
            )
          }
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
  return [table, detailsTable, flakyTable]
}

function appendDetailsTable(
  testResult: ActualTestResult,
  detailsTable: SummaryTableRow[],
  includePassed: boolean,
  includeSkipped: boolean,
  includeTimeInSummary: boolean,
  passedDetailIcon: string,
  skippedDetailIcon: string
): void {
  const colspan = includeTimeInSummary ? '3' : '2'
  // For details table, don't include passed tests when includePassed is false (even if flaky)
  // Note: skipped tests have status='skipped' and are handled separately by includeSkipped
  const annotations = testResult.annotations.filter(
    annotation =>
      (includePassed || annotation.status !== 'success') &&
      (includeSkipped || annotation.status !== 'skipped')
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
      skippedDetailIcon
    )
  }
}
