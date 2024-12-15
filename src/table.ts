import * as core from '@actions/core'
// eslint-disable-next-line import/extensions
import {SummaryTableRow} from '@actions/core/lib/summary.js'
import {ActualTestResult, TestResult} from './testParser.js'

export function buildSummaryTables(
  testResults: TestResult[],
  includePassed: boolean,
  detailedSummary: boolean,
  flakySummary: boolean,
  groupSuite = false
): [SummaryTableRow[], SummaryTableRow[], SummaryTableRow[]] {
  // only include a warning icon if there are skipped tests
  const hasPassed = testResults.some(testResult => testResult.passed > 0)
  const hasSkipped = testResults.some(testResult => testResult.skipped > 0)
  const hasFailed = testResults.some(testResult => testResult.failed > 0)
  const hasTests = testResults.some(testResult => testResult.totalCount > 0)

  const passedHeader = hasTests ? (hasPassed ? (hasFailed ? 'Passed ☑️' : 'Passed ✅') : 'Passed') : 'Passed ❌️'
  const skippedHeader = hasSkipped ? 'Skipped ⚠️' : 'Skipped'
  const failedHeader = hasFailed ? 'Failed ❌️' : 'Failed'

  const table: SummaryTableRow[] = [
    [
      {data: '', header: true},
      {data: 'Tests', header: true},
      {data: passedHeader, header: true},
      {data: skippedHeader, header: true},
      {data: failedHeader, header: true}
    ]
  ]

  const detailsTable: SummaryTableRow[] = !detailedSummary
    ? []
    : [
        [
          {data: 'Test', header: true},
          {data: 'Result', header: true}
        ]
      ]

  const flakyTable: SummaryTableRow[] = !flakySummary
    ? []
    : [
        [
          {data: 'Test', header: true},
          {data: 'Retries', header: true}
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

    const annotations = testResult.globalAnnotations.filter(
      annotation => includePassed || annotation.annotation_level !== 'notice'
    )

    if (annotations.length === 0) {
      if (!includePassed) {
        core.info(
          `⚠️ No annotations found for ${testResult.checkName}. If you want to include passed results in this table please configure 'include_passed' as 'true'`
        )
      }
      detailsTable.push([{data: `No test annotations available`, colspan: '2'}])
    } else {
      if (detailedSummary) {
        detailsTable.push([{data: `<strong>${testResult.checkName}</strong>`, colspan: '2'}])
        if (!groupSuite) {
          for (const annotation of annotations) {
            detailsTable.push([
              `${annotation.title}`,
              `${
                annotation.status === 'success'
                  ? '✅ pass'
                  : annotation.status === 'skipped'
                    ? `⚠️️ skipped`
                    : `❌ ${annotation.annotation_level}`
              }`
            ])
          }
        } else {
          for (const internalTestResult of testResult.testResults) {
            appendDetailsTable(internalTestResult, detailsTable, includePassed)
          }
        }
      }

      if (flakySummary) {
        const flakyAnnotations = annotations.filter(annotation => annotation.retries > 0)
        if (flakyAnnotations.length > 0) {
          flakyTable.push([{data: `<strong>${testResult.checkName}</strong>`, colspan: '2'}])
          for (const annotation of flakyAnnotations) {
            flakyTable.push([`${annotation.title}`, `${annotation.retries}`])
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
  includePassed: boolean
): void {
  const annotations = testResult.annotations.filter(
    annotation => includePassed || annotation.annotation_level !== 'notice'
  )
  if (annotations.length > 0) {
    detailsTable.push([{data: `<em>${testResult.name}</em>`, colspan: '2'}])
    for (const annotation of annotations) {
      detailsTable.push([
        `${annotation.title}`,
        `${
          annotation.status === 'success'
            ? '✅ pass'
            : annotation.status === 'skipped'
              ? `⚠️️ skipped`
              : `❌ ${annotation.annotation_level}`
        }`
      ])
    }
  }
  for (const childTestResult of testResult.testResults) {
    appendDetailsTable(childTestResult, detailsTable, includePassed)
  }
}
