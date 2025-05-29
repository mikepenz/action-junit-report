import * as core from '@actions/core'
import {Transformer} from './testParser.js'
import {SummaryTableRow} from '@actions/core/lib/summary.js'

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
 */
export function buildTable(rows: SummaryTableRow[]): string {
  const tableBody = rows
    .map(row => {
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
    })
    .join('')

  return wrap('table', tableBody)
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

  if (!content) {
    return `<${tag}${htmlAttrs}>`
  }

  return `<${tag}${htmlAttrs}>${content}</${tag}>`
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
