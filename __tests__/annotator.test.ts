import {vi, describe, it, expect, beforeEach, afterEach} from 'vitest'
import {annotateTestResult, attachComment, buildCommentIdentifier} from '../src/annotator.js'
import {buildSummaryTables} from '../src/table.js'
import {parseTestReports, TestResult} from '../src/testParser.js'

/**
 *   Copyright 2024 Mike Penz
 */

// Mock the context object with a mutable reference
const mockContextData = vi.hoisted(() => ({
  issue: {number: undefined as number | undefined},
  repo: {owner: 'test-owner', repo: 'test-repo'},
  serverUrl: 'https://github.com'
}))

// Mock the octokit returned by github.getOctokit
const mockGetOctokit = vi.hoisted(() => vi.fn())

// Mock core.warning function
const mockWarning = vi.hoisted(() => vi.fn())

vi.mock('@actions/core', async () => {
  const actual = await vi.importActual('@actions/core')
  return {
    ...actual,
    warning: mockWarning
  }
})

vi.mock('@actions/github', async () => {
  const actual = await vi.importActual('@actions/github')
  return {
    ...actual,
    context: mockContextData,
    getOctokit: mockGetOctokit
  }
})

describe('attachComment', () => {
  let mockOctokit: any

  beforeEach(() => {
    // Reset mock context
    mockContextData.issue.number = undefined
    mockContextData.repo.owner = 'test-owner'
    mockContextData.repo.repo = 'test-repo'

    // Clear mock warning calls
    mockWarning.mockClear()

    // Mock octokit
    mockOctokit = {
      paginate: vi.fn(),
      rest: {
        issues: {
          listComments: vi.fn(),
          createComment: vi.fn(),
          updateComment: vi.fn()
        }
      }
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('drops logs before hiding failures when tables leave little comment space', async () => {
    const result = await parseTestReports(
      'check',
      '',
      'test_results/multiple_failures/test_multiple_errors.xml',
      '*',
      true,
      true,
      false,
      [],
      undefined,
      '/'
    )
    result.globalAnnotations[0].raw_details = 'x'.repeat(20000)
    const [, , , renderFailures] = buildSummaryTables(
      [result],
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
    await attachComment(mockOctokit, ['check'], false, [['x'.repeat(55000)]], [], [], [], '123', renderFailures)
    const body = mockOctokit.rest.issues.createComment.mock.calls[0][0].body
    expect(body.length).toBeLessThanOrEqual(65536)
    expect(body).toContain('<code>testWithMultipleErrors</code>')
    expect(body).toContain('<code>testWithFailureAndError</code>')
    expect(body).toContain('Logs omitted for')
  })

  it('should use pr_id when provided and context.issue.number is not available', async () => {
    // Setup: no context issue number
    mockContextData.issue.number = undefined

    mockOctokit.paginate.mockResolvedValue([])

    const checkName = ['Test Check']
    const table = [
      ['Test', 'Result'],
      ['Example Test', 'Passed']
    ]
    const prId = '123'

    await attachComment(mockOctokit, checkName, false, table, [], [], [], prId)

    // Verify comment was created with correct issue number
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: expect.stringContaining('Example Test')
    })

    expect(mockWarning).not.toHaveBeenCalled()
  })

  it('should fall back to context.issue.number when pr_id is not provided', async () => {
    // Setup: context issue number available
    mockContextData.issue.number = 456

    mockOctokit.paginate.mockResolvedValue([])

    const checkName = ['Test Check']
    const table = [
      ['Test', 'Result'],
      ['Example Test', 'Passed']
    ]

    await attachComment(mockOctokit, checkName, false, table, [], [], [])

    // Verify comment was created with context issue number
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 456,
      body: expect.stringContaining('Example Test')
    })

    expect(mockWarning).not.toHaveBeenCalled()
  })

  it('should warn and return early when no issue number is available', async () => {
    // Setup: no context issue number and no pr_id
    mockContextData.issue.number = undefined

    const checkName = ['Test Check']
    const table = [
      ['Test', 'Result'],
      ['Example Test', 'Passed']
    ]

    await attachComment(mockOctokit, checkName, false, table, [], [], [])

    // Verify warning was called and no comment was created
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Action requires a valid issue number (PR reference) or pr_id input')
    )
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
  })

  it('should update existing comment when updateComment is true', async () => {
    // Setup: context issue number available
    mockContextData.issue.number = 456

    const existingComment = {
      id: 999,
      body: 'Existing comment <!-- Summary comment for ["Test Check"] by mikepenz/action-junit-report -->'
    }
    mockOctokit.paginate.mockResolvedValue([existingComment])

    const checkName = ['Test Check']
    const table = [
      ['Test', 'Result'],
      ['Example Test', 'Updated']
    ]

    await attachComment(mockOctokit, checkName, true, table, [], [], [])

    // Verify comment was updated
    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      comment_id: 999,
      body: expect.stringContaining('Example Test')
    })
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
  })
  it('should warn and return early when pr_id is invalid', async () => {
    // Setup: no context issue number and invalid pr_id
    mockContextData.issue.number = undefined

    const checkName = ['Test Check']
    const table = [
      ['Test', 'Result'],
      ['Example Test', 'Passed']
    ]
    const prId = 'invalid-number'

    await attachComment(mockOctokit, checkName, false, table, [], [], [], prId)

    // Verify warning was called and no comment was created
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Action requires a valid issue number (PR reference) or pr_id input')
    )
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
  })

  it('should handle pr_id with leading/trailing whitespace', async () => {
    // Setup: no context issue number
    mockContextData.issue.number = undefined

    mockOctokit.paginate.mockResolvedValue([])

    const checkName = ['Test Check']
    const table = [
      ['Test', 'Result'],
      ['Example Test', 'Passed']
    ]
    const prId = '  123  '

    await attachComment(mockOctokit, checkName, false, table, [], [], [], prId)

    // Verify comment was created with correct issue number (whitespace trimmed)
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: expect.stringContaining('Example Test')
    })

    expect(mockWarning).not.toHaveBeenCalled()
  })

  it('should update existing comment when pr_id is provided and updateComment is true', async () => {
    // Setup: no context issue number but pr_id provided
    mockContextData.issue.number = undefined

    const existingComment = {
      id: 888,
      body: 'Existing comment <!-- Summary comment for ["Test Check"] by mikepenz/action-junit-report -->'
    }
    mockOctokit.paginate.mockResolvedValue([existingComment])

    const checkName = ['Test Check']
    const table = [
      ['Test', 'Result'],
      ['Example Test', 'Updated']
    ]
    const prId = '789'

    await attachComment(mockOctokit, checkName, true, table, [], [], [], prId)

    // Verify paginate was called with correct issue number
    expect(mockOctokit.paginate).toHaveBeenCalledWith(mockOctokit.rest.issues.listComments, {
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 789
    })

    // Verify comment was updated
    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      comment_id: 888,
      body: expect.stringContaining('Example Test')
    })
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
  })
})

