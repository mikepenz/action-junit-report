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
  ['checkName', '3 ran', '3 passed', '0 skipped', '0 failed', '0.1s']
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

    const [table, detailTable, flakyTable] = buildSummaryTables([testResult], true, true, true, true, false)

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
      ['ABC-0199: XMPP Ping/PingIntegrationTest.pingAsync (Normal)', '✅ passed', '0.054s'],
      ['ABC-0199: XMPP Ping/PingIntegrationTest.pingServer (Normal)', '✅ passed', '0s'],
      [
        'ABC-0045: Multi-User Chat/MultiUserIntegrationTest.mucRoleTestForReceivingModerator (Normal)',
        '✅ passed',
        '0.046s'
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

    const [table, detailTable, flakyTable] = buildSummaryTables([testResult], true, true, true, true, true)
    expect(table).toStrictEqual([])
    expect(detailTable).toStrictEqual([])
    expect(flakyTable).toStrictEqual([])
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

    const [table, detailTable, flakyTable] = buildSummaryTables([testResult], true, true, true, true, false, true)

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
      ['ABC-0199: XMPP Ping/PingIntegrationTest.pingAsync (Normal)', '✅ passed', '0.054s'],
      ['ABC-0199: XMPP Ping/PingIntegrationTest.pingServer (Normal)', '✅ passed', '0s'],
      [
        {
          data: '<em>ABC-0045: Multi-User Chat</em>',
          colspan: '3'
        }
      ],
      [
        'ABC-0045: Multi-User Chat/MultiUserIntegrationTest.mucRoleTestForReceivingModerator (Normal)',
        '✅ passed',
        '0.046s'
      ]
    ])
    expect(flakyTable).toStrictEqual(FLAKY_TABLE)
  })
})
