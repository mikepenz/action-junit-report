import {vi, describe, it, expect, beforeEach, afterEach} from 'vitest'
import {attachComment, buildCommentIdentifier} from '../src/annotator.js'
import * as core from '@actions/core'

/**
 *   Copyright 2024 Mike Penz
 */

// Mock the context object with a mutable reference
const mockContextData = vi.hoisted(() => ({
  issue: {number: undefined as number | undefined},
  repo: {owner: 'test-owner', repo: 'test-repo'}
}))

vi.mock('@actions/github/lib/utils.js', () => ({
  context: mockContextData
}))

describe('attachComment', () => {
  let mockOctokit: any
  let mockWarning: any

  beforeEach(() => {
    // Reset mock context
    mockContextData.issue.number = undefined
    mockContextData.repo.owner = 'test-owner'
    mockContextData.repo.repo = 'test-repo'

    // Mock core.warning
    mockWarning = vi.spyOn(core, 'warning').mockImplementation(() => {})

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
    vi.restoreAllMocks()
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