describe('buildCommentIdentifier', () => {
  it('should build correct identifier', () => {
    const checkName = ['Test Check']
    const identifier = buildCommentIdentifier(checkName)
    expect(identifier).toBe('<!-- Summary comment for ["Test Check"] by mikepenz/action-junit-report -->')
  })
})

const buildTestResult = (annotationCount: number, totalCount = 100): TestResult => ({
  checkName: 'JUnit Test Report',
  summary: 'summary text',
  totalCount,
  skipped: 0,
  failed: annotationCount,
  passed: totalCount - annotationCount,
  retried: 0,
  time: 0,
  foundFiles: 1,
  globalAnnotations: Array.from({length: annotationCount}, (_, i) => ({
    path: 'src/Test.java',
    start_line: i + 1,
    end_line: i + 1,
    start_column: 0,
    end_column: 0,
    retries: 0,
    annotation_level: 'failure' as const,
    status: 'failure' as const,
    title: `Test.test${i}`,
    message: `failure ${i}`,
    raw_details: '',
    time: 0
  })),
  testResults: []
})

describe('annotateTestResult with update_check', () => {
  let mockOctokit: any

  beforeEach(() => {
    mockWarning.mockClear()
    mockOctokit = {
      rest: {
        checks: {
          listForRef: vi.fn().mockResolvedValue({data: {check_runs: [{id: 42}]}}),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn()
        }
      }
    }
    mockGetOctokit.mockReturnValue(mockOctokit)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('updates the check title and summary when there are no annotations', async () => {
    const checkInfo = await annotateTestResult(buildTestResult(0), 'token', 'sha', true, false, true, false, 'build')

    expect(mockOctokit.rest.checks.update).toHaveBeenCalledTimes(1)
    expect(mockOctokit.rest.checks.update).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      check_run_id: 42,
      output: {
        title: '100 tests run, 100 passed, 0 skipped, 0 failed.',
        summary: 'summary text',
        annotations: []
      }
    })
    expect(mockOctokit.rest.checks.create).not.toHaveBeenCalled()
    expect(checkInfo).toEqual({name: 'JUnit Test Report', url: 'https://github.com/test-owner/test-repo/runs/42'})
  })

  it('sends annotations in batches of 50', async () => {
    await annotateTestResult(buildTestResult(51), 'token', 'sha', true, false, true, false, 'build')

    const updates = mockOctokit.rest.checks.update.mock.calls
    expect(updates).toHaveLength(2)
    expect(updates[0][0].output.annotations).toHaveLength(50)
    expect(updates[1][0].output.annotations).toHaveLength(1)
  })

  it('updates the check without annotations when check_annotations is disabled', async () => {
    await annotateTestResult(buildTestResult(3), 'token', 'sha', false, false, true, false, 'build')

    expect(mockOctokit.rest.checks.update).toHaveBeenCalledTimes(1)
    expect(mockOctokit.rest.checks.update.mock.calls[0][0].output.annotations).toEqual([])
  })

  it('updates the in progress check matching job_name', async () => {
    mockOctokit.rest.checks.listForRef.mockResolvedValue({data: {check_runs: [{id: 42}]}})

    const checkInfo = await annotateTestResult(buildTestResult(0), 'token', 'sha', false, false, true, false, 'build')

    expect(mockOctokit.rest.checks.listForRef).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      ref: 'sha',
      check_name: 'build',
      status: 'in_progress',
      filter: 'latest'
    })
    expect(mockOctokit.rest.checks.update).toHaveBeenCalledTimes(1)
    expect(mockOctokit.rest.checks.update.mock.calls[0][0].check_run_id).toBe(42)
    expect(checkInfo).toEqual({name: 'JUnit Test Report', url: 'https://github.com/test-owner/test-repo/runs/42'})
  })

  it('warns and skips the update when no in progress check matches job_name', async () => {
    mockOctokit.rest.checks.listForRef.mockResolvedValue({data: {check_runs: []}})

    const checkInfo = await annotateTestResult(buildTestResult(0), 'token', 'sha', false, false, true, false, 'build')

    expect(checkInfo).toBeUndefined()
    expect(mockOctokit.rest.checks.update).not.toHaveBeenCalled()
    expect(mockOctokit.rest.checks.create).not.toHaveBeenCalled()
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining("No in progress check named 'build' found for sha")
    )
  })
})

