import { resolveFileAndLine, resolvePath, parseFile, Transformer } from '../src/testParser'

/**
 * Original test cases:
 *   Copyright 2020 ScaCap
 *   https://github.com/ScaCap/action-surefire-report/blob/master/utils.test.js
 *
 * New test cases:
 *   Copyright Mike Penz
 */
jest.setTimeout(10000)

describe('resolveFileAndLine', () => {
    it('should default to 1 if no line found', async () => {
        const { fileName, line } = await resolveFileAndLine(null, null, 'someClassName', 'not a stacktrace');
        expect(fileName).toBe('someClassName');
        expect(line).toBe(1);
    });

    it('should parse correctly fileName and line for a Java file', async () => {
        const { fileName, line } = await resolveFileAndLine(
            null,
            null, 
            'action.surefire.report.email.EmailAddressTest',
            `
action.surefire.report.email.InvalidEmailAddressException: Invalid email address 'user@ñandú.com.ar'
    at action.surefire.report.email.EmailAddressTest.expectException(EmailAddressTest.java:74)
    at action.surefire.report.email.EmailAddressTest.shouldNotContainInternationalizedHostNames(EmailAddressTest.java:39)
        `
        );
        expect(fileName).toBe('EmailAddressTest');
        expect(line).toBe(39);
    });

    it('should parse correctly fileName and line for a Kotlin file', async () => {
        const { fileName, line } = await resolveFileAndLine(
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
        );
        expect(fileName).toBe('CalcUtilsTest');
        expect(line).toBe(27);
    });

    it('should parse correctly fileName and line for extended stacktrace', async () => {
        const { fileName, line } = await resolveFileAndLine(
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
        );
        expect(fileName).toBe('StringUtilsTest');
        expect(line).toBe(26);
    });

    it('should parse correctly fileName and line for pytest', async () => {
        const { fileName, line } = await resolveFileAndLine(
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
        );
        expect(fileName).toBe('test.py');
        expect(line).toBe(14);
    });

    it('should parse correctly line number for rust tests', async () => {
      const { fileName, line } = await resolveFileAndLine(
        null,
        null, 
        'project',
        `thread &#x27;project::admission_webhook_tests::it_should_be_possible_to_update_projects&#x27; panicked at &#x27;boom&#x27;, tests/project/admission_webhook_tests.rs:48:38
note: run with &#x60;RUST_BACKTRACE&#x3D;1&#x60; environment variable to display a backtrace

  `
      );
      expect(line).toBe(48);
      expect(fileName).toBe('tests/project/admission_webhook_tests.rs');
    });

  it('should parse correctly line number for rust tests 2', async () => {
    const { fileName, line } = await resolveFileAndLine(
      null,
      null, 
      'project::manifest_secrets',
      `thread 'project::manifest_secrets::it_should_skip_annotated_manifests' panicked at 'assertion failed: \`(left == right)\`\\n" +
        '  left: \`0\`,\\n' +
        " right: \`42\`: all manifests should be skipped', tests/project/manifest_secrets.rs:305:5
  `
    );
    expect(line).toBe(305);
    expect(fileName).toBe('tests/project/manifest_secrets.rs');
  });
});

describe('resolvePath', () => {
    it('should find correct file for Java fileName', async () => {
        const path = await resolvePath('EmailAddressTest', ['/build/', '/__pycache__/']);
        expect(path).toBe(
            'test_results/tests/email/src/test/java/action/surefire/report/email/EmailAddressTest.java'
        );
    });

    it('should find correct file for Kotlin fileName', async () => {
        const path = await resolvePath('CalcUtilsTest', ['/build/', '/__pycache__/']);
        expect(path).toBe('test_results/tests/utils/src/test/java/action/surefire/report/calc/CalcUtilsTest.kt');
    });

    it('should find correct file with a relative path', async () => {
        const path = await resolvePath('./test_results/CalcUtilsTest.kt', ['/build/', '/__pycache__/']);
        expect(path).toBe('test_results/CalcUtilsTest.kt');
  })
});

