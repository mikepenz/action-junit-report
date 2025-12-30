import {parseFile, parseTestReports, resolveFileAndLine, resolvePath, Transformer} from '../src/testParser.js'
import {describe, expect, it} from 'vitest'

/**
 * Original test cases:
 *   Copyright 2020 ScaCap
 *   https://github.com/ScaCap/action-surefire-report/blob/master/utils.test.js
 *
 * New test cases:
 *   Copyright Mike Penz
 */

describe('resolveFileAndLine', () => {
  it('should default to 1 if no line found', async () => {
    const {fileName, line} = await resolveFileAndLine(null, null, 'someClassName', 'not a stacktrace')
    expect(fileName).toBe('someClassName')
    expect(line).toBe(1)
  })

  it('should parse correctly fileName and line for a Java file', async () => {
    const {fileName, line} = await resolveFileAndLine(
      null,
      null,
      'action.surefire.report.email.EmailAddressTest',
      `
action.surefire.report.email.InvalidEmailAddressException: Invalid email address 'user@ñandú.com.ar'
    at action.surefire.report.email.EmailAddressTest.expectException(EmailAddressTest.java:74)
    at action.surefire.report.email.EmailAddressTest.shouldNotContainInternationalizedHostNames(EmailAddressTest.java:39)
        `
    )
    expect(fileName).toBe('EmailAddressTest')
    expect(line).toBe(39)
  })

  it('should parse correctly fileName and line for a Kotlin file', async () => {
    const {fileName, line} = await resolveFileAndLine(
      null,
      null,
      'action.surefire.report.calc.CalcUtilsTest',
      `
java.lang.AssertionError: unexpected exception type thrown; expected:<java.lang.IllegalStateException> but was:<java.lang.IllegalArgumentException>
    at action.surefire.report.calc.CalcUtilsTest.test error handling(CalcUtilsTest.kt:27)
Caused by: java.lang.IllegalArgumentException: Amount must have max 2 non-zero decimal places
    at action.surefire.report.calc.CalcUtilsTest.scale(CalcUtilsTest.kt:31)
    at action.surefire.report.calc.CalcUtilsTest.access$scale(CalcUtilsTest.kt:9)
    at action.surefire.report.calc.CalcUtilsTest.test error handling(CalcUtilsTest.kt:27)
        `
    )
    expect(fileName).toBe('CalcUtilsTest')
    expect(line).toBe(27)
  })

  it('should parse correctly fileName and line for extended stacktrace', async () => {
    const {fileName, line} = await resolveFileAndLine(
      null,
      null,
      'action.surefire.report.calc.StringUtilsTest',
      `
java.lang.AssertionError:

Expected: (an instance of java.lang.IllegalArgumentException and exception with message a string containing "This is unexpected")
     but: exception with message a string containing "This is unexpected" message was "Input='' didn't match condition."
Stacktrace was: java.lang.IllegalArgumentException: Input='' didn't match condition.
	at action.surefire.report.calc.StringUtils.requireNotBlank(StringUtils.java:25)
	at action.surefire.report.calc.StringUtils.requireNotBlank(StringUtils.java:18)
	at action.surefire.report.calc.StringUtilsTest.require_fail(StringUtilsTest.java:26)
	at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
	at org.junit.runners.ParentRunner.run(ParentRunner.java:413)
	at org.apache.maven.surefire.junit4.JUnit4Provider.invoke(JUnit4Provider.java:159)
	at org.apache.maven.surefire.booter.ForkedBooter.main(ForkedBooter.java:418)
`
    )
    expect(fileName).toBe('StringUtilsTest')
    expect(line).toBe(26)
  })

  it('should parse correctly fileName and line for pytest', async () => {
    const {fileName, line} = await resolveFileAndLine(
      'test.py',
      null,
      'anything',
      `
def
test_with_error():
event = { 'attr': 'test'}
&gt; assert event.attr == 'test'
E AttributeError: 'dict' object has no attribute 'attr'

test.py:14: AttributeError
`
    )
    expect(fileName).toBe('test.py')
    expect(line).toBe(14)
  })

  it('should parse correctly line number for rust tests', async () => {
    const {fileName, line} = await resolveFileAndLine(
      null,
      null,
      'project',
      `thread &#x27;project::admission_webhook_tests::it_should_be_possible_to_update_projects&#x27; panicked at &#x27;boom&#x27;, tests/project/admission_webhook_tests.rs:48:38
note: run with &#x60;RUST_BACKTRACE&#x3D;1&#x60; environment variable to display a backtrace

  `
    )
    expect(line).toBe(48)
    expect(fileName).toBe('tests/project/admission_webhook_tests.rs')
  })

  it('should parse correctly line number for rust tests 2', async () => {
    const {fileName, line} = await resolveFileAndLine(
      null,
      null,
      'project::manifest_secrets',
      `thread 'project::manifest_secrets::it_should_skip_annotated_manifests' panicked at 'assertion failed: \`(left == right)\`\\n" +
        '  left: \`0\`,\\n' +
        " right: \`42\`: all manifests should be skipped', tests/project/manifest_secrets.rs:305:5
  `
    )
    expect(line).toBe(305)
    expect(fileName).toBe('tests/project/manifest_secrets.rs')
  })
})

describe('resolvePath', () => {
  it('should find correct file for Java fileName', async () => {
    const path = await resolvePath('', 'EmailAddressTest', ['/build/', '/__pycache__/'])
    expect(path).toBe('test_results/tests/email/src/test/java/action/surefire/report/email/EmailAddressTest.java')
  })

  it('should find correct file for Kotlin fileName', async () => {
    const path = await resolvePath('', 'CalcUtilsTest', ['/build/', '/__pycache__/'])
    expect(path).toBe('test_results/tests/utils/src/test/java/action/surefire/report/calc/CalcUtilsTest.kt')
  })

  it('should find correct file with a relative path', async () => {
    const path = await resolvePath('', './test_results/CalcUtilsTest.kt', ['/build/', '/__pycache__/'])
    expect(path).toBe('test_results/CalcUtilsTest.kt')
  })
})

