import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as fs from 'fs'
import * as parser from 'xml-js'
import * as pathHelper from 'path'
import {applyTransformer, removePrefix} from './utils.js'

export interface ActualTestResult {
  name: string
  totalCount: number
  skippedCount: number
  failedCount: number
  passedCount: number
  retriedCount: number
  time: number
  annotations: Annotation[]
  globalAnnotations: Annotation[]
  testResults: ActualTestResult[]
}

interface TestCasesResult {
  totalCount: number
  skippedCount: number
  failedCount: number
  passedCount: number
  retriedCount: number
  time: number
  annotations: Annotation[]
}

export interface TestResult {
  checkName: string
  summary: string
  totalCount: number
  skipped: number
  failed: number
  passed: number
  retried: number
  time: number
  foundFiles: number
  globalAnnotations: Annotation[]
  testResults: ActualTestResult[]
}

export interface Annotation {
  path: string
  start_line: number
  end_line: number
  start_column: number
  end_column: number
  retries: number
  annotation_level: 'failure' | 'notice' | 'warning'
  status: 'success' | 'failure' | 'skipped'
  title: string
  message: string
  raw_details: string
  time: number
}

export interface Position {
  fileName: string
  line: number
}

export interface Transformer {
  searchValue: string
  replaceValue: string
  regex?: RegExp
}

/**
 * Copyright 2020 ScaCap
 * https://github.com/ScaCap/action-surefire-report/blob/master/utils.js#L6
 *
 * Modification Copyright 2022 Mike Penz
 * https://github.com/mikepenz/action-junit-report/
 */
