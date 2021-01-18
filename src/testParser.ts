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
 */
export async function resolveFileAndLine(
  file: string | null,
  className: string,
  output: String
): Promise<Position> {
  const fileName = file ? file : className.split('.').slice(-1)[0]
  try {
    const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = output.match(new RegExp(`${escapedFileName}.*?:\\d+`, 'g'))
    if (!matches) return {fileName, line: 1}

    const [lastItem] = matches.slice(-1)
    const [, line] = lastItem.split(':')
    core.debug(`Resolved file ${fileName} and line ${line}`)

    return {fileName, line: parseInt(line)}
  } catch (error) {
    core.warning(
      `⚠️ Failed to resolve file and line for ${file} and ${className}`
    )
    return {fileName, line: 1}
  }
}

/**
 * Copyright 2020 ScaCap
 * https://github.com/ScaCap/action-surefire-report/blob/master/utils.js#L18
 */
export async function resolvePath(fileName: string): Promise<string> {
  core.debug(`Resolving path for ${fileName}`)
  const globber = await glob.create(`**/${fileName}.*`, {
    followSymbolicLinks: false
  })
  const searchPath = globber.getSearchPaths() ? globber.getSearchPaths()[0] : ''
  for await (const result of globber.globGenerator()) {
    core.debug(`Matched file: ${result}`)
    if (!result.includes('/build/')) {
      const path = result.slice(searchPath.length + 1)
      core.debug(`Resolved path: ${path}`)
      return path
    }
  }
  return fileName
}

/**
 * Copyright 2020 ScaCap
 * https://github.com/ScaCap/action-surefire-report/blob/master/utils.js#L43
 */
export async function parseFile(file: string): Promise<TestResult> {
  core.debug(`Parsing file ${file}`)
  let count = 0
  let skipped = 0
  const annotations: Annotation[] = []

  const data: string = fs.readFileSync(file, 'utf8')
  const report = JSON.parse(parser.xml2json(data, {compact: true}))
  const testsuites = report.testsuite
    ? [report.testsuite]
    : Array.isArray(report.testsuites.testsuite)
    ? report.testsuites.testsuite
    : [report.testsuites.testsuite]

  for (const testsuite of testsuites) {
    if (!testsuite || !testsuite.testcase) {
      return {count, skipped, annotations}
    }

    const testcases = Array.isArray(testsuite.testcase)
      ? testsuite.testcase
      : testsuite.testcase
      ? [testsuite.testcase]
      : []
    for (const testcase of testcases) {
      count++
      if (testcase.skipped) skipped++
      if (testcase.failure || testcase.error) {
        const stackTrace = (
          (testcase.failure && testcase.failure._cdata) ||
          (testcase.failure && testcase.failure._text) ||
          (testcase.error && testcase.error._cdata) ||
          (testcase.error && testcase.error._text) ||
          ''
        )
          .toString()
          .trim()

        const message = (
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
          testcase._attributes.file,
          testcase._attributes.classname
            ? testcase._attributes.classname
            : testcase._attributes.name,
          stackTrace
        )

        const path = await resolvePath(pos.fileName)
        const title = `${pos.fileName}.${testcase._attributes.name}`
        core.info(`${path}:${pos.line} | ${message.replace(/\n/g, ' ')}`)

        annotations.push({
          path,
          start_line: pos.line,
          end_line: pos.line,
          start_column: 0,
          end_column: 0,
          annotation_level: 'failure',
          title,
          message,
          raw_details: stackTrace
        })
      }
    }
  }
  return {count, skipped, annotations}
}

/**
 * Copyright 2020 ScaCap
 * https://github.com/ScaCap/action-surefire-report/blob/master/utils.js#L113
 */
export async function parseTestReports(
  reportPaths: string
): Promise<TestResult> {
  const globber = await glob.create(reportPaths, {followSymbolicLinks: false})
  let annotations: Annotation[] = []
  let count = 0
  let skipped = 0
  for await (const file of globber.globGenerator()) {
    const {count: c, skipped: s, annotations: a} = await parseFile(file)
    if (c === 0) continue
    count += c
    skipped += s
    annotations = annotations.concat(a)
  }
  return {count, skipped, annotations}
}
