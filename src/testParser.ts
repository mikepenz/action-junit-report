import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs'
import * as parser from 'xml-js'

export interface TestResult {
  count: number
  skipped: number
  annotations: Annotation[]
}

export interface Annotation {
  path: string
  testcase: string
  start_line: number
  end_line: number
  start_column: number
  end_column: number
  annotation_level: 'failure' | 'notice' | 'warning'
  title: string
  message: string
  raw_details: string
}

export interface Position {
  fileName: string
  line: number
}

/**
 * Copyright 2020 ScaCap
 * https://github.com/ScaCap/action-surefire-report/blob/master/utils.js#L6
 *
 * Modification Copyright 2021 Mike Penz
 * https://github.com/mikepenz/action-junit-report/
 */
export async function resolveFileAndLine(
  file: string | null,
  line: string | null,
  className: string,
  output: String
): Promise<Position> {
  let fileName = file ? file : className.split('.').slice(-1)[0]
  const lineNumber = safeParseInt(line)
  try {
    if (fileName && lineNumber) {
      return {fileName, line: lineNumber}
    }

    const escapedFileName = fileName
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace('::', '/') // Rust test output contains colons between package names - See: https://github.com/mikepenz/action-junit-report/pull/359

    const matches = output.match(
      new RegExp(` [^ ]*${escapedFileName}.*?:\\d+`, 'g')
    )
    if (!matches) return {fileName, line: lineNumber || 1}

    const [lastItem] = matches.slice(-1)
    const lineTokens = lastItem.split(':')
    line = lineTokens.pop() || '0'

    // check, if the error message is from a rust file -- this way we have the chance to find
    // out the involved test file
    // See: https://github.com/mikepenz/action-junit-report/pull/360
    {
      const lineNumberPrefix = lineTokens.pop() || ''
      if (lineNumberPrefix.endsWith('.rs')) {
        fileName = lineNumberPrefix.split(' ').pop() || ''
      }
    }

    core.debug(`Resolved file ${fileName} and line ${line}`)

    return {fileName, line: safeParseInt(line) || -1}
  } catch (error) {
    core.warning(
      `⚠️ Failed to resolve file (${file}) and/or line (${line}) for ${className}`
    )
    return {fileName, line: safeParseInt(line) || -1}
  }
}

/**
 * Parse the provided string line number, and return its value, or null if it is not available or NaN.
 */
function safeParseInt(line: string | null): number | null {
  if (!line) return null
  const parsed = parseInt(line)
  if (isNaN(parsed)) return null
  return parsed
}

/**
 * Copyright 2020 ScaCap
 * https://github.com/ScaCap/action-surefire-report/blob/master/utils.js#L18
 *
 * Modification Copyright 2021 Mike Penz
 * https://github.com/mikepenz/action-junit-report/
 */