export async function resolveFileAndLine(
  file: string | null,
  line: string | null,
  className: string,
  output: string
): Promise<Position> {
  let fileName = file ? file : className.split('.').slice(-1)[0]
  const lineNumber = safeParseInt(line)
  try {
    if (fileName && lineNumber) {
      return {fileName, line: lineNumber}
    }

    const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('::', '/') // Rust test output contains colons between package names - See: https://github.com/mikepenz/action-junit-report/pull/359

    const matches = output.match(new RegExp(` [^ ]*${escapedFileName}.*?:\\d+`, 'g'))
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
  } catch (error: unknown) {
    core.warning(`⚠️ Failed to resolve file (${file}) and/or line (${line}) for ${className} (${error})`)
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
 * Modification Copyright 2022 Mike Penz
 * https://github.com/mikepenz/action-junit-report/
 */
const resolvePathCache: {[key: string]: string} = {}

/**
 * Resolves the path of a given file, optionally following symbolic links.
 *
 * @param {string} workspace - The optional workspace directory.
 * @param {string} transformedFileName - The transformed file name to find.
 * @param {string[]} excludeSources - List of source paths to exclude.
 * @param {boolean} [followSymlink=false] - Whether to follow symbolic links.
 * @returns {Promise<string>} - The resolved file path.
 */
export async function resolvePath(
  workspace: string,
  transformedFileName: string,
  excludeSources: string[],
  followSymlink = false
): Promise<string> {
  const fileName: string = removePrefix(transformedFileName, workspace)
  if (resolvePathCache[fileName]) {
    return resolvePathCache[fileName]
  }

  let workspacePath: string
  if (workspace.length === 0 || workspace.endsWith('/')) {
    workspacePath = workspace
  } else {
    workspacePath = `${workspace}/`
  }

  core.debug(`Resolving path for ${fileName} in ${workspacePath}`)
  const normalizedFilename = fileName.replace(/^\.\//, '') // strip relative prefix (./)
  const globber = await glob.create(`${workspacePath}**/${normalizedFilename}.*`, {
    followSymbolicLinks: followSymlink
  })
  const searchPath = globber.getSearchPaths() ? globber.getSearchPaths()[0] : ''
  for await (const result of globber.globGenerator()) {
    core.debug(`Matched file: ${result}`)

    const found = excludeSources.find(v => result.includes(v))
    if (!found) {
      const path = result.slice(searchPath.length + 1)
      core.debug(`Resolved path: ${path}`)
      resolvePathCache[fileName] = path
      return path
    }
  }
  resolvePathCache[fileName] = normalizedFilename
  return normalizedFilename
}

/**
 * Copyright 2020 ScaCap
 * https://github.com/ScaCap/action-surefire-report/blob/master/utils.js#L43
 *
 * Modification Copyright 2022 Mike Penz
 * https://github.com/mikepenz/action-junit-report/
 */
export async function parseFile(
  file: string,
  suiteRegex = '', // no-op
  includePassed = false,
  annotateNotice = false,
  checkRetries = false,
  excludeSources: string[] = ['/build/', '/__pycache__/'],
  checkTitleTemplate: string | undefined = undefined,
  breadCrumbDelimiter = '/',
  testFilesPrefix = '',
  transformer: Transformer[] = [],
  followSymlink = false,
  annotationsLimit = -1,
  truncateStackTraces = true,
  failOnParseError = false,
  globalAnnotations: Annotation[] = [],
  resolveIgnoreClassname = false
): Promise<ActualTestResult | undefined> {
  core.debug(`Parsing file ${file}`)

  const data: string = fs.readFileSync(file, 'utf8')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let report: any
  try {
    report = JSON.parse(parser.xml2json(data, {compact: true}))
  } catch (error) {
    core.error(`⚠️ Failed to parse file (${file}) with error ${error}`)
    if (failOnParseError) throw Error(`⚠️ Failed to parse file (${file}) with error ${error}`)
    return undefined
  }

  // parse child test suites
  const testsuite = report.testsuites ? report.testsuites : report.testsuite

  if (!testsuite) {
    core.error(`⚠️ Failed to retrieve root test suite from file (${file})`)
    return undefined
  }

  const testResult = await parseSuite(
    testsuite,
    suiteRegex, // no-op
    '',
    breadCrumbDelimiter,
    includePassed,
    annotateNotice,
    checkRetries,
    excludeSources,
    checkTitleTemplate,
    testFilesPrefix,
    transformer,
    followSymlink,
    annotationsLimit,
    truncateStackTraces,
    globalAnnotations,
    resolveIgnoreClassname
  )

  if (testResult !== undefined && !testResult.name) {
    testResult.name = pathHelper.basename(file)
  }

  return testResult
}

function templateVar(varName: string): string {
  return `{{${varName}}}`
}

async function parseSuite(
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  suite: any,
  suiteRegex: string, // no-op
  breadCrumb: string,
  breadCrumbDelimiter = '/',
  includePassed = false,
  annotateNotice = false,
  checkRetries = false,
  excludeSources: string[],
  checkTitleTemplate: string | undefined = undefined,
  testFilesPrefix = '',
  transformer: Transformer[],
  followSymlink: boolean,
  annotationsLimit: number,
  truncateStackTraces: boolean,
  globalAnnotations: Annotation[],
  resolveIgnoreClassname = false
): Promise<ActualTestResult | undefined> {
  if (!suite) {
    // not a valid suite, return fast
    return undefined
  }

  let suiteName = ''
  if (suite._attributes && suite._attributes.name) {
    suiteName = suite._attributes.name
  }

  let totalCount = 0
  let skippedCount = 0
  let failedCount = 0
  let passedCount = 0
  let retriedCount = 0
  let time = 0
  const annotations: Annotation[] = []

  // parse testCases
  if (suite.testcase) {
    const testcases = Array.isArray(suite.testcase) ? suite.testcase : suite.testcase ? [suite.testcase] : []
    const suiteFile = suite._attributes !== undefined ? suite._attributes.file : null
    const suiteLine = suite._attributes !== undefined ? suite._attributes.line : null
    const limit = annotationsLimit >= 0 ? annotationsLimit - globalAnnotations.length : annotationsLimit
    const parsedTestCases = await parseTestCases(
      suiteName,
      suiteFile,
      suiteLine,
      breadCrumb,
      testcases,
      includePassed,
      annotateNotice,
      checkRetries,
      excludeSources,
      checkTitleTemplate,
      testFilesPrefix,
      transformer,
      followSymlink,
      truncateStackTraces,
      limit,
      resolveIgnoreClassname
    )

    // expand global annotations array
    totalCount += parsedTestCases.totalCount
    skippedCount += parsedTestCases.skippedCount
    failedCount += parsedTestCases.failedCount
    passedCount += parsedTestCases.passedCount
    retriedCount += parsedTestCases.retriedCount
    time += parsedTestCases.time
    annotations.push(...parsedTestCases.annotations)
    globalAnnotations.push(...parsedTestCases.annotations)
  }
  // if we have a limit, and we are above the limit, return fast
  if (annotationsLimit > 0 && globalAnnotations.length >= annotationsLimit) {
    return {
      name: suiteName,
      totalCount,
      skippedCount,
      failedCount,
      passedCount,
      retriedCount,
      time,
      annotations,
      globalAnnotations,
      testResults: []
    }
  }

  // parse child test suites
  const childTestSuites = suite.testsuite
    ? Array.isArray(suite.testsuite)
      ? suite.testsuite
      : [suite.testsuite]
    : Array.isArray(suite.testsuites)
      ? suite.testsuites
      : [suite.testsuites]

  const childSuiteResults: ActualTestResult[] = []
  const childBreadCrumb = suiteName ? `${breadCrumb}${suiteName}${breadCrumbDelimiter}` : breadCrumb
  for (const childSuite of childTestSuites) {
    const childSuiteResult = await parseSuite(
      childSuite,
      suiteRegex,
      childBreadCrumb,
      breadCrumbDelimiter,
      includePassed,
      annotateNotice,
      checkRetries,
      excludeSources,
      checkTitleTemplate,
      testFilesPrefix,
      transformer,
      followSymlink,
      annotationsLimit,
      truncateStackTraces,
      globalAnnotations,
      resolveIgnoreClassname
    )

    if (childSuiteResult) {
      childSuiteResults.push(childSuiteResult)
      totalCount += childSuiteResult.totalCount
      skippedCount += childSuiteResult.skippedCount
      failedCount += childSuiteResult.failedCount
      passedCount += childSuiteResult.passedCount
      retriedCount += childSuiteResult.retriedCount
      time += childSuiteResult.time
    }

    // skip out if we reached our annotations limit
    if (annotationsLimit > 0 && globalAnnotations.length >= annotationsLimit) {
      return {
        name: suiteName,
        totalCount,
        skippedCount,
        failedCount,
        passedCount,
        retriedCount,
        time,
        annotations,
        globalAnnotations,
        testResults: childSuiteResults
      }
    }
  }

  return {
    name: suiteName,
    totalCount,
    skippedCount,
    failedCount,
    passedCount,
    retriedCount,
    time,
    annotations,
    globalAnnotations,
    testResults: childSuiteResults
  }
}

/**
 * Helper function to create an annotation for a test case
 */
async function createTestCaseAnnotation(
  testcase: any,
  failure: any | null,
  failureIndex: number,
  totalFailures: number,
  suiteName: string,
  suiteFile: string | null,
  suiteLine: string | null,
  breadCrumb: string,
  testTime: number,
  skip: boolean,
  success: boolean,
  annotationLevel: 'failure' | 'notice' | 'warning',
  flakyFailuresCount: number,
  annotateNotice: boolean,
  failed: boolean,
  excludeSources: string[],
  checkTitleTemplate: string | undefined,
  testFilesPrefix: string,
  transformer: Transformer[],
  followSymlink: boolean,
  truncateStackTraces: boolean,
  resolveIgnoreClassname: boolean
): Promise<Annotation> {
  // Extract stack trace based on whether we have a failure or error
  const stackTrace: string = (
    (failure && failure._cdata) ||
    (failure && failure._text) ||
    (testcase.error && testcase.error._cdata) ||
    (testcase.error && testcase.error._text) ||
    ''
  )
    .toString()
    .trim()

  const stackTraceMessage = truncateStackTraces ? stackTrace.split('\n').slice(0, 2).join('\n') : stackTrace

  // Extract message based on failure or error
  const message: string = (
    (failure && failure._attributes && failure._attributes.message) ||
    (testcase.error && testcase.error._attributes && testcase.error._attributes.message) ||
    stackTraceMessage ||
    testcase._attributes.name
  ).trim()

  // Determine class name for resolution
  let resolveClassname = testcase._attributes.name
  if (!resolveIgnoreClassname && testcase._attributes.classname) {
    resolveClassname = testcase._attributes.classname
  }

  // Resolve file and line information
  const pos = await resolveFileAndLine(
    testcase._attributes.file || failure?._attributes?.file || suiteFile,
    testcase._attributes.line || failure?._attributes?.line || suiteLine,
    resolveClassname,
    stackTrace
  )

  // Apply transformations to filename
  let transformedFileName = pos.fileName
  for (const r of transformer) {
    transformedFileName = applyTransformer(r, transformedFileName)
  }

  // Resolve the full path
  const githubWorkspacePath = process.env['GITHUB_WORKSPACE']
  let resolvedPath: string = transformedFileName
  if (failed || (annotateNotice && success)) {
    if (fs.existsSync(transformedFileName)) {
      resolvedPath = transformedFileName
    } else if (githubWorkspacePath && fs.existsSync(`${githubWorkspacePath}${transformedFileName}`)) {
      resolvedPath = `${githubWorkspacePath}${transformedFileName}`
    } else {
      resolvedPath = await resolvePath(githubWorkspacePath || '', transformedFileName, excludeSources, followSymlink)
    }
  }

  core.debug(`Path prior to stripping: ${resolvedPath}`)
  if (githubWorkspacePath) {
    resolvedPath = resolvedPath.replace(`${githubWorkspacePath}/`, '') // strip workspace prefix, make the path relative
  }

  // Generate title
  let title = ''
  if (checkTitleTemplate) {
    // ensure to not duplicate the test_name if file_name is equal
    const fileName = pos.fileName !== testcase._attributes.name ? pos.fileName : ''
    const baseClassName = testcase._attributes.classname ? testcase._attributes.classname : testcase._attributes.name
    const className = baseClassName.split('.').slice(-1)[0]
    title = checkTitleTemplate
      .replace(templateVar('FILE_NAME'), fileName)
      .replace(templateVar('BREAD_CRUMB'), breadCrumb ?? '')
      .replace(templateVar('SUITE_NAME'), suiteName ?? '')
      .replace(templateVar('TEST_NAME'), testcase._attributes.name)
      .replace(templateVar('CLASS_NAME'), className)
  } else if (pos.fileName !== testcase._attributes.name) {
    // special handling to use class name only for title in case class name was ignored for `resolveClassname`
    if (resolveIgnoreClassname && testcase._attributes.classname) {
      title = `${testcase._attributes.classname}.${testcase._attributes.name}`
    } else {
      title = `${pos.fileName}.${testcase._attributes.name}`
    }
  } else {
    title = `${testcase._attributes.name}`
  }

  // Add failure index to title if multiple failures exist
  if (totalFailures > 1) {
    title = `${title} (failure ${failureIndex + 1}/${totalFailures})`
  }

  // optionally attach the prefix to the path
  resolvedPath = testFilesPrefix ? pathHelper.join(testFilesPrefix, resolvedPath) : resolvedPath

  const testTimeString = testTime > 0 ? `${testTime}s` : ''
  core.info(`${resolvedPath}:${pos.line} | ${message.split('\n', 1)[0]}${testTimeString}`)

  return {
    path: resolvedPath,
    start_line: pos.line,
    end_line: pos.line,
    start_column: 0,
    end_column: 0,
    retries: (testcase.retries || 0) + flakyFailuresCount,
    annotation_level: annotationLevel,
    status: skip ? 'skipped' : success ? 'success' : 'failure',
    title: escapeEmoji(title),
    message: escapeEmoji(message),
    raw_details: escapeEmoji(stackTrace),
    time: testTime
  }
}

async function parseTestCases(
  suiteName: string,
  suiteFile: string | null,
  suiteLine: string | null,
  breadCrumb: string,
  testcases: any[],
  includePassed = false,
  annotateNotice = false,
  checkRetries = false,
  excludeSources: string[],
  checkTitleTemplate: string | undefined = undefined,
  testFilesPrefix = '',
  transformer: Transformer[],
  followSymlink: boolean,
  truncateStackTraces: boolean,
  limit = -1,
  resolveIgnoreClassname = false
): Promise<TestCasesResult> {
  const annotations: Annotation[] = []
  let totalCount = 0
  let skippedCount = 0
  let retriedCount = 0
  let time = 0
  if (checkRetries) {
    // identify duplicates in case of flaky tests, and remove them
    // Use a compound key including name, classname (if available), and file (if available)
    // to prevent accidental duplicate matches across different test classes/files
    const testcaseMap = new Map<string, any>()
    for (const testcase of testcases) {
      const name = testcase._attributes.name
      const classname = testcase._attributes.classname || ''
      const file = testcase._attributes.file || ''
      const key = `${name}|${classname}|${file}`

      if (testcaseMap.get(key) !== undefined) {
        // testcase with matching key exists - this is a flaky test
        const failed = testcase.failure || testcase.error
        const previous = testcaseMap.get(key)
        const previousFailed = previous.failure || previous.error

        // Increment retry count for each additional occurrence
        const currentRetries = (previous.retries || 0) + 1

        if (!failed) {
          // Current execution is successful - use this as the final result
          // The test is flaky but ultimately passed
          testcase.retries = currentRetries
          testcaseMap.set(key, testcase)
          retriedCount += 1
          core.debug(`Flaky test succeeded after retry for: ${key}`)
        } else if (!previousFailed) {
          // Previous was successful, current failed - keep the successful one
          previous.retries = currentRetries
          retriedCount += 1
          core.debug(`Flaky test: keeping success, dropping failure for: ${key}`)
        } else {
          // Both failed - keep tracking retries but keep the previous
          previous.retries = currentRetries
          retriedCount += 1
          core.debug(`Flaky test: multiple failures for: ${key}`)
        }
      } else {
        testcaseMap.set(key, testcase)
      }
    }
    testcases = Array.from(testcaseMap.values())
  }

  let testCaseFailedCount = 0 // Track number of test cases that failed

  for (const testcase of testcases) {
    totalCount++

    // fish the time-taken out of the test case attributes, if present
    const testTime = testcase._attributes.time === undefined ? 0 : parseFloat(testcase._attributes.time)
    time += testTime

    const testFailure = testcase.failure || testcase.error // test failed
    const skip =
      testcase.skipped || testcase._attributes.status === 'disabled' || testcase._attributes.status === 'ignored'
    const failed = testFailure && !skip // test failure, but was skipped -> don't fail if a ignored test failed
    const success = !testFailure // not a failure -> thus a success
    const annotationLevel = success || skip ? 'notice' : 'failure' // a skipped test shall not fail the run

    if (skip) {
      skippedCount++
    }

    // Count this test case as failed if it has any failures (regardless of how many)
    if (failed) {
      testCaseFailedCount++
    }

    // identify the number of flaky failures (check this early to allow flaky tests through)
    const flakyFailuresCount = testcase.flakyFailure
      ? Array.isArray(testcase.flakyFailure)
        ? testcase.flakyFailure.length
        : 1
      : 0

    // If this isn't reported as a failure and processing all passed tests
    // isn't enabled, then skip the rest of the processing.
    // Exception: if the test has flaky failures, always process it to track retries
    if (annotationLevel !== 'failure' && !includePassed && flakyFailuresCount === 0) {
      continue
    }

    // in some definitions `failure` may be an array
    const failures = testcase.failure ? (Array.isArray(testcase.failure) ? testcase.failure : [testcase.failure]) : []

    // Handle multiple failures or single case (success/skip/error)
    const failuresToProcess = failures.length > 0 ? failures : [null] // Process at least once for non-failure cases

    for (let failureIndex = 0; failureIndex < failuresToProcess.length; failureIndex++) {
      const failure = failuresToProcess[failureIndex]

      const annotation = await createTestCaseAnnotation(
        testcase,
        failure,
        failureIndex,
        failures.length,
        suiteName,
        suiteFile,
        suiteLine,
        breadCrumb,
        testTime,
        skip,
        success,
        annotationLevel,
        flakyFailuresCount,
        annotateNotice,
        failed,
        excludeSources,
        checkTitleTemplate,
        testFilesPrefix,
        transformer,
        followSymlink,
        truncateStackTraces,
        resolveIgnoreClassname
      )

      annotations.push(annotation)

      if (limit >= 0 && annotations.length >= limit) break
    }

    // Break from the outer testcase loop if we've reached the limit
    if (limit >= 0 && annotations.length >= limit) break
  }

  const failedCount = testCaseFailedCount // Use test case count, not annotation count
  const passedCount = totalCount - failedCount - skippedCount
  return {
    totalCount,
    skippedCount,
    failedCount,
    passedCount,
    retriedCount,
    time,
    annotations
  }
}

/**
 * Copyright 2020 ScaCap
 * https://github.com/ScaCap/action-surefire-report/blob/master/utils.js#L113
 *
 * Modification Copyright 2022 Mike Penz
 * https://github.com/mikepenz/action-junit-report/
 */
export async function parseTestReports(
  checkName: string,
  summary: string,
  reportPaths: string,
  suiteRegex: string, // no-op
  includePassed = false,
  annotateNotice = false,
  checkRetries = false,
  excludeSources: string[],
  checkTitleTemplate: string | undefined = undefined,
  breadCrumbDelimiter: string,
  testFilesPrefix = '',
  transformer: Transformer[] = [],
  followSymlink = false,
  annotationsLimit = -1,
  truncateStackTraces = true,
  failOnParseError = false,
  resolveIgnoreClassname = false
): Promise<TestResult> {
  core.debug(`Process test report for: ${reportPaths} (${checkName})`)
  const globber = await glob.create(reportPaths, {followSymbolicLinks: followSymlink})
  const globalAnnotations: Annotation[] = []
  const testResults: ActualTestResult[] = []
  let totalCount = 0
  let skipped = 0
  let failed = 0
  let passed = 0
  let retried = 0
  let time = 0
  let foundFiles = 0
  for await (const file of globber.globGenerator()) {
    foundFiles++
    core.debug(`Parsing report file: ${file}`)

    const testResult = await parseFile(
      file,
      suiteRegex,
      includePassed,
      annotateNotice,
      checkRetries,
      excludeSources,
      checkTitleTemplate,
      breadCrumbDelimiter,
      testFilesPrefix,
      transformer,
      followSymlink,
      annotationsLimit,
      truncateStackTraces,
      failOnParseError,
      globalAnnotations,
      resolveIgnoreClassname
    )

    if (!testResult) continue
    const {totalCount: c, skippedCount: s, failedCount: f, passedCount: p, retriedCount: r, time: t} = testResult
    totalCount += c
    skipped += s
    failed += f
    passed += p
    retried += r
    time += t
    testResults.push(testResult)

    if (annotationsLimit > 0 && globalAnnotations.length >= annotationsLimit) {
      break
    }
  }

  return {
    checkName,
    summary,
    totalCount,
    skipped,
    failed,
    passed,
    retried,
    time,
    foundFiles,
    globalAnnotations,
    testResults
  }
}

/**
 * Escape emoji sequences.
 */
export function escapeEmoji(input: string): string {
  const regex =
    /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu
  return input.replace(regex, ``) // replace emoji with empty string (\\u${(match.codePointAt(0) || "").toString(16)})
}
