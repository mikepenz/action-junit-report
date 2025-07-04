import {jest} from '@jest/globals'
import {attachComment, buildCommentIdentifier} from '../src/annotator.js'
import * as core from '@actions/core'

/**
 *   Copyright 2024 Mike Penz
 */
jest.setTimeout(30000)

// Mock the context object
jest.mock('@actions/github/lib/utils.js', () => ({
  context: {
    issue: {number: undefined},
    repo: {owner: 'test-owner', repo: 'test-repo'}
  }
}))

describe('attachComment', () => {
  let mockOctokit: any
  let mockWarning: jest.SpiedFunction<typeof core.warning>
  let mockContext: any

  beforeEach(() => {
    // Import context after mocking
    const {context} = require('@actions/github/lib/utils.js')
    mockContext = context
    
    // Mock core.warning
    mockWarning = jest.spyOn(core, 'warning').mockImplementation(() => {})
    
    // Mock octokit
    mockOctokit = {
      paginate: jest.fn(),
      rest: {
        issues: {
          listComments: jest.fn(),
          createComment: jest.fn(),
          updateComment: jest.fn()
        }
      }
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should use pr_id when provided and context.issue.number is not available', async () => {
    // Setup: no context issue number
    mockContext.issue.number = undefined

    mockOctokit.paginate.mockResolvedValue([])

    const checkName = ['Test Check']
    const table = [['Test', 'Result'], ['Example Test', 'Passed']]
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
    mockContext.issue.number = 456

    mockOctokit.paginate.mockResolvedValue([])

    const checkName = ['Test Check']
    const table = [['Test', 'Result'], ['Example Test', 'Passed']]

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
    mockContext.issue.number = undefined

    const checkName = ['Test Check']
    const table = [['Test', 'Result'], ['Example Test', 'Passed']]

    await attachComment(mockOctokit, checkName, false, table, [], [], [])

    // Verify warning was called and no comment was created
    expect(mockWarning).toHaveBeenCalledWith(
      expect.stringContaining('Action requires a valid issue number (PR reference) or pr_id input')
    )
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
  })

  it('should update existing comment when updateComment is true', async () => {
    // Setup: context issue number available
    mockContext.issue.number = 456

    const existingComment = {
      id: 999,
      body: 'Existing comment <!-- Summary comment for ["Test Check"] by mikepenz/action-junit-report -->'
    }
    mockOctokit.paginate.mockResolvedValue([existingComment])

    const checkName = ['Test Check']
    const table = [['Test', 'Result'], ['Example Test', 'Updated']]

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
})

describe('buildCommentIdentifier', () => {
  it('should build correct identifier', () => {
    const checkName = ['Test Check']
    const identifier = buildCommentIdentifier(checkName)
    expect(identifier).toBe('<!-- Summary comment for ["Test Check"] by mikepenz/action-junit-report -->')
  })
})