export async function resolvePath(
  fileName: string,
  excludeSources: string[]
): Promise<string> {
  core.debug(`Resolving path for ${fileName}`)
  const normalizedFilename = fileName.replace(/^\.\//, '') // strip relative prefix (./)
  const globber = await glob.create(`**/${normalizedFilename}.*`, {
    followSymbolicLinks: false
  })
  const searchPath = globber.getSearchPaths() ? globber.getSearchPaths()[0] : ''
  for await (const result of globber.globGenerator()) {
    core.debug(`Matched file: ${result}`)

    const found = excludeSources.find(v => result.includes(v))
    if (!found) {
      const path = result.slice(searchPath.length + 1)
      core.debug(`Resolved path: ${path}`)
      return path
    }
  }
  return normalizedFilename
}

/**
 * Copyright 2020 ScaCap
 * https://github.com/ScaCap/action-surefire-report/blob/master/utils.js#L43
 *
 * Modification Copyright 2021 Mike Penz
 * https://github.com/mikepenz/action-junit-report/
 */
export async function parseFile(
  file: string,
  suiteRegex = '',
  includePassed = false,
  excludeSources: string[] = ['/build/', '/__pycache__/'],
  checkRetries = false,
  checkTitleTemplate: string | undefined = undefined
): Promise<TestResult> {
  core.debug(`Parsing file ${file}`)

  const data: string = fs.readFileSync(file, 'utf8')
  const report = JSON.parse(parser.xml2json(data, {compact: true}))

  return parseSuite(
    report,
    '',
    suiteRegex,
    includePassed,
    excludeSources,
    checkRetries,
    checkTitleTemplate
  )
}

async function parseSuite(
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  suite: any,
  parentName: string,
  suiteRegex: string,
  includePassed = false,
  excludeSources: string[],
  checkRetries = false,
  checkTitleTemplate: string | undefined = undefined
): Promise<TestResult> {
  let count = 0
  let skipped = 0
  let annotations: Annotation[] = []

  if (!suite.testsuite && !suite.testsuites) {
    return {count, skipped, annotations}
  }

  const testsuites = suite.testsuite
    ? Array.isArray(suite.testsuite)
      ? suite.testsuite
      : [suite.testsuite]
    : Array.isArray(suite.testsuites.testsuite)
    ? suite.testsuites.testsuite
    : [suite.testsuites.testsuite]

  for (const testsuite of testsuites) {
    if (!testsuite) {
      return {count, skipped, annotations}
    }

    let suiteName = ''
    if (suiteRegex) {
      if (parentName) {
        suiteName = `${parentName}/${testsuite._attributes.name}`
      } else if (suiteRegex !== '*') {
        suiteName = testsuite._attributes.name.match(suiteRegex)
      }
      if (!suiteName) {
        suiteName = testsuite._attributes.name
      }
    }

    const res = await parseSuite(
      testsuite,
      suiteName,
      suiteRegex,
      includePassed,
      excludeSources,
      checkRetries,
      checkTitleTemplate
    )
    count += res.count
    skipped += res.skipped
    annotations.push(...res.annotations)

    if (!testsuite.testcase) {
      continue
    }

    const testcases = Array.isArray(testsuite.testcase)
      ? testsuite.testcase
      : testsuite.testcase
      ? [testsuite.testcase]
      : []
    for (const testcase of testcases) {
      count++

      const failed = testcase.failure || testcase.error
      const success = !failed

      if (testcase.skipped || testcase._attributes.status === 'disabled')
        skipped++
      if (checkRetries) {
        annotations = annotations.filter(
          annotation => annotation.testcase !== testcase._attributes.name
        )
      }
      if (failed || (includePassed && success)) {
        const stackTrace: string = (
          (testcase.failure && testcase.failure._cdata) ||
          (testcase.failure && testcase.failure._text) ||
          (testcase.error && testcase.error._cdata) ||
          (testcase.error && testcase.error._text) ||
          ''
        )
          .toString()
          .trim()

        const message: string = (
          (testcase.failure &&
            testcase.failure._attributes &&
            testcase.failure._attributes.message) ||
          (testcase.error &&
            testcase.error._attributes &&
            testcase.error._attributes.message) ||
          stackTrace.split('\n').slice(0, 2).join('\n') ||
          testcase._attributes.name
        ).trim()

        const pos = await resolveFileAndLine(
          testcase._attributes.file || testsuite._attributes.file,
          testcase._attributes.line || testsuite._attributes.line,
          testcase._attributes.classname
            ? testcase._attributes.classname
            : testcase._attributes.name,
          stackTrace
        )

        let resolvedPath = await resolvePath(pos.fileName, excludeSources)

        core.debug(`Path prior to stripping: ${resolvedPath}`)

        const githubWorkspacePath = process.env['GITHUB_WORKSPACE']
        if (githubWorkspacePath) {
          resolvedPath = resolvedPath.replace(`${githubWorkspacePath}/`, '') // strip workspace prefix, make the path relative
        }

        let title = ''
        if (checkTitleTemplate) {
          // ensure to not duplicate the test_name if file_name is equal
          const fileName =
            pos.fileName !== testcase._attributes.name ? pos.fileName : ''
          title = checkTitleTemplate
            .replace('${{FILE_NAME}}', fileName)
            .replace('${{SUITE_NAME}}', suiteName ?? '')
            .replace('${{TEST_NAME}}', testcase._attributes.name)
        } else if (pos.fileName !== testcase._attributes.name) {
          title = suiteName
            ? `${pos.fileName}.${suiteName}/${testcase._attributes.name}`
            : `${pos.fileName}.${testcase._attributes.name}`
        } else {
          title = suiteName
            ? `${suiteName}/${testcase._attributes.name}`
            : `${testcase._attributes.name}`
        }

        core.info(
          `${resolvedPath}:${pos.line} | ${message.replace(/\n/g, ' ')}`
        )

        annotations.push({
          path: resolvedPath,
          testcase: testcase._attributes.name,
          start_line: pos.line,
          end_line: pos.line,
          start_column: 0,
          end_column: 0,
          annotation_level: success ? 'notice' : 'failure',
          title: escapeEmoji(title),
          message: escapeEmoji(message),
          raw_details: escapeEmoji(stackTrace)
        })
      }
    }
  }
  return {count, skipped, annotations}
}

/**
 * Copyright 2020 ScaCap
 * https://github.com/ScaCap/action-surefire-report/blob/master/utils.js#L113
 *
 * Modification Copyright 2021 Mike Penz
 * https://github.com/mikepenz/action-junit-report/
 */
export async function parseTestReports(
  reportPaths: string,
  suiteRegex: string,
  includePassed = false,
  excludeSources: string[],
  checkRetries = false,
  checkTitleTemplate: string | undefined = undefined
): Promise<TestResult> {
  const globber = await glob.create(reportPaths, {followSymbolicLinks: false})
  let annotations: Annotation[] = []
  let count = 0
  let skipped = 0
  for await (const file of globber.globGenerator()) {
    const {
      count: c,
      skipped: s,
      annotations: a
    } = await parseFile(
      file,
      suiteRegex,
      includePassed,
      excludeSources,
      checkRetries,
      checkTitleTemplate
    )
    if (c === 0) continue
    count += c
    skipped += s
    annotations = annotations.concat(a)
  }
  return {count, skipped, annotations}
}

/**
 * Escape emoji sequences.
 */
export function escapeEmoji(input: string): string {
  const regex =
    /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu
  return input.replace(regex, ``) // replace emoji with empty string (\\u${(match.codePointAt(0) || "").toString(16)})
}
