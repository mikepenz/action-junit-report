import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const outputs = vi.hoisted(() => ({warning: vi.fn(), setOutput: vi.fn(), setFailed: vi.fn()}))

vi.mock('@actions/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@actions/core')>()
  return {...actual, warning: outputs.warning, setOutput: outputs.setOutput, setFailed: outputs.setFailed}
})

const DEFAULT_INPUTS: Record<string, string> = {
  token: 'token',
  follow_symlink: 'false',
  truncate_stack_traces: 'true',
  resolve_ignore_classname: 'false',
  skip_annotations: 'true',
  job_summary: 'false',
  comment: 'false'
}

const REPORTS = 'test_results/exclude_report_paths/**/build/test-results/**/TEST-*.xml'

/** runs the action (the module starts `run()` on import) with the given inputs and returns the `total` and `failed` outputs */
async function runAction(inputs: Record<string, string>) {
  for (const [name, value] of Object.entries({...DEFAULT_INPUTS, ...inputs})) {
    process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] = value
  }
  vi.resetModules()
  await import('../src/main.js')
  await vi.waitFor(() => expect(outputs.setOutput).toHaveBeenCalledWith('flaky_summary', expect.anything()))
  const output = (name: string) => outputs.setOutput.mock.calls.find(([key]) => key === name)?.[1]
  return {total: output('total'), failed: output('failed')}
}

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('INPUT_')) delete process.env[key]
    }
  })

  it('should report all files without exclude_report_paths', async () => {
    const {total, failed} = await runAction({report_paths: 'test_results/exclude_report_paths/**/*.xml'})
    expect(total).toBe(3)
    expect(failed).toBe(1)
    expect(outputs.warning).not.toHaveBeenCalled()
  })

  it('should pass exclude_report_paths to the parser', async () => {
    const {total, failed} = await runAction({
      report_paths: REPORTS,
      exclude_report_paths: '**/build/project-tests/**'
    })
    expect(total).toBe(2)
    expect(failed).toBe(0)
    expect(outputs.setFailed).not.toHaveBeenCalled()
  })

  it('should apply every line of exclude_report_paths', async () => {
    const {total} = await runAction({
      report_paths: REPORTS,
      exclude_report_paths: '**/project-tests/**\n**/TEST-pkg.*.xml'
    })
    expect(total).toBe(0)
  })

  it('should apply exclude_report_paths to every report_paths line', async () => {
    const {total, failed} = await runAction({
      report_paths: `${REPORTS}\ntest_results/exclude_report_paths/build/project-tests/**/TEST-*.xml`,
      check_name: 'one\ntwo',
      exclude_report_paths: '**/build/project-tests/**'
    })
    expect(total).toBe(2)
    expect(failed).toBe(0)
  })

  it('should warn about negated report_paths and not treat them as an exclude', async () => {
    const {total, failed} = await runAction({
      report_paths: `${REPORTS}\n!**/build/project-tests/**`,
      check_name: 'one\ntwo'
    })
    expect(outputs.warning).toHaveBeenCalledTimes(1)
    expect(outputs.warning).toHaveBeenCalledWith(expect.stringContaining('exclude_report_paths'))
    expect(outputs.warning).toHaveBeenCalledWith(expect.stringContaining('!**/build/project-tests/**'))
    // the failing report is still included
    expect(total).toBe(3)
    expect(failed).toBe(1)
  })
})
