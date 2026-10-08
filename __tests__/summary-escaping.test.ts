import {afterEach, describe, expect, it, vi} from 'vitest'
import * as core from '@actions/core'
import * as github from '@actions/github'
import {attachComment, attachSummary} from '../src/annotator.js'
import {parseTestReports} from '../src/testParser.js'
import {buildSummaryTables} from '../src/table.js'
import {buildTable} from '../src/utils.js'

vi.mock('@actions/github', async () => ({
  ...(await vi.importActual('@actions/github')),
  context: {repo: {owner: 'owner', repo: 'repo'}}
}))

afterEach(() => {
  core.summary.clear()
  vi.restoreAllMocks()
})

describe('summary HTML escaping', () => {
  it.each([false, true])('escapes XML values in every destination with group_suite=%s', async groupSuite => {
    const result = await parseTestReports(
      'check',
      '',
      'test_results/summary-escaping/report.xml',
      '*',
      true,
      true,
      true,
      [],
      '{{TEST_NAME}}',
      '/'
    )
    // group_reports=false promotes the XML suite name into the check name.
    result.checkName = `check | ${result.testResults[0].name}`
    const originalTitles = result.globalAnnotations.map(annotation => annotation.title)
    expect(originalTitles).toContain('image <img src=x>')
    expect(originalTitles).toContain('flaky <img src=x>')
    expect(originalTitles).toContain('literal &lt;img src=x&gt; & ordinary <value>')

    const [table, details, flaky] = buildSummaryTables([result], true, true, true, true, false, false, groupSuite)
    const checks = [{name: result.checkName, url: 'https://github.com/owner/repo/runs/123'}]
    vi.spyOn(core.summary, 'write').mockResolvedValue(core.summary)
    await attachSummary(table, details, flaky, checks)
    const jobSummary = core.summary.stringify()
    const createComment = vi.fn()
    const octokit = {rest: {issues: {createComment}}} as unknown as ReturnType<typeof github.getOctokit>
    await attachComment(octokit, ['check'], false, table, details, flaky, checks, '123')
    const comment = createComment.mock.calls[0][0].body as string

    for (const html of [buildTable(details), jobSummary, comment]) {
      expect(html).toContain('image &lt;img src=x&gt;')
      expect(html).toContain('flaky &lt;img src=x&gt;')
      expect(html).toContain('breakout &lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;&#10;&#10;[fake success]')
      expect(html).toContain('literal &amp;lt;img src=x&amp;gt; &amp; ordinary &lt;value&gt;')
      expect(html).toContain('ordinary test')
      expect(html).toContain('<strong>check | suite &lt;img src=x&gt;</strong>')
      expect(html).not.toContain('<img')
      if (groupSuite) expect(html).toContain('<em>nested &lt;b&gt;suite&lt;/b&gt;</em>')
    }
    expect(buildTable(table)).toContain('<td>check | suite &lt;img src=x&gt;</td>')
    expect(buildTable(flaky)).toContain('<td>flaky &lt;img src=x&gt;</td>')
    expect(buildTable(flaky)).not.toContain('<img')
    for (const html of [jobSummary, comment]) {
      expect(html).toContain(
        '<a href="https://github.com/owner/repo/runs/123">View check | suite &lt;img src=x&gt;</a>'
      )
    }
    expect(result.globalAnnotations.map(annotation => annotation.title)).toEqual(originalTitles)
    expect(result.testResults[0].name).toBe('suite <img src=x>')
  })
})