describe('parseFile', () => {
  it('should parse CalcUtils results', async () => {
    const testResult = await parseFile(
      'test_results/tests/utils/target/surefire-reports/TEST-action.surefire.report.calc.CalcUtilsTest.xml'
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!

    expect(totalCount).toBe(2)
    expect(skippedCount).toBe(0)
    expect(globalAnnotations).toStrictEqual([
      {
        path: 'test_results/tests/utils/src/test/java/action/surefire/report/calc/CalcUtilsTest.kt',
        start_line: 27,
        end_line: 27,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'CalcUtilsTest.test error handling',
        message:
          'unexpected exception type thrown; expected:<java.lang.IllegalStateException> but was:<java.lang.IllegalArgumentException>',
        raw_details:
          'java.lang.AssertionError: unexpected exception type thrown; expected:<java.lang.IllegalStateException> but was:<java.lang.IllegalArgumentException>\n\tat action.surefire.report.calc.CalcUtilsTest.test error handling(CalcUtilsTest.kt:27)\nCaused by: java.lang.IllegalArgumentException: Amount must have max 2 non-zero decimal places\n\tat action.surefire.report.calc.CalcUtilsTest.scale(CalcUtilsTest.kt:31)\n\tat action.surefire.report.calc.CalcUtilsTest.access$scale(CalcUtilsTest.kt:9)\n\tat action.surefire.report.calc.CalcUtilsTest.test error handling(CalcUtilsTest.kt:27)'
      },
      {
        path: 'test_results/tests/utils/src/test/java/action/surefire/report/calc/CalcUtilsTest.kt',
        start_line: 15,
        end_line: 15,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0.001,
        title: 'CalcUtilsTest.test scale',
        message: 'Expected: <100.10>\n     but: was <100.11>',
        raw_details:
          'java.lang.AssertionError: \n\nExpected: <100.10>\n     but: was <100.11>\n\tat action.surefire.report.calc.CalcUtilsTest.test scale(CalcUtilsTest.kt:15)'
      }
    ])
  })

  it('should skip after reaching annotations_limit', async () => {
    const annotationsLimit = 1
    const testResult = await parseFile(
      'test_results/tests/utils/target/surefire-reports/TEST-action.surefire.report.calc.CalcUtilsTest.xml',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '/',
      undefined,
      undefined,
      undefined,
      annotationsLimit
    )

    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(globalAnnotations).toStrictEqual([
      {
        path: 'test_results/tests/utils/src/test/java/action/surefire/report/calc/CalcUtilsTest.kt',
        start_line: 27,
        end_line: 27,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'CalcUtilsTest.test error handling',
        message:
          'unexpected exception type thrown; expected:<java.lang.IllegalStateException> but was:<java.lang.IllegalArgumentException>',
        raw_details:
          'java.lang.AssertionError: unexpected exception type thrown; expected:<java.lang.IllegalStateException> but was:<java.lang.IllegalArgumentException>\n\tat action.surefire.report.calc.CalcUtilsTest.test error handling(CalcUtilsTest.kt:27)\nCaused by: java.lang.IllegalArgumentException: Amount must have max 2 non-zero decimal places\n\tat action.surefire.report.calc.CalcUtilsTest.scale(CalcUtilsTest.kt:31)\n\tat action.surefire.report.calc.CalcUtilsTest.access$scale(CalcUtilsTest.kt:9)\n\tat action.surefire.report.calc.CalcUtilsTest.test error handling(CalcUtilsTest.kt:27)'
      }
    ])
  })

  it('should parse pytest results', async () => {
    const testResult = await parseFile('test_results/python/report.xml')
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!

    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(3)
    expect(skippedCount).toBe(0)
    expect(filtered).toStrictEqual([
      {
        path: 'test_results/python/test_sample.py',
        start_line: 10,
        end_line: 10,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0.001,
        title: 'test_sample.test_which_fails',
        message: "AssertionError: assert 'test' == 'xyz'\n  - xyz\n  + test",
        raw_details:
          "def test_which_fails():\n        event = { 'attr': 'test'}\n>       assert event['attr'] == 'xyz'\nE       AssertionError: assert 'test' == 'xyz'\nE         - xyz\nE         + test\n\npython/test_sample.py:10: AssertionError"
      },
      {
        path: 'test_results/python/test_sample.py',
        start_line: 14,
        end_line: 14,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'test_sample.test_with_error',
        message: "AttributeError: 'dict' object has no attribute 'attr'",
        raw_details:
          "def test_with_error():\n        event = { 'attr': 'test'}\n>       assert event.attr == 'test'\nE       AttributeError: 'dict' object has no attribute 'attr'\n\npython/test_sample.py:14: AttributeError"
      }
    ])
  })

  it('should parse pytest results 2', async () => {
    const testResult = await parseFile(
      'test_results/python/report.xml',
      '',
      false,
      false,
      false,
      ['/build/', '/__pycache__/'],
      '{{BREAD_CRUMB}}{{SUITE_NAME}}/{{TEST_NAME}}',
      '/',
      'subproject/'
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(3)
    expect(skippedCount).toBe(0)
    expect(filtered).toStrictEqual([
      {
        path: 'subproject/test_results/python/test_sample.py',
        start_line: 10,
        end_line: 10,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0.001,
        title: 'pytest/test_which_fails',
        message: "AssertionError: assert 'test' == 'xyz'\n  - xyz\n  + test",
        raw_details:
          "def test_which_fails():\n        event = { 'attr': 'test'}\n>       assert event['attr'] == 'xyz'\nE       AssertionError: assert 'test' == 'xyz'\nE         - xyz\nE         + test\n\npython/test_sample.py:10: AssertionError"
      },
      {
        path: 'subproject/test_results/python/test_sample.py',
        start_line: 14,
        end_line: 14,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'pytest/test_with_error',
        message: "AttributeError: 'dict' object has no attribute 'attr'",
        raw_details:
          "def test_with_error():\n        event = { 'attr': 'test'}\n>       assert event.attr == 'test'\nE       AttributeError: 'dict' object has no attribute 'attr'\n\npython/test_sample.py:14: AttributeError"
      }
    ])
  })

  it('should parse marathon results', async () => {
    const testResult = await parseFile('test_results/marathon_tests/com.mikepenz.DummyTest#test_02_dummy.xml')
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(filtered).toStrictEqual([])
  })

  it('should parse marathon results and retrieve message', async () => {
    const testResult = await parseFile('test_results/marathon_tests/com.mikepenz.DummyTest3#test_01.xml')
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!

    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(globalAnnotations).toStrictEqual([
      {
        annotation_level: 'failure',
        end_column: 0,
        end_line: 1,
        message: 'test_01',
        path: 'DummyTest3',
        raw_details: '',
        start_column: 0,
        start_line: 1,
        retries: 0,
        status: 'failure',
        time: 4.3,
        title: 'DummyTest3.test_01'
      }
    ])
  })

  it('should parse and fail marathon results', async () => {
    const testResult = await parseFile('test_results/marathon_tests/com.mikepenz.DummyUtilTest#test_01_dummy.xml')
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!

    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(globalAnnotations).toStrictEqual([
      {
        annotation_level: 'failure',
        end_column: 0,
        end_line: 1,
        message:
          'java.io.FileNotFoundException: No content provider: content://com.xyz/photo.jpg\nat android.content.ContentResolver.openTypedAssetFileDescriptor(ContentResolver.java:1969)',
        path: 'DummyUtilTest',
        raw_details:
          'java.io.FileNotFoundException: No content provider: content://com.xyz/photo.jpg\nat android.content.ContentResolver.openTypedAssetFileDescriptor(ContentResolver.java:1969)\nat android.app.Instrumentation$InstrumentationThread.run(Instrumentation.java:2205)',
        start_column: 0,
        start_line: 1,
        retries: 0,
        status: 'failure',
        time: 0.014,
        title: 'DummyUtilTest.test_01_dummy'
      }
    ])
  })

  it('should parse empty cunit results', async () => {
    const testResult = await parseFile('test_results/cunit/testEmpty.xml')
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!

    expect(totalCount).toBe(0)
    expect(skippedCount).toBe(0)
    expect(globalAnnotations).toStrictEqual([])
  })

  it('should parse failure cunit results', async () => {
    const testResult = await parseFile('test_results/cunit/testFailure.xml')
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(4)
    expect(skippedCount).toBe(0)
    expect(filtered).toStrictEqual([
      {
        annotation_level: 'failure',
        end_column: 0,
        end_line: 1,
        message: 'false == something.loadXml(xml_string)',
        path: 'loadFromXMLString_When_Should2Test',
        raw_details: 'false == something.loadXml(xml_string)\nFile: /dumm/core/tests/testFailure.cpp\nLine: 77',
        start_column: 0,
        start_line: 1,
        retries: 0,
        status: 'failure',
        time: 0.000087,
        title: 'loadFromXMLString_When_Should2Test'
      }
    ])
  })

  it('should ignore classname when requested', async () => {
    const testResult = await parseFile(
      'test_results/nextest/basic.xml',
      '',
      false,
      false,
      false,
      undefined,
      undefined,
      '/',
      '',
      undefined,
      false,
      -1,
      true,
      false,
      undefined,
      true
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(3)
    expect(skippedCount).toBe(0)
    expect(filtered).toStrictEqual([
      {
        annotation_level: 'failure',
        end_column: 0,
        end_line: 154,
        message:
          "thread 'test_failure' panicked at tests/parry3d.rs:154:5:\n" +
          '                assertion `left == right` failed: 0 must equal 1',
        path: 'tests/parry3d.rs',
        raw_details:
          "thread 'test_failure' panicked at tests/parry3d.rs:154:5:\n" +
          '                assertion `left == right` failed: 0 must equal 1\n' +
          '                left: 0\n' +
          '                right: 1\n' +
          '                note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace',
        start_column: 0,
        start_line: 154,
        retries: 0,
        status: 'failure',
        time: 0.774,
        title: 'oxidized_navigation::parry3d.test_failure'
      }
    ])
  })

  it('should parse correctly fileName and line for a Java file with invalid chars', async () => {
    const {fileName, line} = await resolveFileAndLine(
      null,
      null,
      'action.surefire.report.email.EmailAddressTest++',
      `
action.surefire.report.email.InvalidEmailAddressException: Invalid email address 'user@ñandú.com.ar'
    at action.surefire.report.email.EmailAddressTest.expectException(EmailAddressTest++.java:74)
    at action.surefire.report.email.EmailAddressTest.shouldNotContainInternationalizedHostNames(EmailAddressTest++.java:39)
        `
    )
    expect(fileName).toBe('EmailAddressTest++')
    expect(line).toBe(39)
  })

  it('should parse correctly nested test suites', async () => {
    const testResult = await parseFile(
      'test_results/nested/junit.xml',
      '',
      false,
      false,
      false,
      undefined,
      '{{BREAD_CRUMB}}{{SUITE_NAME}}/{{TEST_NAME}}'
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(5)
    expect(skippedCount).toBe(0)
    expect(filtered).toStrictEqual([
      {
        path: 'A',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 50,
        title: 'All tests/tests/packet/A',
        message: 'failure',
        raw_details: ''
      },
      {
        path: 'A',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 10,
        title: 'All tests/tests/packet/TestA/A',
        message: 'failure',
        raw_details: ''
      },
      {
        path: 'B',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 40,
        title: 'All tests/tests/packet/TestB/B',
        message: 'failure',
        raw_details: ''
      }
    ])
  })

  it('should skip disabled tests when annotatePassed=false', async () => {
    const testResult = await parseFile('test_results/issues/testDisabled.xml', '*')
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')
    const notice = globalAnnotations.filter(annotation => annotation.annotation_level === 'notice')

    expect(totalCount).toBe(22)
    expect(skippedCount).toBe(10)
    expect(filtered.length).toBe(6)
    expect(notice.length).toBe(0)
  })

  it('should parse disabled tests as notices when annotatePassed=true', async () => {
    const testResult = await parseFile(
      'test_results/issues/testDisabled.xml',
      '',
      true,
      true,
      false,
      undefined,
      '{{SUITE_NAME}}/{{TEST_NAME}}'
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')
    const notice = globalAnnotations.filter(annotation => annotation.annotation_level === 'notice')

    expect(totalCount).toBe(22)
    expect(skippedCount).toBe(10)
    expect(filtered).toStrictEqual([
      {
        path: 'factorial_of_value_from_fixture',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'factorial/factorial_of_value_from_fixture',
        message: 'tests/failed/main.cpp:58: error: check_eq(3628800, 3628801)',
        raw_details: ''
      },
      {
        path: 'factorial_of_value_from_fixture[0]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'factorial/factorial_of_value_from_fixture[0]',
        message: 'tests/failed/main.cpp:97: error: condition was false',
        raw_details: ''
      },
      {
        path: 'positive_arguments_must_produce_expected_result',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'factorial/positive_arguments_must_produce_expected_result',
        message: 'uncaught std::exception: thrown by test',
        raw_details: ''
      },
      {
        path: 'positive_arguments_must_produce_expected_result[2]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'factorial/positive_arguments_must_produce_expected_result[2]',
        message: 'tests/failed/main.cpp:73: error: condition was false',
        raw_details: ''
      },
      {
        path: 'test_which_fails_check_eq_with_custom_message',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'factorial/test_which_fails_check_eq_with_custom_message',
        message: 'tests/failed/main.cpp:49: error: check_eq(6, 7): hello world!',
        raw_details: ''
      },
      {
        path: 'test_which_throws_unknown_exception',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'factorial/test_which_throws_unknown_exception',
        message: 'uncaught unknown exception',
        raw_details: ''
      }
    ])

    expect(notice).toStrictEqual([
      {
        path: 'disabled_fixture_test',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'skipped',
        time: 0,
        title: 'factorial/disabled_fixture_test',
        message: 'disabled_fixture_test',
        raw_details: ''
      },
      {
        path: 'disabled_param_fixture_test[0]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'skipped',
        time: 0,
        title: 'factorial/disabled_param_fixture_test[0]',
        message: 'disabled_param_fixture_test[0]',
        raw_details: ''
      },
      {
        path: 'disabled_param_fixture_test[1]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'skipped',
        time: 0,
        title: 'factorial/disabled_param_fixture_test[1]',
        message: 'disabled_param_fixture_test[1]',
        raw_details: ''
      },
      {
        path: 'disabled_param_fixture_test[2]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'skipped',
        time: 0,
        title: 'factorial/disabled_param_fixture_test[2]',
        message: 'disabled_param_fixture_test[2]',
        raw_details: ''
      },
      {
        path: 'disabled_param_fixture_test[3]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'skipped',
        time: 0,
        title: 'factorial/disabled_param_fixture_test[3]',
        message: 'disabled_param_fixture_test[3]',
        raw_details: ''
      },
      {
        path: 'disabled_param_test[0]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'skipped',
        time: 0,
        title: 'factorial/disabled_param_test[0]',
        message: 'disabled_param_test[0]',
        raw_details: ''
      },
      {
        path: 'disabled_param_test[1]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'skipped',
        time: 0,
        title: 'factorial/disabled_param_test[1]',
        message: 'disabled_param_test[1]',
        raw_details: ''
      },
      {
        path: 'disabled_param_test[2]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'skipped',
        time: 0,
        title: 'factorial/disabled_param_test[2]',
        message: 'disabled_param_test[2]',
        raw_details: ''
      },
      {
        path: 'disabled_param_test[3]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'skipped',
        time: 0,
        title: 'factorial/disabled_param_test[3]',
        message: 'disabled_param_test[3]',
        raw_details: ''
      },
      {
        path: 'disabled_test',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'skipped',
        time: 0,
        title: 'factorial/disabled_test',
        message: 'disabled_test',
        raw_details: ''
      },
      {
        path: 'factorial_of_value_from_fixture[1]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0,
        title: 'factorial/factorial_of_value_from_fixture[1]',
        message: 'factorial_of_value_from_fixture[1]',
        raw_details: ''
      },
      {
        path: 'factorial_of_value_from_fixture[2]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0,
        title: 'factorial/factorial_of_value_from_fixture[2]',
        message: 'factorial_of_value_from_fixture[2]',
        raw_details: ''
      },
      {
        path: 'factorial_of_value_from_fixture[3]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0,
        title: 'factorial/factorial_of_value_from_fixture[3]',
        message: 'factorial_of_value_from_fixture[3]',
        raw_details: ''
      },
      {
        path: 'positive_arguments_must_produce_expected_result[0]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0,
        title: 'factorial/positive_arguments_must_produce_expected_result[0]',
        message: 'positive_arguments_must_produce_expected_result[0]',
        raw_details: ''
      },
      {
        path: 'positive_arguments_must_produce_expected_result[1]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0,
        title: 'factorial/positive_arguments_must_produce_expected_result[1]',
        message: 'positive_arguments_must_produce_expected_result[1]',
        raw_details: ''
      },
      {
        path: 'positive_arguments_must_produce_expected_result[3]',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0,
        title: 'factorial/positive_arguments_must_produce_expected_result[3]',
        message: 'positive_arguments_must_produce_expected_result[3]',
        raw_details: ''
      }
    ])
  })

  it('parse mocha test case', async () => {
    const testResult = await parseFile(
      'test_results/mocha/mocha.xml',
      '*',
      true,
      true,
      false,
      undefined,
      '{{SUITE_NAME}}/{{TEST_NAME}}'
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!

    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(globalAnnotations).toStrictEqual([
      {
        path: '/path/test/config.js',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0.002,
        title:
          'default config/Config files default config projectUTCOffset should be a callable with current UTC offset',
        message: 'Config files default config projectUTCOffset should be a callable with current UTC offset',
        raw_details: ''
      }
    ])
  })

  it('parse mocha test case, custom title template', async () => {
    const testResult = await parseFile(
      'test_results/mocha/mocha.xml',
      '*',
      true,
      true,
      false,
      ['/build/', '/__pycache__/'],
      '{{TEST_NAME}}'
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!

    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(globalAnnotations).toStrictEqual([
      {
        path: '/path/test/config.js',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0.002,
        title: 'Config files default config projectUTCOffset should be a callable with current UTC offset',
        message: 'Config files default config projectUTCOffset should be a callable with current UTC offset',
        raw_details: ''
      }
    ])
  })

  it('parse mocha test case, test files prefix', async () => {
    const testResult = await parseFile(
      'test_results/mocha/mocha.xml',
      '*',
      true,
      true,
      false,
      ['/build/', '/__pycache__/'],
      '{{TEST_NAME}}',
      '',
      'subproject'
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!

    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(globalAnnotations).toStrictEqual([
      {
        path: 'subproject/path/test/config.js',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0.002,
        title: 'Config files default config projectUTCOffset should be a callable with current UTC offset',
        message: 'Config files default config projectUTCOffset should be a callable with current UTC offset',
        raw_details: ''
      }
    ])
  })

  it('should parse xunit results', async () => {
    const testResult = await parseFile('test_results/xunit/report.xml')
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(4)
    expect(skippedCount).toBe(0)
    expect(filtered).toStrictEqual([
      {
        path: 'main.c',
        start_line: 38,
        end_line: 38,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'main.c.test_my_sum_fail',
        message: 'Expected 2 Was 0',
        raw_details: ''
      }
    ])
  })

  it('should parse xunit results with file and line on failure', async () => {
    const testResult = await parseFile('test_results/xunit/report_fl_on_f.xml')
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(4)
    expect(skippedCount).toBe(0)
    expect(filtered).toStrictEqual([
      {
        path: 'main.c',
        start_line: 38,
        end_line: 38,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'main.c.test_my_sum_fail',
        message: 'Expected 2 Was 0',
        raw_details: ''
      }
    ])
  })

  it('should parse junit web test results', async () => {
    const testResult = await parseFile('test_results/junit-web-test/expected.xml')
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(6)
    expect(skippedCount).toBe(1)
    expect(filtered).toStrictEqual([
      {
        path: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js',
        start_line: 15,
        end_line: 15,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0.001,
        title: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js.asserts error',
        message: 'expected false to be true',
        raw_details:
          'AssertionError: expected false to be true\n  at o.<anonymous> (packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js:15:29)'
      }
    ])
  })

  it('should handle retries', async () => {
    const testResult = await parseFile('test_results/junit-web-test/expectedRetries.xml', '', false, false, true, [
      '/build/',
      '/__pycache__/'
    ])
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(7)
    expect(skippedCount).toBe(1)
    expect(filtered).toStrictEqual([
      {
        path: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js',
        start_line: 15,
        end_line: 15,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0.001,
        title: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js.asserts error',
        message: 'expected false to be true',
        raw_details:
          'AssertionError: expected false to be true\n  at o.<anonymous> (packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js:15:29)'
      }
    ])
  })

  it('there should be two errors if retries are not handled', async () => {
    const testResult = await parseFile('test_results/junit-web-test/expectedRetries.xml', '', false)
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(8)
    expect(skippedCount).toBe(1)
    expect(filtered).toStrictEqual([
      {
        path: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js',
        start_line: 15,
        end_line: 15,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0.001,
        title: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js.asserts error',
        message: 'expected false to be true',
        raw_details:
          'AssertionError: expected false to be true\n  at o.<anonymous> (packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js:15:29)'
      },
      {
        annotation_level: 'failure',
        end_column: 0,
        end_line: 15,
        message: 'this is flaky, so is retried',
        path: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js',
        raw_details:
          'AssertionError: expected false to be true\n  at o.<anonymous> (packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js:15:29)',
        start_column: 0,
        start_line: 15,
        retries: 0,
        status: 'failure',
        time: 0.001,
        title: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js.retried flaky test'
      }
    ])
  })

  it('merge flaky tests, and include retry count', async () => {
    const testResult = await parseFile('test_results/junit-web-test/expectedRetries.xml', '', true, true, true)
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.retries > 0)

    expect(totalCount).toBe(7)
    expect(skippedCount).toBe(1)
    expect(filtered).toStrictEqual([
      {
        path: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js',
        start_line: 15,
        end_line: 15,
        retries: 1,
        start_column: 0,
        end_column: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0.001,
        title: 'packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js.retried flaky test',
        message: 'retried flaky test',
        raw_details: ''
      }
    ])
  })

  it('flaky tests, and include retry count', async () => {
    const testResult = await parseFile('test_results/junit_flaky_failure/marathon_junit_report.xml', '', true, true)
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.retries > 0)

    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(filtered).toStrictEqual([
      {
        annotation_level: 'notice',
        end_column: 0,
        end_line: 1,
        message: 'testFlakyFailure',
        path: 'Class',
        raw_details: '',
        retries: 1,
        start_column: 0,
        start_line: 1,
        status: 'success',
        time: 1.86,
        title: 'Class.testFlakyFailure'
      }
    ])
  })

  it('flaky tests should be detected even without includePassed', async () => {
    // This test verifies that tests with flakyFailure elements are processed
    // even when includePassed is false
    const testResult = await parseFile('test_results/junit_flaky_failure/marathon_junit_report.xml', '', false, false)
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.retries > 0)

    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    // Should still detect the flaky test even though includePassed is false
    expect(filtered).toStrictEqual([
      {
        annotation_level: 'notice',
        end_column: 0,
        end_line: 1,
        message: 'testFlakyFailure',
        path: 'Class',
        raw_details: '',
        retries: 1,
        start_column: 0,
        start_line: 1,
        status: 'success',
        time: 1.86,
        title: 'Class.testFlakyFailure'
      }
    ])
  })

  it('flaky tests should be included but regular passed tests excluded when includePassed=false', async () => {
    // This test verifies that:
    // 1. Tests with flakyFailure elements ARE included even when includePassed=false
    // 2. Regular passed tests are still excluded when includePassed=false
    const testResult = await parseFile(
      'test_results/junit_flaky_failure/mixed_flaky_and_passed.xml',
      '',
      false,  // includePassed = false
      false   // annotateNotice = false
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, passedCount, failedCount, globalAnnotations} = testResult!!
    
    // Total count should include all tests (3 total)
    expect(totalCount).toBe(3)
    expect(skippedCount).toBe(0)
    expect(failedCount).toBe(0)
    expect(passedCount).toBe(3)
    
    // But annotations should ONLY include the flaky test, not the regular passed tests
    expect(globalAnnotations.length).toBe(1)
    expect(globalAnnotations[0].title).toBe('FlakyTest.testFlaky')
    expect(globalAnnotations[0].retries).toBe(1)
    expect(globalAnnotations[0].status).toBe('success')
  })

  it('all passed tests should be included when includePassed=true including flaky', async () => {
    // This test verifies that when includePassed=true, both flaky and regular passed tests are included
    const testResult = await parseFile(
      'test_results/junit_flaky_failure/mixed_flaky_and_passed.xml',
      '',
      true,   // includePassed = true
      true    // annotateNotice = true
    )
    expect(testResult).toBeDefined()
    const {totalCount, globalAnnotations} = testResult!!
    
    expect(totalCount).toBe(3)
    
    // All 3 tests should be in annotations when includePassed=true
    expect(globalAnnotations.length).toBe(3)
    
    // Find the flaky test
    const flakyTest = globalAnnotations.find(a => a.title === 'FlakyTest.testFlaky')
    expect(flakyTest).toBeDefined()
    expect(flakyTest!.retries).toBe(1)
    
    // Find the regular passed tests
    const passedTests = globalAnnotations.filter(a => a.title.includes('PassedTest'))
    expect(passedTests.length).toBe(2)
    expect(passedTests[0].retries).toBe(0)
    expect(passedTests[1].retries).toBe(0)
  })

  it('should parse and transform perl results', async () => {
    const transformer: Transformer[] = [
      {
        searchValue: '\\.',
        replaceValue: '/',
        regex: new RegExp('\\.'.replace('\\\\', '\\'), 'gu')
      },
      {
        searchValue: '(.+?)_t',
        replaceValue: '$1.t',
        regex: new RegExp('(.+?)_t'.replace('\\\\', '\\'), 'gu')
      }
    ]
    const testResult = await parseFile(
      'test_results/perl/result.xml',
      '',
      true,
      true,
      undefined,
      undefined,
      undefined,
      '/',
      undefined,
      transformer
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(globalAnnotations).toStrictEqual([
      {
        path: 'FileName.t',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0.0000450611114501953,
        title: 'FileName_t.L123: ...',
        message: 'L123: ...',
        raw_details: ''
      }
    ])
  })

  it('should parse and transform container-structure results (with no testsuite attributes)', async () => {
    const testResult = await parseFile(
      'test_results/container-structure/test.xml',
      '',
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    expect(totalCount).toBe(3)
    expect(skippedCount).toBe(0)
    expect(globalAnnotations).toStrictEqual([
      {
        path: 'Command Test: apt-get upgrade',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 999638317,
        title: 'Command Test: apt-get upgrade',
        message: 'Command Test: apt-get upgrade',
        raw_details: ''
      },
      {
        path: 'File Existence Test: /home/app/app',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0,
        title: 'File Existence Test: /home/app/app',
        message: 'File Existence Test: /home/app/app',
        raw_details: ''
      },
      {
        path: 'Metadata Test',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'success',
        time: 0,
        title: 'Metadata Test',
        message: 'Metadata Test',
        raw_details: ''
      }
    ])
  })

  it('should parse catch2 results with file and line on failure', async () => {
    const testResult = await parseFile('test_results/catch2/report.xml')
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, globalAnnotations} = testResult!!
    const filtered = globalAnnotations.filter(annotation => annotation.annotation_level !== 'notice')

    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(filtered).toStrictEqual([
      {
        path: 'test/unit/detail/utility/is_constant_evaluated.cpp',
        start_line: 19,
        end_line: 19,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'failure',
        status: 'failure',
        time: 0,
        title: 'test/unit/detail/utility/is_constant_evaluated.cpp.is constant evaluated',
        message: 'REQUIRE(v == 1) expands to 0 == 10',
        raw_details:
          'FAILED:\n  REQUIRE( v == 1 )\nwith expansion:\n  0 == 1\n0\nat /__w/futures/futures/test/unit/detail/utility/is_constant_evaluated.cpp:19'
      }
    ])
  })

  it('flaky test with classname and file: multiple failures then success should pass with retries', async () => {
    // Test that flaky tests are correctly identified using classname and file as part of the key
    // The test_foo test appears 3 times: failure, error, then success
    // It should be marked as success with 2 retries
    const testResult = await parseFile(
      'test_results/flaky_retries/flaky_with_classname_file.xml',
      '',
      true,   // includePassed
      true,   // annotateNotice
      true    // checkRetries
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, failedCount, passedCount, retriedCount, globalAnnotations} = testResult!!

    // Should have 3 unique tests (test_foo appears once due to deduplication, plus test_bar.test_foo and test_baz)
    expect(totalCount).toBe(3)
    expect(skippedCount).toBe(0)
    expect(failedCount).toBe(0)
    expect(passedCount).toBe(3)
    expect(retriedCount).toBe(2)  // 2 retries for the flaky test (3 occurrences - 1)

    // Find the flaky test annotation
    const flakyTest = globalAnnotations.find(a =>
      a.title.includes('test_foo.TestFoo') || a.path.includes('test_foo.py')
    )
    expect(flakyTest).toBeDefined()
    expect(flakyTest!.status).toBe('success')
    expect(flakyTest!.retries).toBe(2)
    expect(flakyTest!.annotation_level).toBe('notice')

    // Verify that test_bar.test_foo is NOT merged with test_foo.test_foo (different classname/file)
    const testBarFoo = globalAnnotations.find(a => a.path.includes('test_bar.py'))
    expect(testBarFoo).toBeDefined()
    expect(testBarFoo!.retries).toBe(0)  // Not retried, it's a separate test
  })

  it('flaky test with all failures should still be marked as failure with retries', async () => {
    // Test that when all executions of a flaky test fail, it remains a failure but tracks retries
    const testResult = await parseFile(
      'test_results/flaky_retries/flaky_all_failures.xml',
      '',
      false,   // includePassed
      false,   // annotateNotice
      true     // checkRetries
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, failedCount, passedCount, retriedCount, globalAnnotations} = testResult!!

    // Should have 1 unique test after deduplication
    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(failedCount).toBe(1)
    expect(passedCount).toBe(0)
    expect(retriedCount).toBe(2)  // 2 retries (3 occurrences - 1)

    // Should still have a failure annotation
    expect(globalAnnotations).toHaveLength(1)
    expect(globalAnnotations[0].status).toBe('failure')
    expect(globalAnnotations[0].retries).toBe(2)
    expect(globalAnnotations[0].annotation_level).toBe('failure')
  })

  it('flaky test with success first should still pass with retries tracked', async () => {
    // Test that even if success comes first and failures come later,
    // the test is still marked as success with proper retry count
    const testResult = await parseFile(
      'test_results/flaky_retries/flaky_success_first.xml',
      '',
      true,   // includePassed
      true,   // annotateNotice
      true    // checkRetries
    )
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, failedCount, passedCount, retriedCount, globalAnnotations} = testResult!!

    // Should have 1 unique test after deduplication
    expect(totalCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(failedCount).toBe(0)
    expect(passedCount).toBe(1)
    expect(retriedCount).toBe(2)  // 2 retries (3 occurrences - 1)

    // Should be marked as success
    expect(globalAnnotations).toHaveLength(1)
    expect(globalAnnotations[0].status).toBe('success')
    expect(globalAnnotations[0].retries).toBe(2)
    expect(globalAnnotations[0].annotation_level).toBe('notice')
  })

  it('same test name but different classname/file should NOT be merged', async () => {
    // Verify that tests with the same name but different classname or file are treated as separate tests
    const testResult = await parseFile(
      'test_results/flaky_retries/flaky_with_classname_file.xml',
      '',
      true,   // includePassed
      true,   // annotateNotice
      true    // checkRetries
    )
    expect(testResult).toBeDefined()
    const {totalCount, globalAnnotations} = testResult!!

    // Should have 3 unique tests:
    // 1. test_foo from test_foo.TestFoo (flaky, merged)
    // 2. test_foo from test_bar.TestBar (separate)
    // 3. test_baz from test_baz.TestBaz
    expect(totalCount).toBe(3)
    expect(globalAnnotations).toHaveLength(3)

    // Verify we have two different test_foo entries (one from each classname)
    const testFooAnnotations = globalAnnotations.filter(a => a.title.includes('test_foo'))
    expect(testFooAnnotations).toHaveLength(2)

    // The one from TestFoo should have retries, the one from TestBar should not
    const testFooFromTestFoo = testFooAnnotations.find(a => a.path.includes('test_foo.py'))
    const testFooFromTestBar = testFooAnnotations.find(a => a.path.includes('test_bar.py'))

    expect(testFooFromTestFoo).toBeDefined()
    expect(testFooFromTestFoo!.retries).toBe(2)

    expect(testFooFromTestBar).toBeDefined()
    expect(testFooFromTestBar!.retries).toBe(0)
  })
})

describe('parseTestReports', () => {
  it('should parse disabled tests', async () => {
    const {checkName, summary, totalCount, skipped, failed, passed, globalAnnotations} = await parseTestReports(
      'checkName',
      'summary',
      'test_results/issues/testFailedDisabled.xml',
      '*',
      true,
      true,
      true,
      [],
      '{{SUITE_NAME}}/{{TEST_NAME}}',
      '/'
    )

    expect(checkName).toBe('checkName')
    expect(summary).toBe('summary')
    expect(totalCount).toBe(1)
    expect(skipped).toBe(1)
    expect(failed).toBe(0)
    expect(passed).toBe(0)
    expect(globalAnnotations).toStrictEqual([
      {
        path: 'MiscTests - OS X',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 0,
        annotation_level: 'notice',
        status: 'skipped',
        time: 0,
        title: 'random suite/testSmemArithmetic',
        message: 'Assert: Boolean true check failed.',
        raw_details: 'Assert: Boolean true check failed.'
      }
    ])
  })

  it('should parse retried tests', async () => {
    const {checkName, summary, totalCount, skipped, failed, passed, retried, globalAnnotations} =
      await parseTestReports(
        'checkName',
        'summary',
        'test_results/junit-server-test/report.xml',
        '*',
        true,
        true,
        true,
        [],
        '{{SUITE_NAME}}/{{TEST_NAME}}',
        '/'
      )

    expect(checkName).toBe('checkName')
    expect(summary).toBe('summary')
    expect(totalCount).toBe(3)
    expect(skipped).toBe(1)
    expect(failed).toBe(0)
    expect(passed).toBe(2)
    expect(retried).toBe(1)
    expect(globalAnnotations).toStrictEqual([
      {
        path: 'com/example/example/server/v8/channels/api4',
        start_line: 1,
        end_line: 1,
        start_column: 0,
        end_column: 0,
        retries: 1,
        annotation_level: 'notice',
        status: 'success',
        time: 7.78,
        title: 'github.com/example/example/server/v8/channels/api4/TestWebSocketReconnectRace',
        message: 'TestWebSocketReconnectRace',
        raw_details: ''
      },
      {
        annotation_level: 'notice',
        end_column: 0,
        end_line: 1,
        message: 'TestCreateChannelBookmark',
        path: 'com/example/example/server/v8/channels/api4',
        raw_details: '',
        retries: 0,
        start_column: 0,
        start_line: 1,
        status: 'skipped',
        time: 0,
        title: 'github.com/example/example/server/v8/channels/api4/TestCreateChannelBookmark'
      },
      {
        annotation_level: 'notice',
        end_column: 0,
        end_line: 1,
        message: 'TestWebSocketUpgrade',
        path: 'com/example/example/server/v8/channels/api4',
        raw_details: '',
        retries: 0,
        start_column: 0,
        start_line: 1,
        status: 'success',
        time: 2.17,
        title: 'github.com/example/example/server/v8/channels/api4/TestWebSocketUpgrade'
      }
    ])
  })

  it('should handle multiple failures per test case correctly', async () => {
    const testResult = await parseFile('test_results/multiple_failures/test_multiple_failures.xml', '', true)
    expect(testResult).toBeDefined()
    const {totalCount, skippedCount, failedCount, passedCount, globalAnnotations} = testResult!!

    // Verify overall counts
    expect(totalCount).toBe(4) // 4 total test cases
    expect(skippedCount).toBe(1) // 1 skipped test
    expect(failedCount).toBe(2) // 2 test cases with failures (testWithMultipleFailures, testWithSingleFailure)
    expect(passedCount).toBe(1) // 1 passing test

    // Filter to only failure annotations for easier verification
    const failureAnnotations = globalAnnotations.filter(annotation => annotation.annotation_level === 'failure')

    // Should have 4 failure annotations total: 3 from testWithMultipleFailures + 1 from testWithSingleFailure
    expect(failureAnnotations).toHaveLength(4)

    // Verify the multiple failures test case creates separate annotations
    const multipleFailuresAnnotations = failureAnnotations.filter(annotation =>
      annotation.title.includes('testWithMultipleFailures')
    )
    expect(multipleFailuresAnnotations).toHaveLength(3)

    // Verify each failure has the correct index in the title
    expect(multipleFailuresAnnotations[0].title).toBe('MultipleFailuresTest.testWithMultipleFailures (failure 1/3)')
    expect(multipleFailuresAnnotations[0].message).toBe('First assertion failed')
    expect(multipleFailuresAnnotations[0].raw_details).toContain('First failure stack trace details')
    expect(multipleFailuresAnnotations[0].start_line).toBe(15)

    expect(multipleFailuresAnnotations[1].title).toBe('MultipleFailuresTest.testWithMultipleFailures (failure 2/3)')
    expect(multipleFailuresAnnotations[1].message).toBe('Second assertion failed')
    expect(multipleFailuresAnnotations[1].raw_details).toContain('Second failure stack trace details')
    expect(multipleFailuresAnnotations[1].start_line).toBe(20)

    expect(multipleFailuresAnnotations[2].title).toBe('MultipleFailuresTest.testWithMultipleFailures (failure 3/3)')
    expect(multipleFailuresAnnotations[2].message).toBe('Third assertion failed')
    expect(multipleFailuresAnnotations[2].raw_details).toContain('Third failure stack trace details')
    expect(multipleFailuresAnnotations[2].start_line).toBe(25)

    // Verify the single failure test case (should not have failure index in title)
    const singleFailureAnnotations = failureAnnotations.filter(annotation =>
      annotation.title.includes('testWithSingleFailure')
    )
    expect(singleFailureAnnotations).toHaveLength(1)
    expect(singleFailureAnnotations[0].title).toBe('MultipleFailuresTest.testWithSingleFailure')
    expect(singleFailureAnnotations[0].message).toBe('Single failure message')

    // Verify all failure annotations have the correct properties
    failureAnnotations.forEach(annotation => {
      expect(annotation.annotation_level).toBe('failure')
      expect(annotation.status).toBe('failure')
      expect(annotation.retries).toBe(0)
      expect(annotation.path).toBe('MultipleFailuresTest')
      expect(annotation.start_column).toBe(0)
      expect(annotation.end_column).toBe(0)
    })

    // Verify that success and skipped test cases don't have failure annotations
    const successAnnotations = globalAnnotations.filter(annotation => annotation.status === 'success')
    const skippedAnnotations = globalAnnotations.filter(annotation => annotation.status === 'skipped')
    expect(successAnnotations).toHaveLength(1)
    expect(skippedAnnotations).toHaveLength(1)
  })

  it('parse corrupt test output', async () => {
    const result = await parseTestReports(
      '',
      '',
      'test_results/corrupt-junit/**/target/sf-reports/TEST-*.xml',
      '',
      false,
      false,
      false,
      [],
      '',
      '/',
      '',
      undefined,
      false,
      undefined
    )

    expect(result).toStrictEqual({
      checkName: '',
      summary: '',
      time: 0,
      totalCount: 0,
      skipped: 0,
      failed: 0,
      foundFiles: 1,
      globalAnnotations: [],
      passed: 0,
      retried: 0,
      testResults: []
    })
  })
})
