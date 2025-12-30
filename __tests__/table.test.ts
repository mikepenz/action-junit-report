import {parseTestReports} from '../src/testParser.js'
import {buildSummaryTables} from '../src/table.js'
import {describe, expect, it} from 'vitest'

/**
 *   Copyright Mike Penz
 */

const NORMAL_TABLE = [
  [
    {
      data: '',
      header: true
    },
    {
      data: 'Tests',
      header: true
    },
    {
      data: 'Passed ✅',
      header: true
    },
    {
      data: 'Skipped',
      header: true
    },
    {
      data: 'Failed',
      header: true
    },
    {
      data: 'Time ⏱',
      header: true
    }
  ],
  ['checkName', '3 ran', '3 passed', '0 skipped', '0 failed', '100ms']
]
const FLAKY_TABLE = [
  [
    {
      data: 'Test',
      header: true
    },
    {
      data: 'Retries',
      header: true
    },
    {
      data: 'Time ⏱',
      header: true
    }
  ]
]

describe('buildSummaryTables', () => {
  it('should build simple tables', async () => {
    const testResult = await parseTestReports(
      'checkName',
      'summary',
      'test_results/nested/multi-level.xml',
      '*',
      true,
      true,
      true,
      [],
      '{{SUITE_NAME}}/{{TEST_NAME}}',
      '/'
    )

    const [table, detailTable, flakyTable] = buildSummaryTables([testResult], true, true, true, true, true, false)

    expect(table).toStrictEqual(NORMAL_TABLE)
    expect(detailTable).toStrictEqual([
      [
        {
          data: 'Test',
          header: true
        },
        {
          data: 'Result',
          header: true
        },
        {
          data: 'Time ⏱',
          header: true
        }
      ],
      [
        {
          data: '<strong>checkName</strong>',
          colspan: '3'
        }
      ],
      ['ABC-0199: XMPP Ping/PingIntegrationTest.pingAsync (Normal)', '✅ passed', '54ms'],
      ['ABC-0199: XMPP Ping/PingIntegrationTest.pingServer (Normal)', '✅ passed', ''],
      [
        'ABC-0045: Multi-User Chat/MultiUserIntegrationTest.mucRoleTestForReceivingModerator (Normal)',
        '✅ passed',
        '46ms'
      ]
    ])
    expect(flakyTable).toStrictEqual(FLAKY_TABLE)
  })

  it('should skip only successful tables', async () => {
    const testResult = await parseTestReports(
      'checkName',
      'summary',
      'test_results/nested/multi-level.xml',
      '*',
      true,
      true,
      true,
      [],
      '{{SUITE_NAME}}/{{TEST_NAME}}',
      '/'
    )

    const [table, detailTable, flakyTable] = buildSummaryTables([testResult], true, true, true, true, true, true)
    expect(table).toStrictEqual([])
    expect(detailTable).toStrictEqual([])
    expect(flakyTable).toStrictEqual([])
  })

  it('should exclude skipped tests when includeSkipped is false', async () => {
    const testResult = await parseTestReports(
      'checkName',
      'summary',
      'test_results/tests/utils/target/surefire-reports/TEST-action.surefire.report.calc.StringUtilsTest.xml', // This file has skipped tests
      '*',
      true,
      true,
      true,
      [],
      '{{SUITE_NAME}}/{{TEST_NAME}}',
      '/'
    )

    // Test with includeSkipped = false (should exclude skipped tests from detailed table)
    const [, detailTable] = buildSummaryTables([testResult], true, false, true, false, false, false)

    // Check that the detail table doesn't include skipped tests
    const flatResults = detailTable.flat()
    const hasSkippedTests = flatResults.some(cell => typeof cell === 'string' && cell.includes('⚠️ skipped'))
    expect(hasSkippedTests).toBe(false)

    // Test with includeSkipped = true (should include skipped tests in detailed table)
    const [, detailTableWithSkipped] = buildSummaryTables([testResult], true, true, true, false, false, false)

    // Check that the detail table includes skipped tests
    const flatResultsWithSkipped = detailTableWithSkipped.flat()
    const hasSkippedTestsIncluded = flatResultsWithSkipped.some(
      cell => typeof cell === 'string' && cell.includes('⚠️ skipped')
    )
    expect(hasSkippedTestsIncluded).toBe(true)
  })

  it('should group detail tables', async () => {
    const testResult = await parseTestReports(
      'checkName',
      'summary',
      'test_results/nested/multi-level.xml',
      '*',
      true,
      true,
      true,
      [],
      '{{SUITE_NAME}}/{{TEST_NAME}}',
      '/'
    )

    const [table, detailTable, flakyTable] = buildSummaryTables([testResult], true, true, true, true, true, false, true)

    expect(table).toStrictEqual(NORMAL_TABLE)
    expect(detailTable).toStrictEqual([
      [
        {
          data: 'Test',
          header: true
        },
        {
          data: 'Result',
          header: true
        },
        {
          data: 'Time ⏱',
          header: true
        }
      ],
      [
        {
          data: '<strong>checkName</strong>',
          colspan: '3'
        }
      ],
      [
        {
          data: '<em>ABC-0199: XMPP Ping</em>',
          colspan: '3'
        }
      ],
      ['ABC-0199: XMPP Ping/PingIntegrationTest.pingAsync (Normal)', '✅ passed', '54ms'],
      ['ABC-0199: XMPP Ping/PingIntegrationTest.pingServer (Normal)', '✅ passed', ''],
      [
        {
          data: '<em>ABC-0045: Multi-User Chat</em>',
          colspan: '3'
        }
      ],
      [
        'ABC-0045: Multi-User Chat/MultiUserIntegrationTest.mucRoleTestForReceivingModerator (Normal)',
        '✅ passed',
        '46ms'
      ]
    ])
    expect(flakyTable).toStrictEqual(FLAKY_TABLE)
  })

  it('should show skipped tests when includeSkipped=true but includePassed=false', async () => {
    // This tests the key use case: showing only failed and skipped tests, without passed tests
    const testResult = await parseTestReports(
      'checkName',
      'summary',
      'test_results/tests/utils/target/surefire-reports/TEST-action.surefire.report.calc.StringUtilsTest.xml',
      '*',
      true, // Parse all tests
      true,
      true,
      [],
      undefined,
      '/'
    )

    // Build with includePassed=false but includeSkipped=true
    const [, detailTable] = buildSummaryTables(
      [testResult],
      false, // includePassed - don't show passed tests
      true,  // includeSkipped - but DO show skipped tests
      true,  // detailedSummary
      false, // flakySummary
      false, // verboseSummary
      false  // skipSuccessSummary
    )

    const flatResults = detailTable.flat()

    // Should include skipped tests
    const hasSkippedTests = flatResults.some(cell => typeof cell === 'string' && cell.includes('⚠️ skipped'))
    expect(hasSkippedTests).toBe(true)

    // Should include failed tests
    const hasFailedTests = flatResults.some(cell => typeof cell === 'string' && cell.includes('❌ failure'))
    expect(hasFailedTests).toBe(true)

    // Should NOT include passed tests
    const hasPassedTests = flatResults.some(cell => typeof cell === 'string' && cell.includes('✅ passed'))
    expect(hasPassedTests).toBe(false)
  })

  it('should hide both passed and skipped when both include flags are false', async () => {
    const testResult = await parseTestReports(
      'checkName',
      'summary',
      'test_results/tests/utils/target/surefire-reports/TEST-action.surefire.report.calc.StringUtilsTest.xml',
      '*',
      true, // Parse all tests
      true,
      true,
      [],
      undefined,
      '/'
    )

    // Build with both includePassed=false and includeSkipped=false
    const [, detailTable] = buildSummaryTables(
      [testResult],
      false, // includePassed - don't show passed tests
      false, // includeSkipped - don't show skipped tests either
      true,  // detailedSummary
      false, // flakySummary
      false, // verboseSummary
      false  // skipSuccessSummary
    )

    const flatResults = detailTable.flat()

    // Should NOT include skipped tests
    const hasSkippedTests = flatResults.some(cell => typeof cell === 'string' && cell.includes('⚠️ skipped'))
    expect(hasSkippedTests).toBe(false)

    // Should include failed tests
    const hasFailedTests = flatResults.some(cell => typeof cell === 'string' && cell.includes('❌ failure'))
    expect(hasFailedTests).toBe(true)

    // Should NOT include passed tests
    const hasPassedTests = flatResults.some(cell => typeof cell === 'string' && cell.includes('✅ passed'))
    expect(hasPassedTests).toBe(false)
  })

  it('should show both passed and skipped when both include flags are true', async () => {
    const testResult = await parseTestReports(
      'checkName',
      'summary',
      'test_results/tests/utils/target/surefire-reports/TEST-action.surefire.report.calc.StringUtilsTest.xml',
      '*',
      true, // Parse all tests
      true,
      true,
      [],
      undefined,
      '/'
    )

    // Build with both includePassed=true and includeSkipped=true
    const [, detailTable] = buildSummaryTables(
      [testResult],
      true,  // includePassed - show passed tests
      true,  // includeSkipped - show skipped tests
      true,  // detailedSummary
      false, // flakySummary
      false, // verboseSummary
      false  // skipSuccessSummary
    )

    const flatResults = detailTable.flat()

    // Should include skipped tests
    const hasSkippedTests = flatResults.some(cell => typeof cell === 'string' && cell.includes('⚠️ skipped'))
    expect(hasSkippedTests).toBe(true)

    // Should include failed tests
    const hasFailedTests = flatResults.some(cell => typeof cell === 'string' && cell.includes('❌ failure'))
    expect(hasFailedTests).toBe(true)

    // Should include passed tests
    const hasPassedTests = flatResults.some(cell => typeof cell === 'string' && cell.includes('✅ passed'))
    expect(hasPassedTests).toBe(true)
  })

  it('should include flaky tests in summary even when includePassed is false', async () => {
    const testResult = await parseTestReports(
      'checkName',
      'summary',
      'test_results/junit_flaky_failure/mixed_flaky_and_passed.xml',
      '*',
      false, // includePassed = false
      false, // annotateNotice = false
      false, // checkRetries = false
      [],
      undefined,
      '/'
    )

    // Build tables with includePassed=false and flakySummary=true
    const [table, detailTable, flakyTable] = buildSummaryTables(
      [testResult],
      false, // includePassed
      false, // includeSkipped
      true,  // detailedSummary
      true,  // flakySummary
      true,  // includeTimeInSummary
      false  // onlyShowFailures
    )

    // The main table should show 1 passed test (the flaky one), not all 3
    expect(table).toStrictEqual([
      [
        {data: '', header: true},
        {data: 'Tests', header: true},
        {data: 'Passed ✅', header: true},
        {data: 'Skipped', header: true},
        {data: 'Failed', header: true},
        {data: 'Time ⏱', header: true}
      ],
      ['checkName', '3 ran', '3 passed', '0 skipped', '0 failed', '5s 500ms']
    ])

    // The flaky table should include the flaky test even though includePassed=false
    expect(flakyTable.length).toBeGreaterThan(1) // Header + at least one row
    expect(flakyTable).toStrictEqual([
      [
        {data: 'Test', header: true},
        {data: 'Retries', header: true},
        {data: 'Time ⏱', header: true}
      ],
      [{data: '<strong>checkName</strong>', colspan: '3'}],
      ['FlakyTest.testFlaky', '1', '1s 500ms']
    ])

    // The detail table should not include passed tests, even flaky ones (they appear in flakyTable)
    expect(detailTable.length).toBe(2) // Header + suite header only, no passed tests
    const detailTableFlat = detailTable.flat()
    expect(detailTableFlat.some(cell => typeof cell === 'string' && cell.includes('testFlaky'))).toBe(false)
    expect(detailTableFlat.some(cell => typeof cell === 'string' && cell.includes('testPassed'))).toBe(false)
    expect(detailTableFlat.some(cell => typeof cell === 'string' && cell.includes('testAnotherPassed'))).toBe(false)
  })
})
