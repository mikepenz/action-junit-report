import * as core from '@actions/core'
import {Transformer} from './testParser'

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
    return transformers
  } catch (error) {
    core.info(`⚠️ Transformers provided, but they couldn't be parsed. Fallback to Defaults.`)
    core.debug(`  Provided input: ${raw}`)
    return []
  }
}

export function applyTransformer(transformer: Transformer, string: string): string {
  try {
    const regExp = new RegExp(transformer.searchValue.replace('\\\\', '\\'), 'gu')
    return string.replace(regExp, transformer.replaceValue)
  } catch (e) {
    core.warning(`⚠️ Bad replacer regex: ${transformer.searchValue}`)
    return string.replace(transformer.searchValue, transformer.replaceValue)
  }
}
