import {parseTestReports, TestResult} from '../src/testParser.js'
import {buildSummaryTables} from '../src/table.js'
import {describe, expect, it, vi} from 'vitest'
import * as utils from '../src/utils.js'

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
      true, // includeSkipped - but DO show skipped tests
      true, // detailedSummary
      false, // flakySummary
      false, // verboseSummary
      false // skipSuccessSummary
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
      true, // detailedSummary
      false, // flakySummary
      false, // verboseSummary
      false // skipSuccessSummary
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
      true, // includePassed - show passed tests
      true, // includeSkipped - show skipped tests
      true, // detailedSummary
      false, // flakySummary
      false, // verboseSummary
      false // skipSuccessSummary
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
      true, // detailedSummary
      true, // flakySummary
      true, // includeTimeInSummary
      false // onlyShowFailures
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

  it('should render error-only test failures in summary and details', async () => {
    const testResult = await parseTestReports(
      'errors-check',
      'summary',
      'test_results/multiple_failures/test_multiple_errors.xml',
      '*',
      true,
      true,
      false,
      [],
      undefined,
      '/'
    )

    const [table, detailTable] = buildSummaryTables(
      [testResult],
      true, // includePassed
      true, // includeSkipped
      true, // detailedSummary
      false, // flakySummary
      false, // verboseSummary
      false // skipSuccessSummary
    )

    expect(table).toStrictEqual([
      [
        {data: '', header: true},
        {data: 'Tests', header: true},
        {data: 'Passed ☑️', header: true},
        {data: 'Skipped', header: true},
        {data: 'Failed ❌️', header: true},
        {data: 'Time ⏱', header: true}
      ],
      ['errors-check', '3 ran', '1 passed', '0 skipped', '2 failed', '40ms']
    ])

    const detailFlat = detailTable.flat()
    expect(detailFlat).toContain('src/test.ts.testWithMultipleErrors (failure 1/2)')
    expect(detailFlat).toContain('src/test.ts.testWithMultipleErrors (failure 2/2)')
    expect(detailFlat).toContain('src/assertion.ts.testWithFailureAndError (failure 1/2)')
    expect(detailFlat).toContain('src/runtime.ts.testWithFailureAndError (failure 2/2)')

    const failureEntries = detailFlat.filter(cell => typeof cell === 'string' && cell === '❌ failure')
    expect(failureEntries).toHaveLength(4)
  })
  describe('failed summary', () => {
    const defaults = {
      includePassed: true,
      detailedSummary: true,
      verboseSummary: false,
      groupSuite: false,
      includeTimeInSummary: true,
      failedSummary: true,
      failedSummaryLogs: true
    }
    const buildFailures = (testResult: TestResult, options: Partial<typeof defaults> = {}) => {
      const config = {...defaults, ...options}
      const [table, details, flaky, renderFailures] = buildSummaryTables(
        [testResult],
        config.includePassed,
        true,
        config.detailedSummary,
        false,
        config.verboseSummary,
        false,
        config.groupSuite,
        true,
        config.includeTimeInSummary,
        false,
        config.failedSummary,
        config.failedSummaryLogs
      )
      return [table, details, flaky, renderFailures()] as const
    }
    const parseFailing = () =>
      parseTestReports(
        'checkName',
        'summary',
        'test_results/tests/utils/target/surefire-reports/TEST-action.surefire.report.calc.StringUtilsTest.xml',
        '*',
        true,
        true,
        true,
        [],
        undefined,
        '/'
      )

    it('lists failed tests with logs in collapsible blocks', async () => {
      const testResult = await parseFailing()
      const [, detailTable, , failedSection] = buildFailures(testResult)
      expect(failedSection).toContain('<p><strong>Failed tests</strong></p>')
      expect(failedSection).toContain('<details><summary>❌ <strong>checkName</strong> › <code>')
      expect(failedSection).toContain('<pre>')
      expect(failedSection).not.toMatch(/\s<\/pre>/)
      expect(failedSection).toMatch(/StringUtilsTest\.java<\/code> › <code>require_fail<\/code>/)
      expect(detailTable.flat().some(cell => typeof cell === 'string' && cell.includes('<details>'))).toBe(false)
    })

    it('preserves escaped check names for identical failures from different reports, even without room for logs', async () => {
      const testResult = await parseFailing()
      const first = testResult.globalAnnotations.find(annotation => annotation.status === 'failure')!
      const reports = ['Linux <debug>', 'Windows & release'].map(checkName => ({
        ...testResult,
        checkName,
        globalAnnotations: [{...first, raw_details: 'x'.repeat(50000)}],
        testResults: []
      }))
      const [, , , renderFailures] = buildSummaryTables(
        reports,
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        true,
        true,
        false,
        true,
        true
      )
      for (const budget of [1000, 50000]) {
        const html = renderFailures(budget)
        expect(html.length).toBeLessThanOrEqual(budget)
        expect(html).toContain('<strong>Linux &lt;debug&gt;</strong> › <code>')
        expect(html).toContain('<strong>Windows &amp; release</strong> › <code>')
        expect(html.match(/<code>require_fail<\/code>/g)).toHaveLength(2)
        expect(html).toContain('Logs omitted for 2 failed tests')
      }
    })

    it('keeps failed tests in the table when failed_summary_logs is false', async () => {
      const testResult = await parseFailing()
      const [, detailTable, , failedSection] = buildFailures(testResult, {failedSummaryLogs: false})
      expect(failedSection).toBe('')
      expect(detailTable.flat().some(cell => typeof cell === 'string' && cell.includes('❌ failure'))).toBe(true)
    })

    it('removes failed tests from the table when shown inline', async () => {
      const testResult = await parseFailing()
      const [, detailTable, , failedSection] = buildFailures(testResult)
      expect(failedSection).toContain('<details>')
      expect(detailTable.flat().some(cell => typeof cell === 'string' && cell.includes('❌ failure'))).toBe(false)
    })

    it('removes failed tests from the table when failed_summary is false', async () => {
      const testResult = await parseFailing()
      const [, detailTable, , failedSection] = buildFailures(testResult, {failedSummary: false})
      expect(failedSection).toBe('')
      expect(detailTable.flat().some(cell => typeof cell === 'string' && cell.includes('❌ failure'))).toBe(false)
    })

    it('does not report missing annotations for a suite with only failures shown inline', async () => {
      const testResult = await parseFailing()
      testResult.globalAnnotations = testResult.globalAnnotations.filter(a => a.status === 'failure')
      const [, detailTable] = buildFailures(testResult, {verboseSummary: true})
      expect(JSON.stringify(detailTable)).not.toContain('No test annotations available')
    })

    it('returns no details table when only failures were shown inline', async () => {
      const testResult = await parseFailing()
      testResult.globalAnnotations = testResult.globalAnnotations.filter(a => a.status === 'failure')
      testResult.testResults = []
      for (const groupSuite of [false, true]) {
        const [, detailTable, , failedSection] = buildFailures(testResult, {includePassed: false, groupSuite})
        expect(detailTable).toHaveLength(0)
        expect(failedSection).toContain('<details>')
      }
    })

    it('strips the title prefix when the path has a test_files_prefix', async () => {
      const testResult = await parseFailing()
      testResult.globalAnnotations = testResult.globalAnnotations.map(a => ({
        ...a,
        path: `packages/app/${a.path}`,
        title: a.title.replace(
          /^StringUtilsTest\./,
          'test_results/tests/utils/src/test/java/action/surefire/report/calc/StringUtilsTest.java.'
        )
      }))
      const [, , , failedSection] = buildFailures(testResult)
      expect(failedSection).toMatch(/StringUtilsTest\.java<\/code> › <code>require_fail/)
    })

    it('collects failures nested in sub test results', async () => {
      const testResult = await parseFailing()
      const failed = testResult.globalAnnotations.filter(a => a.status === 'failure')
      testResult.testResults = [
        {
          name: 'suite',
          totalCount: failed.length,
          skippedCount: 0,
          failedCount: failed.length,
          passedCount: 0,
          retriedCount: 0,
          time: 0,
          annotations: [],
          globalAnnotations: [],
          testResults: [
            {
              name: 'nested',
              totalCount: failed.length,
              skippedCount: 0,
              failedCount: failed.length,
              passedCount: 0,
              retriedCount: 0,
              time: 0,
              annotations: failed,
              globalAnnotations: [],
              testResults: []
            }
          ]
        }
      ]
      testResult.globalAnnotations = []
      const [, detailTable, , failedSection] = buildFailures(testResult, {
        includePassed: false,
        verboseSummary: true,
        groupSuite: true
      })
      expect(failedSection).toContain('<code>require_fail</code>')
      expect(JSON.stringify(detailTable)).not.toContain('No test annotations available')
    })

    it('keeps the missing annotations note when verbose and nothing is shown', async () => {
      const testResult = await parseFailing()
      testResult.globalAnnotations = []
      testResult.testResults = []
      const [, detailTable] = buildFailures(testResult, {verboseSummary: true})
      expect(JSON.stringify(detailTable)).toContain('No test annotations available')
    })

    it.each([false, true])('hides failure durations when time is disabled, oversized logs: %s', async oversizedLogs => {
      const testResult = await parseFailing()
      if (oversizedLogs) {
        testResult.globalAnnotations.forEach(annotation => {
          annotation.raw_details = 'x'.repeat(50000)
        })
      }
      const [, , , failedSection] = buildFailures(testResult, {includeTimeInSummary: false})
      expect(failedSection).toContain(oversizedLogs ? '<p>❌ ' : '<details>')
      expect(failedSection).not.toContain('<i>')
    })

    it('shows 0ms when the test has no duration', async () => {
      const testResult = await parseFailing()
      testResult.globalAnnotations = testResult.globalAnnotations.map(a => ({...a, time: 0}))
      const [, , , failedSection] = buildFailures(testResult)
      expect(failedSection).toContain('<i>(0ms)</i>')
    })

    it('shows nothing inline without detailed_summary', async () => {
      const testResult = await parseFailing()
      const [, , , failedSection] = buildFailures(testResult, {detailedSummary: false})
      expect(failedSection).toBe('')
    })

    it('groups multiple failures of one testcase into a single entry', async () => {
      const testResult = await parseTestReports(
        'errors-check',
        'summary',
        'test_results/multiple_failures/test_multiple_errors.xml',
        '*',
        true,
        true,
        false,
        [],
        undefined,
        '/'
      )
      const [, , , failedSection] = buildFailures(testResult)
      expect(failedSection.match(/<code>testWithMultipleErrors<\/code>/g)).toHaveLength(1)
      expect(failedSection).toContain('<code>src/test.ts</code> › <code>testWithMultipleErrors</code>')
      expect(failedSection).toContain('First timeout')
      expect(failedSection).toContain('Second timeout')
      expect(failedSection).not.toContain('(failure 1/2)')
    })

    it('strips the class prefix for windows style paths', async () => {
      const testResult = await parseFailing()
      testResult.globalAnnotations = testResult.globalAnnotations.map(a => ({
        ...a,
        path: a.path.replace(/\//g, '\\')
      }))
      const [, , , failedSection] = buildFailures(testResult)
      expect(failedSection).toMatch(/StringUtilsTest\.java<\/code> › <code>require_fail<\/code>/)
    })

    it('strips Windows-qualified paths without changing the test name', async () => {
      const testResult = await parseFailing()
      testResult.globalAnnotations.forEach(annotation => {
        annotation.path = 'packages\\app\\src\\test.ts'
        annotation.title = 'src\\test.ts.test\\name'
      })
      const [, , , failedSection] = buildFailures(testResult)
      expect(failedSection).toContain('<code>test\\name</code>')
      expect(failedSection).not.toContain('<code>src\\test.ts.test\\name</code>')
    })

    it('does not escape logs larger than the entire output budget', async () => {
      const testResult = await parseFailing()
      testResult.globalAnnotations.forEach(annotation => {
        annotation.raw_details = 'x'.repeat(1000000)
      })
      const escape = vi.spyOn(utils, 'escapeHtml')
      try {
        const [, , , failedSection] = buildFailures(testResult)
        expect(failedSection.length).toBeLessThanOrEqual(50000)
        expect(escape.mock.calls.every(([value]) => value.length <= 50000)).toBe(true)
      } finally {
        escape.mockRestore()
      }
    })

    it('fits whole entries and accurate hidden counts into each destination budget', async () => {
      const testResult = await parseFailing()
      const first = testResult.globalAnnotations.find(annotation => annotation.status === 'failure')!
      testResult.globalAnnotations = Array.from({length: 10000}, (_, index) => ({
        ...first,
        title: `test ${index}`,
        message: '',
        raw_details: ''
      }))
      testResult.testResults = []
      const [, , , renderFailures] = buildSummaryTables(
        [testResult],
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        true,
        true,
        false,
        true,
        true
      )
      for (const budget of [-1, 0, 10, 80, 120, 200, 500, 50000]) {
        const html = renderFailures(budget)
        expect(html.length).toBeLessThanOrEqual(Math.max(0, budget))
        expect((html.match(/<details>/g) ?? []).length).toBe((html.match(/<\/details>/g) ?? []).length)
        if (html) {
          const shown = (html.match(/❌ /g) ?? []).length
          expect(html).toContain(`… ${10000 - shown} more failed tests not shown`)
        }
      }
    })

    it('drops logs once the size budget is reached', async () => {
      const testResult = await parseFailing()
      const big = 'x'.repeat(30000)
      const failed = testResult.globalAnnotations.filter(a => a.status === 'failure')
      testResult.globalAnnotations = failed.map(a => ({...a, raw_details: big}))
      const [, , , failedSection] = buildFailures(testResult)
      expect(failedSection.length).toBeLessThanOrEqual(50000)
      expect(failedSection).toContain('<details>')
      expect(failedSection).toContain('<p>❌ ')
      expect(failedSection).toContain('Logs omitted for')
    })

    it('is empty when failed_summary_logs is not enabled (default)', async () => {
      const testResult = await parseFailing()
      const [, , , renderFailures] = buildSummaryTables([testResult], true, true, true, false, false, false)
      expect(renderFailures()).toBe('')
    })
  })
})