describe('parseFile', () => {
    it('should parse CalcUtils results', async () => {
        const { totalCount, skipped, annotations } = await parseFile(
            'test_results/tests/utils/target/surefire-reports/TEST-action.surefire.report.calc.CalcUtilsTest.xml'
        );

        expect(totalCount).toBe(2);
        expect(skipped).toBe(0);
        expect(annotations).toStrictEqual([
            {
                path: 'test_results/tests/utils/src/test/java/action/surefire/report/calc/CalcUtilsTest.kt',
                start_line: 27,
                end_line: 27,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
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
                annotation_level: 'failure',
                title: 'CalcUtilsTest.test scale',
                message: 'Expected: <100.10>\n     but: was <100.11>',
                raw_details:
                    'java.lang.AssertionError: \n\nExpected: <100.10>\n     but: was <100.11>\n\tat action.surefire.report.calc.CalcUtilsTest.test scale(CalcUtilsTest.kt:15)'
            }
        ]);
    });
    it('should parse pytest results', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/python/report.xml');
        const filtered = annotations.filter(annotation =>  annotation.annotation_level !== 'notice')

        expect(totalCount).toBe(3);
        expect(skipped).toBe(0);
        expect(filtered).toStrictEqual([
            {
                path: 'test_results/python/test_sample.py',
                start_line: 10,
                end_line: 10,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
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
                annotation_level: 'failure',
                title: 'test_sample.test_with_error',
                message: "AttributeError: 'dict' object has no attribute 'attr'",
                raw_details:
                    "def test_with_error():\n        event = { 'attr': 'test'}\n>       assert event.attr == 'test'\nE       AttributeError: 'dict' object has no attribute 'attr'\n\npython/test_sample.py:14: AttributeError"
            }
        ]);
    });

    it('should parse pytest results 2', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/python/report.xml', '', false, false, ['/build/', '/__pycache__/'], undefined, 'subproject/');
        const filtered = annotations.filter(annotation =>  annotation.annotation_level !== 'notice')

        expect(totalCount).toBe(3);
        expect(skipped).toBe(0);
        expect(filtered).toStrictEqual([
            {
                path: 'subproject/test_results/python/test_sample.py',
                start_line: 10,
                end_line: 10,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'test_sample.test_which_fails',
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
                annotation_level: 'failure',
                title: 'test_sample.test_with_error',
                message: "AttributeError: 'dict' object has no attribute 'attr'",
                raw_details:
                    "def test_with_error():\n        event = { 'attr': 'test'}\n>       assert event.attr == 'test'\nE       AttributeError: 'dict' object has no attribute 'attr'\n\npython/test_sample.py:14: AttributeError"
            }
        ]);
    });

    it('should parse marathon results', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/marathon_tests/com.mikepenz.DummyTest#test_02_dummy.xml');
        const filtered = annotations.filter(annotation =>  annotation.annotation_level !== 'notice')

        expect(totalCount).toBe(1);
        expect(skipped).toBe(0);
        expect(filtered).toStrictEqual([]);
    });

    it('should parse marathon results and retrieve message', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/marathon_tests/com.mikepenz.DummyTest3#test_01.xml');

        expect(totalCount).toBe(1);
        expect(skipped).toBe(0);
        expect(annotations).toStrictEqual([
            {
                "annotation_level": "failure",
                "end_column": 0,
                "end_line": 1,
                "message": "test_01",
                "path": "DummyTest3",
                "raw_details": "",
                "start_column": 0,
                "start_line": 1,
                "title": "DummyTest3.test_01",
            }
        ]);
    });

    it('should parse and fail marathon results', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/marathon_tests/com.mikepenz.DummyUtilTest#test_01_dummy.xml');

        expect(totalCount).toBe(1);
        expect(skipped).toBe(0);
        expect(annotations).toStrictEqual([
            {
                "annotation_level": "failure",
                "end_column": 0,
                "end_line": 1,
                "message": "java.io.FileNotFoundException: No content provider: content://com.xyz/photo.jpg\nat android.content.ContentResolver.openTypedAssetFileDescriptor(ContentResolver.java:1969)",
                "path": "DummyUtilTest",
                "raw_details": "java.io.FileNotFoundException: No content provider: content://com.xyz/photo.jpg\nat android.content.ContentResolver.openTypedAssetFileDescriptor(ContentResolver.java:1969)\nat android.app.Instrumentation$InstrumentationThread.run(Instrumentation.java:2205)",
                "start_column": 0,
                "start_line": 1,
                "title": "DummyUtilTest.test_01_dummy",
            },
        ]);
    });

    it('should parse empty cunit results', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/cunit/testEmpty.xml');

        expect(totalCount).toBe(0);
        expect(skipped).toBe(0);
        expect(annotations).toStrictEqual([]);
    });

    it('should parse failure cunit results', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/cunit/testFailure.xml');
        const filtered = annotations.filter(annotation =>  annotation.annotation_level !== 'notice')

        expect(totalCount).toBe(4);
        expect(skipped).toBe(0);
        expect(filtered).toStrictEqual([
            {
                "annotation_level": "failure",
                "end_column": 0,
                "end_line": 1,
                "message": "false == something.loadXml(xml_string)",
                "path": "loadFromXMLString_When_Should2Test",
                "raw_details": "false == something.loadXml(xml_string)\nFile: /dumm/core/tests/testFailure.cpp\nLine: 77",
                "start_column": 0,
                "start_line": 1,
                "title": "loadFromXMLString_When_Should2Test",
            },
        ]);
    });

    it('should parse correctly fileName and line for a Java file with invalid chars', async () => {
        const { fileName, line } = await resolveFileAndLine(
            null,
            null, 
            'action.surefire.report.email.EmailAddressTest++',
            `
action.surefire.report.email.InvalidEmailAddressException: Invalid email address 'user@ñandú.com.ar'
    at action.surefire.report.email.EmailAddressTest.expectException(EmailAddressTest++.java:74)
    at action.surefire.report.email.EmailAddressTest.shouldNotContainInternationalizedHostNames(EmailAddressTest++.java:39)
        `
        );
        expect(fileName).toBe('EmailAddressTest++');
        expect(line).toBe(39);
    });

    it('should parse correctly nested test suites', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/nested/junit.xml', 'Test*');
        const filtered = annotations.filter(annotation =>  annotation.annotation_level !== 'notice')

        expect(totalCount).toBe(5);
        expect(skipped).toBe(0);
        expect(filtered).toStrictEqual([{
            "path": "A",
            "start_line": 1,
            "end_line": 1,
            "start_column": 0,
            "end_column": 0,
            "annotation_level": "failure",
            "title": "All tests/tests/packet/TestA/A",
            "message": "failure",
            "raw_details": ""
        }, {
            "path": "B",
            "start_line": 1,
            "end_line": 1,
            "start_column": 0,
            "end_column": 0,
            "annotation_level": "failure",
            "title": "All tests/tests/packet/TestB/B",
            "message": "failure",
            "raw_details": ""
        }, {
            "path": "A",
            "start_line": 1,
            "end_line": 1,
            "start_column": 0,
            "end_column": 0,
            "annotation_level": "failure",
            "title": "All tests/tests/packet/A",
            "message": "failure",
            "raw_details": ""
        }]);
    });

    it('should parse disabled tests', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/issues/testDisabled.xml', '*');
        const filtered = annotations.filter(annotation =>  annotation.annotation_level !== 'notice')

        expect(totalCount).toBe(22);
        expect(skipped).toBe(10);
        expect(filtered).toStrictEqual([{
            path: "factorial_of_value_from_fixture",
            start_line: 1,
            end_line: 1,
            start_column: 0,
            end_column: 0,
            annotation_level: "failure",
            title: "factorial/factorial_of_value_from_fixture",
            message: "tests/failed/main.cpp:58: error: check_eq(3628800, 3628801)",
            raw_details: "",
          }, {
            path: "factorial_of_value_from_fixture[0]",
            start_line: 1,
            end_line: 1,
            start_column: 0,
            end_column: 0,
            annotation_level: "failure",
            title: "factorial/factorial_of_value_from_fixture[0]",
            message: "tests/failed/main.cpp:97: error: condition was false",
            raw_details: "",
          }, {
            path: "positive_arguments_must_produce_expected_result",
            start_line: 1,
            end_line: 1,
            start_column: 0,
            end_column: 0,
            annotation_level: "failure",
            title: "factorial/positive_arguments_must_produce_expected_result",
            message: "uncaught std::exception: thrown by test",
            raw_details: "",
          }, {
            path: "positive_arguments_must_produce_expected_result[2]",
            start_line: 1,
            end_line: 1,
            start_column: 0,
            end_column: 0,
            annotation_level: "failure",
            title: "factorial/positive_arguments_must_produce_expected_result[2]",
            message: "tests/failed/main.cpp:73: error: condition was false",
            raw_details: "",
          }, {
            path: "test_which_fails_check_eq_with_custom_message",
            start_line: 1,
            end_line: 1,
            start_column: 0,
            end_column: 0,
            annotation_level: "failure",
            title: "factorial/test_which_fails_check_eq_with_custom_message",
            message: "tests/failed/main.cpp:49: error: check_eq(6, 7): hello world!",
            raw_details: "",
          }, {
            path: "test_which_throws_unknown_exception",
            start_line: 1,
            end_line: 1,
            start_column: 0,
            end_column: 0,
            annotation_level: "failure",
            title: "factorial/test_which_throws_unknown_exception",
            message: "uncaught unknown exception",
            raw_details: "",
          }]);
    });

    it('parse mocha test case', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/mocha/mocha.xml', '*', true);

        expect(totalCount).toBe(1);
        expect(skipped).toBe(0);
        expect(annotations).toStrictEqual([{
            "path": "/path/test/config.js",
            "start_line": 1,
            "end_line": 1,
            "start_column": 0,
            "end_column": 0,
            "annotation_level": "notice",
            "title": "/path/test/config.js.default config/Config files default config projectUTCOffset should be a callable with current UTC offset",
            "message": "Config files default config projectUTCOffset should be a callable with current UTC offset",
            "raw_details": ""
        }]);
    });

    it('parse mocha test case, custom title template', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/mocha/mocha.xml', '*', true, false, ['/build/', '/__pycache__/'], '{{TEST_NAME}}');

        expect(totalCount).toBe(1);
        expect(skipped).toBe(0);
        expect(annotations).toStrictEqual([{
            "path": "/path/test/config.js",
            "start_line": 1,
            "end_line": 1,
            "start_column": 0,
            "end_column": 0,
            "annotation_level": "notice",
            "title": "Config files default config projectUTCOffset should be a callable with current UTC offset",
            "message": "Config files default config projectUTCOffset should be a callable with current UTC offset",
            "raw_details": ""
        }]);
    });

    it('parse mocha test case, test files prefix', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/mocha/mocha.xml', '*', true, false, ['/build/', '/__pycache__/'], '{{TEST_NAME}}', 'subproject');

        expect(totalCount).toBe(1);
        expect(skipped).toBe(0);
        expect(annotations).toStrictEqual([{
            "path": "subproject/path/test/config.js",
            "start_line": 1,
            "end_line": 1,
            "start_column": 0,
            "end_column": 0,
            "annotation_level": "notice",
            "title": "Config files default config projectUTCOffset should be a callable with current UTC offset",
            "message": "Config files default config projectUTCOffset should be a callable with current UTC offset",
            "raw_details": ""
        }]);
    });

    it('should parse xunit results', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/xunit/report.xml');
        const filtered = annotations.filter(annotation =>  annotation.annotation_level !== 'notice')

        expect(totalCount).toBe(4);
        expect(skipped).toBe(0);
        expect(filtered).toStrictEqual([
            {
                path: "main.c",
                start_line: 38,
                end_line: 38,
                start_column: 0,
                end_column: 0,
                annotation_level: "failure",
                title: "main.c.test_my_sum_fail",
                message: "Expected 2 Was 0",
                raw_details: "",
              }
        ]);
    });

    it('should parse junit web test results', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/junit-web-test/expected.xml');
        const filtered = annotations.filter(annotation =>  annotation.annotation_level !== 'notice')

        expect(totalCount).toBe(6);
        expect(skipped).toBe(1);
        expect(filtered).toStrictEqual([
            {
                path: "packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js",
                start_line: 15,
                end_line: 15,
                start_column: 0,
                end_column: 0,
                annotation_level: "failure",
                title: "packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js.asserts error",
                message: "expected false to be true",
                raw_details: "AssertionError: expected false to be true\n  at o.<anonymous> (packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js:15:29)",
            }
        ]);
    });

    it('should handle retries', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/junit-web-test/expectedRetries.xml', '', false, true, ['/build/', '/__pycache__/']);
        const filtered = annotations.filter(annotation =>  annotation.annotation_level !== 'notice')

        expect(totalCount).toBe(7);
        expect(skipped).toBe(1);
        expect(filtered).toStrictEqual([
            {
                path: "packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js",
                start_line: 15,
                end_line: 15,
                start_column: 0,
                end_column: 0,
                annotation_level: "failure",
                title: "packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js.asserts error",
                message: "expected false to be true",
                raw_details: "AssertionError: expected false to be true\n  at o.<anonymous> (packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js:15:29)",
            }
        ]);
    });

    it('there should be two errors if retries are not handled', async () => {
        const { totalCount, skipped, annotations } = await parseFile('test_results/junit-web-test/expectedRetries.xml', '', false);
        const filtered = annotations.filter(annotation =>  annotation.annotation_level !== 'notice')

        expect(totalCount).toBe(8);
        expect(skipped).toBe(1);
        expect(filtered).toStrictEqual([
            {
                path: "packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js",
                start_line: 15,
                end_line: 15,
                start_column: 0,
                end_column: 0,
                annotation_level: "failure",
                title: "packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js.asserts error",
                message: "expected false to be true",
                raw_details: "AssertionError: expected false to be true\n  at o.<anonymous> (packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js:15:29)",
            },
            {
                annotation_level: "failure",
                end_column: 0,
                end_line: 15,
                message: "this is flaky, so is retried",
                path: "packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js",
                raw_details: "AssertionError: expected false to be true\n  at o.<anonymous> (packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js:15:29)",
                start_column: 0,
                start_line: 15,
                title: "packages/test-runner-junit-reporter/test/fixtures/multiple/simple-test.js.retried flaky test",
            }
        ]);
    });

    it('should parse and transform perl results', async () => {
        
        const transformer: Transformer[] =  [
            {
              searchValue: "\\.",
              replaceValue: "/",
            },
            {
                searchValue: "(.+?)_t",
                replaceValue: "$1\.t",
            }
        ]
        const { totalCount, skipped, annotations } = await parseFile('test_results/perl/result.xml', '', true, undefined, undefined, undefined, undefined, transformer);

        expect(totalCount).toBe(1);
        expect(skipped).toBe(0);
        expect(annotations).toStrictEqual([
            {
              path: "FileName.t",
              start_line: 1,
              end_line: 1,
              start_column: 0,
              end_column: 0,
              annotation_level: "notice",
              title: "FileName_t.L123: ...",
              message: "L123: ...",
              raw_details: "",
            },
        ]);
    });

    it('should parse and transform container-structure results (with no testsuite attributes)', async () => {

        const { totalCount, skipped, annotations } = await parseFile('test_results/container-structure/test.xml', '', true, undefined, undefined, undefined, undefined, undefined);

        expect(totalCount).toBe(3);
        expect(skipped).toBe(0);
        expect(annotations).toStrictEqual([
            {
                path: "Command Test: apt-get upgrade",
                start_line: 1,
                end_line: 1,
                start_column: 0,
                end_column: 0,
                annotation_level: "notice",
                title: "Command Test: apt-get upgrade",
                message: "Command Test: apt-get upgrade",
                raw_details: "",
            },
            {
                path: "File Existence Test: /home/app/app",
                start_line: 1,
                end_line: 1,
                start_column: 0,
                end_column: 0,
                annotation_level: "notice",
                title: "File Existence Test: /home/app/app",
                message: "File Existence Test: /home/app/app",
                raw_details: "",
            },
            {
                path: "Metadata Test",
                start_line: 1,
                end_line: 1,
                start_column: 0,
                end_column: 0,
                annotation_level: "notice",
                title: "Metadata Test",
                message: "Metadata Test",
                raw_details: "",
            },
        ]);
    });
});
