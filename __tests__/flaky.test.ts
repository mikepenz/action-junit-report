import {resolveFileAndLine, resolvePath, parseFile, Transformer, parseTestReports} from '../src/testParser'

/**
 * Original test cases:
 *   Copyright 2020 ScaCap
 *   https://github.com/ScaCap/action-surefire-report/blob/master/utils.test.js
 *
 * New test cases:
 *   Copyright Mike Penz
 */
jest.setTimeout(30000)

describe('resolveFileAndLine', () => {
  it('there should be two errors if retries are not handled', async () => {
    const {totalCount, skipped, annotations} = await parseFile(
      'test_results/junit-web-test/expectedRetries.xml',
      '',
      true,
      true
    )
    const filtered = annotations.filter(annotation => annotation.retries > 0)

    expect(totalCount).toBe(7)
    expect(skipped).toBe(1)
    expect(filtered).toStrictEqual([
      {
        path: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js',
        start_line: 15,
        end_line: 15,
        retries: 1,
        start_column: 0,
        end_column: 0,
        annotation_level: 'notice',
        status: 'success',
        title: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js.retried flaky test',
        message: 'retried flaky test',
        raw_details: ''
      }
    ])
  })
})
