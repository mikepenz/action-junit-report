import {createRequire} from 'node:module'
import {expect, it} from 'vitest'
import {parseTestReports} from '../src/testParser.js'

it('keeps brace patterns working for legacy and current minimatch callers', () => {
  const require = createRequire(import.meta.url)
  const legacyMinimatch = createRequire(require.resolve('@eslint/eslintrc'))('minimatch')
  const currentMinimatch = createRequire(import.meta.resolve('@actions/glob'))('minimatch').minimatch
  for (const minimatch of [legacyMinimatch, currentMinimatch]) {
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
