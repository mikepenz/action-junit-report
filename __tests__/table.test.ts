import {parseTestReports} from '../src/testParser.js'
import {buildSummaryTables} from '../src/table.js'

/**
 *   Copyright Mike Penz
 */
jest.setTimeout(30000)

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
    const hasSkippedTests = flatResults.some(
      cell => typeof cell === 'string' && cell.includes('⚠️ skipped')
    )
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
})
