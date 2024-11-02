import * as core from '@actions/core'
import {Transformer} from './testParser'
import {SummaryTableRow} from '@actions/core/lib/summary'

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