describe('annotateTestResult creating a check', () => {
  let mockOctokit: any

  beforeEach(() => {
    mockOctokit = {
      rest: {
        checks: {
          listForRef: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({data: {id: 7}})
        }
      }
    }
    mockGetOctokit.mockReturnValue(mockOctokit)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates the check with all annotations when there are at most 50', async () => {
    const checkInfo = await annotateTestResult(buildTestResult(50), 'token', 'sha', true, false, false, false, 'build')

    expect(mockOctokit.rest.checks.create).toHaveBeenCalledTimes(1)
    expect(mockOctokit.rest.checks.create.mock.calls[0][0].output.annotations).toHaveLength(50)
    expect(mockOctokit.rest.checks.update).not.toHaveBeenCalled()
    expect(checkInfo).toEqual({name: 'JUnit Test Report', url: 'https://github.com/test-owner/test-repo/runs/7'})
  })

  it('appends the annotations beyond the first 50 to the created check', async () => {
    const testResult = buildTestResult(120, 200)
    await annotateTestResult(testResult, 'token', 'sha', true, false, false, false, 'build')

    expect(mockOctokit.rest.checks.create).toHaveBeenCalledTimes(1)
    const created = mockOctokit.rest.checks.create.mock.calls[0][0].output
    expect(created.annotations).toEqual(testResult.globalAnnotations.slice(0, 50))

    const updates = mockOctokit.rest.checks.update.mock.calls.map((call: any[]) => call[0])
    expect(updates).toHaveLength(2)
    for (const update of updates) {
      expect(update.check_run_id).toBe(7)
      expect(update.output.title).toBe(created.title)
      expect(update.output.summary).toBe('summary text')
    }
    expect(updates[0].output.annotations).toEqual(testResult.globalAnnotations.slice(50, 100))
    expect(updates[1].output.annotations).toEqual(testResult.globalAnnotations.slice(100))
  })

  it('keeps the created check when appending annotations fails', async () => {
    mockOctokit.rest.checks.update.mockRejectedValue(new Error('Validation Failed'))

    const checkInfo = await annotateTestResult(
      buildTestResult(120, 200),
      'token',
      'sha',
      true,
      false,
      false,
      false,
      'build'
    )

    expect(mockOctokit.rest.checks.update).toHaveBeenCalledTimes(1)
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('Validation Failed'))
    expect(checkInfo).toEqual({name: 'JUnit Test Report', url: 'https://github.com/test-owner/test-repo/runs/7'})
  })

  it('does not send annotations when check_annotations is disabled', async () => {
    await annotateTestResult(buildTestResult(120, 200), 'token', 'sha', false, false, false, false, 'build')

    expect(mockOctokit.rest.checks.create.mock.calls[0][0].output.annotations).toEqual([])
    expect(mockOctokit.rest.checks.update).not.toHaveBeenCalled()
  })
})
