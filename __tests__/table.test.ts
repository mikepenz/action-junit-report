import {parseTestReports} from '../src/testParser'
import {buildSummaryTables} from '../src/table'

/**
 *   Copyright Mike Penz
 */
jest.setTimeout(30000)

describe('buildSummaryTables', () => {
  it('should build simple tables', async () => {
    const testResult = await parseTestReports(
      'checkName',
      'summary',
      'test_results/nested/multi-level.xml',
      '*',
      true,
      true,
      [],
      '{{SUITE_NAME}}/{{TEST_NAME}}',
      '/'
    )

    const [table, detailTable, flakyTable] = buildSummaryTables([testResult], true, true, true)

    expect(table).toStrictEqual([
      [
        {
          'data': '',
          'header': true
        },
        {
          'data': 'Tests',
          'header': true
        },
        {
          'data': 'Passed ✅',
          'header': true
        },
        {
          'data': 'Skipped ⏭️',
          'header': true
        },
        {
          'data': 'Failed ❌',
          'header': true
        }
      ],
      [
        'checkName',
        '3 ran',
        '3 passed',
        '0 skipped',
        '0 failed'
      ]
    ])
    expect(detailTable).toStrictEqual([
      [
        {
          'data': '',
          'header': true
        },
        {
          'data': 'Test',
          'header': true
        },
        {
          'data': 'Result',
          'header': true
        }
      ],
      [
        'checkName',
        'XEP-0199: XMPP Ping/PingIntegrationTest.pingAsync (Normal)',
        '✅ pass'
      ],
      [
        'checkName',
        'XEP-0199: XMPP Ping/PingIntegrationTest.pingServer (Normal)',
        '✅ pass'
      ],
      [
        'checkName',
        'XEP-0045: Multi-User Chat/MultiUserChatRolesAffiliationsPrivilegesIntegrationTest.mucRoleTestForReceivingModerator (Normal)',
        '✅ pass'
      ]
    ])
    expect(flakyTable).toStrictEqual([
      [
        {
          'data': '',
          'header': true
        },
        {
          'data': 'Test',
          'header': true
        },
        {
          'data': 'Retries',
          'header': true
        }
      ]
    ])
  })
})
