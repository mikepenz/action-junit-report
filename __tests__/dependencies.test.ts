import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {expect, it} from 'vitest'
import {parseTestReports} from '../src/testParser.js'

it('keeps every minimatch and brace-expansion dependency on the current major', () => {
  const {packages} = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
  for (const [path, dependency] of Object.entries(packages)) {
    if (path.endsWith('/node_modules/minimatch') || path === 'node_modules/minimatch') {
      expect((dependency as {version: string}).version).toMatch(/^10\./)
    }
    if (path.endsWith('/node_modules/brace-expansion') || path === 'node_modules/brace-expansion') {
      expect((dependency as {version: string}).version).toMatch(/^5\./)
    }
  }
})

it('keeps brace patterns working for runtime minimatch callers', () => {
  const require = createRequire(import.meta.url)
  const reportMinimatch = createRequire(require.resolve('glob/raw'))('minimatch').minimatch
  const currentMinimatch = createRequire(import.meta.resolve('@actions/glob'))('minimatch').minimatch
  for (const minimatch of [reportMinimatch, currentMinimatch]) {
    expect(minimatch('a.js', '{a,b}.js')).toBe(true)
    expect(minimatch('c.js', '{a,b}.js')).toBe(false)
  }
})

it('handles deeply nested braces in report paths without exhausting the stack', async () => {
  const pattern = '{'.repeat(4000) + 'a,b' + '}'.repeat(4000)
  await expect(
    parseTestReports('check', '', pattern, '*', false, false, false, [], undefined, '/')
  ).resolves.toMatchObject({
    foundFiles: 0,
    totalCount: 0
  })
})
