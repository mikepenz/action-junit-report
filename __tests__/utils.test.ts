import {buildTable, escapeHtml, readTransformers, splitList, truncate, truncateBytes} from '../src/utils.js'
import {describe, expect, it} from 'vitest'

/**
 *   Copyright 2024 Mike Penz
 */

describe('splitList', () => {
  it('should split comma separated values', async () => {
    expect(splitList(['/build/,/__pycache__/'])).toStrictEqual(['/build/', '/__pycache__/'])
  })

  it('should keep newline separated values', async () => {
    expect(splitList(['/build/', '/__pycache__/'])).toStrictEqual(['/build/', '/__pycache__/'])
  })

  it('should handle mixed separators, whitespace and empty entries', async () => {
    expect(splitList([' /build/ , ', '', '/node_modules/,'])).toStrictEqual(['/build/', '/node_modules/'])
  })

  it('should return an empty array for empty input', async () => {
    expect(splitList([])).toStrictEqual([])
  })
})

describe('readTransformers', () => {
  it('should successfully parse default transformer', async () => {
    const transformer = readTransformers('[{"searchValue":"::","replaceValue":"/"}]')
    expect(transformer).toStrictEqual([
      {
        regex: /::/gu,
        searchValue: '::',
        replaceValue: '/'
      }
    ])
  })

  it('should successfully parse custom transformer', async () => {
    const transformer = readTransformers(
      '[{"searchValue":"\\\\.","replaceValue":"/"},{"searchValue":"_t\\\\z","replaceValue":".t"}]'
    )
    expect(transformer).toStrictEqual([
      {
        regex: /\./gu,
        searchValue: '\\.',
        replaceValue: '/'
      },
      {
        searchValue: '_t\\z',
        replaceValue: '.t'
      }
    ])
  })
})

describe('escapeHtml', () => {
  it.each(['\n', '\r\n', '\r'])('keeps Markdown payloads inside HTML text for %j line endings', newline => {
    const escapedNewline = newline === '\n' ? '&#10;' : newline === '\r' ? '&#13;' : '&#13;&#10;'
    expect(escapeHtml(`name${newline}${newline}![image](https://example.invalid)`)).toBe(
      `name${escapedNewline}${escapedNewline}![image](https://example.invalid)`
    )
  })

  it('preserves literal entities and ordinary text as HTML text', () => {
    expect(escapeHtml('A & B <value> "quoted" &lt;tag&gt;')).toBe(
      'A &amp; B &lt;value&gt; "quoted" &amp;lt;tag&amp;gt;'
    )
  })
})

describe('buildTable', () => {
  it('should close empty cells', async () => {
    expect(
      buildTable([
        [
          {data: '', header: true},
          {data: 'Tests', header: true}
        ],
        ['', 'A']
      ])
    ).toStrictEqual('<table><tr><th></th><th>Tests</th></tr><tr><td></td><td>A</td></tr></table>')
  })

  const rows = [
    [
      {data: 'Test', header: true},
      {data: 'Result', header: true}
    ],
    ['test1', 'passed'],
    ['test2', 'passed'],
    ['test3', 'passed'],
    ['test4', 'passed'],
    ['test5', 'passed']
  ]

  it('should keep tables within the length limit', async () => {
    const table = buildTable(rows)
    expect(buildTable(rows, table.length)).toBe(table)
  })

  it('should keep the leading rows that fit and note the omitted rows', async () => {
    const table = buildTable(rows, 200)
    expect(table).toBe(
      '<table><tr><th>Test</th><th>Result</th></tr><tr><td>test1</td><td>passed</td></tr>' +
        '<tr><td colspan="2"><em>… 4 more rows not shown (size limit)</em></td></tr></table>'
    )
    expect(table.length).toBeLessThanOrEqual(200)
  })

  it('should return an empty string if not even the first row fits', async () => {
    expect(buildTable(rows, 50)).toBe('')
  })
})

describe('truncate', () => {
  it('should keep values within the limit', async () => {
    expect(truncate('abc', 3)).toBe('abc')
  })

  it('should cut values above the limit and mark the cut', async () => {
    expect(truncate('abcdef', 4)).toBe('abc…')
  })

  it('should count characters instead of UTF-16 code units', async () => {
    expect(truncate('𝒜𝒜', 2)).toBe('𝒜𝒜')
    expect(truncate('𝒜𝒜𝒜', 2)).toBe('𝒜…')
  })
})

describe('truncateBytes', () => {
  it('should keep values within the limit', async () => {
    expect(truncateBytes('äb', 3)).toBe('äb')
  })

  it('should cut values above the limit and mark the cut', async () => {
    const truncated = truncateBytes('a'.repeat(20), 10)
    expect(truncated).toBe(`${'a'.repeat(7)}…`)
    expect(Buffer.byteLength(truncated, 'utf8')).toBe(10)
  })

  it('should not split multi-byte characters', async () => {
    // 'ä' takes 2 bytes, '…' takes 3 bytes: only 2 complete characters fit into 8 bytes
    const truncated = truncateBytes('äääää', 8)
    expect(truncated).toBe('ää…')
    expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(8)
    expect(truncateBytes('𝒜𝒜𝒜', 10)).toBe('𝒜…')
  })
})
