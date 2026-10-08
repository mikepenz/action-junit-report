import {buildTable, escapeHtml, readTransformers, splitList} from '../src/utils.js'
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
})
