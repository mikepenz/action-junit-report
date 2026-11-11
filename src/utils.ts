import * as core from '@actions/core'
import {Transformer} from './testParser.js'
import {SummaryTableRow} from './types.js'

export function retrieve(name: string, items: string[], index: number, total: number): string {
  if (total > 1) {
    if (items.length !== 0 && items.length !== total) {
      core.warning(`${name} has a different number of items than the 'reportPaths' input. This is usually a bug.`)
    }

    if (items.length === 0) {
      return ''
    } else if (items.length === 1) {
      return items[0].replace('\n', '')
    } else if (items.length > index) {
      return items[index].replace('\n', '')
    } else {
      core.error(`${name} has no valid config for position ${index}.`)
      return ''
    }
  } else if (items.length === 1) {
    return items[0].replace('\n', '')
  } else {
    return ''
  }
}

/**
 * Splits a list input on newlines and commas, trimming and dropping empty entries.
 * Historically `exclude_sources` was documented as comma separated, both are accepted.
 */
export function splitList(items: string[]): string[] {
  return items
    .flatMap(item => item.split(','))
    .map(item => item.trim())
    .filter(item => item !== '')
}

/**
 * Reads in the configuration from the JSON file
 */
export function readTransformers(raw: string | undefined): Transformer[] {
  if (!raw) {
    return []
  }
  try {
    const transformers: Transformer[] = JSON.parse(raw)
    for (const transformer of transformers) {
      try {
        transformer.regex = new RegExp(transformer.searchValue.replace('\\\\', '\\'), 'gu')
      } catch (error: unknown) {
        core.warning(`⚠️ Bad replacer regex: ${transformer.searchValue} (${error})`)
      }
    }
    return transformers
  } catch (error: unknown) {
    core.info(`⚠️ Transformers provided, but they couldn't be parsed. Fallback to Defaults. (${error})`)
    core.debug(`  Provided input: ${raw}`)
    return []
  }
}

export function applyTransformer(transformer: Transformer, string: string): string {
  const regExp = transformer.regex
  if (regExp) {
    return string.replace(regExp, transformer.replaceValue)
  } else {
    return string.replace(transformer.searchValue, transformer.replaceValue)
  }
}

/**
 * Function extracted from: https://github.com/actions/toolkit/blob/main/packages/core/src/summary.ts#L229
 */
export function buildLink(text: string, href: string): string {
  return wrap('a', text, {href})
}

/**
 * Function extracted from: https://github.com/actions/toolkit/blob/main/packages/core/src/summary.ts#L229
 */
export function buildList(items: string[], ordered = false): string {
  const tag = ordered ? 'ol' : 'ul'
  const listItems = items.map(item => wrap('li', item)).join('')
  const element = wrap(tag, listItems)
  return element
}

/**
 * Function extracted from: https://github.com/actions/toolkit/blob/main/packages/core/src/summary.ts#L229
 *
 * If the table is longer than `maxLength`, it keeps the leading rows that fit and notes how many rows were left out.
 * Returns an empty string if not even the first row fits.
 */
export function buildTable(rows: SummaryTableRow[], maxLength = Number.POSITIVE_INFINITY): string {
  const tableRows = rows.map(buildTableRow)
  const emptyLength = wrap('table', '').length
  if (tableRows.reduce((length, row) => length + row.length, emptyLength) <= maxLength) {
    return wrap('table', tableRows.join(''))
  }

  // the note spans the columns of the header row
  const colspan = `${rows[0]?.length ?? 1}`
  const omittedRow = (count: number): string =>
    buildTableRow([{data: `<em>… ${count} more rows not shown (size limit)</em>`, colspan}])
  // reserve the space of the note for the largest possible count
  let length = emptyLength + omittedRow(tableRows.length).length
  let kept = 0
  while (kept < tableRows.length && length + tableRows[kept].length <= maxLength) {
    length += tableRows[kept].length
    kept++
  }
  if (kept === 0) return ''
  return wrap('table', tableRows.slice(0, kept).join('') + omittedRow(tableRows.length - kept))
}

function buildTableRow(row: SummaryTableRow): string {
  const cells = row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((cell: any) => {
      if (typeof cell === 'string') {
        return wrap('td', cell)
      }

      const {header, data, colspan, rowspan} = cell
      const tag = header ? 'th' : 'td'
      const attrs = {
        ...(colspan && {colspan}),
        ...(rowspan && {rowspan})
      }

      return wrap(tag, data, attrs)
    })
    .join('')

  return wrap('tr', cells)
}

export function escapeHtml(value: string): string {
  // Raw blank lines end HTML blocks in Markdown and can activate injected links or images.
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '&#13;')
    .replace(/\n/g, '&#10;')
}

/**
 * Wraps content in an HTML tag, adding any HTML attributes
 *
 * @param {string} tag HTML tag to wrap
 * @param {string | null} content content within the tag
 * @param {[attribute: string]: string} attrs key-value list of HTML attributes to add
 *
 * @returns {string} content wrapped in HTML element
 */
function wrap(tag: string, content: string | null, attrs: {[attribute: string]: string} = {}): string {
  const htmlAttrs = Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('')

  // only void tags (explicit `null` content) are self-closing; an empty string still needs a closing tag
  if (content === null) {
    return `<${tag}${htmlAttrs}>`
  }

  return `<${tag}${htmlAttrs}>${content}</${tag}>`
}

/**
 * Shortens the string to at most `maxLength` characters, marking the cut with `…`.
 * Counts code points, so surrogate pairs are never split.
 */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  const chars = Array.from(value)
  if (chars.length <= maxLength) return value
  return `${chars.slice(0, maxLength - 1).join('')}…`
}

/**
 * Shortens the string to at most `maxBytes` bytes in UTF-8, marking the cut with `…`.
 * Only complete characters are kept.
 */
export function truncateBytes(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return value
  const ellipsis = '…'
  // encodeInto only writes complete characters, `read` is the length of the prefix that fits
  const {read} = new TextEncoder().encodeInto(value, new Uint8Array(maxBytes - Buffer.byteLength(ellipsis, 'utf8')))
  return `${value.slice(0, read)}${ellipsis}`
}

/**
 * Removes a specified prefix from the beginning of a string.
 *
 * @param {string} str - The original string.
 * @param {string} prefix - The prefix to be removed.
 * @returns {string} - The string without the prefix if it was present, otherwise the original string.
 */
export function removePrefix(str: string, prefix: string): string {
  if (prefix.length === 0) return str
  if (str.startsWith(prefix)) {
    return str.slice(prefix.length)
  }
  return str
}

/**
 * Formats a time in seconds into a human-readable string representation.
 * If the input is 0, returns an empty string.
 * Otherwise, converts seconds to days, hours, minutes, seconds, and milliseconds,
 * and includes only non-zero units in the output.
 *
 * @param {number} timeS - The time in seconds to format.
 * @returns {string} A formatted string representation of the time (e.g., "1h 30m 45s").
 */
export function toFormatedTime(timeS: number): string {
  if (timeS === 0) return ''
  let ms = timeS * 1000

  if (ms < 0) ms = -ms
  const time = {
    day: Math.floor(ms / 86400000),
    h: Math.floor(ms / 3600000) % 24,
    m: Math.floor(ms / 60000) % 60,
    s: Math.floor(ms / 1000) % 60,
    ms: Math.floor(ms) % 1000
  }
  return Object.entries(time)
    .filter(val => val[1] !== 0)
    .map(([key, val]) => `${val}${key}${val > 0 && key === 'day' ? 's' : ''}`)
    .join(' ')
}
