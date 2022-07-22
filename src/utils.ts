import * as core from '@actions/core'

export function retrieve(name: string, items: string[], index: number, total: number): string {
  if (total > 1) {
    if (items.length !== 0 && items.length !== total) {
      core.warning(`${name} has a different number of items than the 'reportPaths' input. This is usually a bug.`)
    }

    if (items.length === 0) {
      return ''
    } else if (items.length === 1) {
      return items[0].replace("\n","")
    } else if (items.length > index) {
      return items[index].replace("\n","")
    } else {
      core.error(`${name} has no valid config for position ${index}.`)
      return ''
    }
  } else if (items.length === 1) {
    return items[0].replace("\n","")
  } else {
    return ''
  }
}
