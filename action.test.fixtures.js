const finishedWithFailures = {
    name: 'Test Report',
    head_sha: 'sha123',
    status: 'completed',
    conclusion: 'failure',
    output: {
        title: '17 tests run, 1 skipped, 11 failed.',
        summary: '',
        annotations: [
            {
                path:
                    'tests/email/src/test/java/action/surefire/report/email/EmailAddressTest.java',
                start_line: 39,
                end_line: 39,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'EmailAddressTest.shouldNotContainInternationalizedHostNames',
                message: "Invalid email address 'user@ñandú.com.ar'",
                raw_details:
                    "action.surefire.report.email.InvalidEmailAddressException: Invalid email address 'user@ñandú.com.ar'\n\tat action.surefire.report.email.EmailAddressTest.expectException(EmailAddressTest.java:74)\n\tat action.surefire.report.email.EmailAddressTest.shouldNotContainInternationalizedHostNames(EmailAddressTest.java:39)"
            },
            {
                path:
                    'tests/email/src/test/java/action/surefire/report/email/EmailAddressTest.java',
                start_line: 49,
                end_line: 49,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'EmailAddressTest.shouldBeStricterThanRfc2821',
                message: "Invalid email address 'Abc\\@def@example.com'",
                raw_details:
                    "action.surefire.report.email.InvalidEmailAddressException: Invalid email address 'Abc\\@def@example.com'\n\tat action.surefire.report.email.EmailAddressTest.expectException(EmailAddressTest.java:74)\n\tat action.surefire.report.email.EmailAddressTest.shouldBeStricterThanRfc2821(EmailAddressTest.java:49)"
            },
            {
                path:
                    'tests/email/src/test/java/action/surefire/report/email/EmailAddressTest.java',
                start_line: 57,
                end_line: 57,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'EmailAddressTest.shouldBeStricterThanRfc2822',
                message: 'Address aba@bab.com should have thrown InvalidEmailAddressException',
                raw_details:
                    'java.lang.AssertionError: Address aba@bab.com should have thrown InvalidEmailAddressException\n\tat action.surefire.report.email.EmailAddressTest.expectException(EmailAddressTest.java:75)\n\tat action.surefire.report.email.EmailAddressTest.shouldBeStricterThanRfc2822(EmailAddressTest.java:57)'
            },
            {
                path:
                    'tests/email/src/test/java/action/surefire/report/email/EmailAddressTest.java',
                start_line: 18,
                end_line: 18,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'EmailAddressTest.shouldNotBeBlank',
                message: 'Email address must not be null, empty, or blanks',
                raw_details:
                    'action.surefire.report.email.InvalidEmailAddressException: Email address must not be null, empty, or blanks\n\tat action.surefire.report.email.EmailAddressTest.expectException(EmailAddressTest.java:74)\n\tat action.surefire.report.email.EmailAddressTest.shouldNotBeBlank(EmailAddressTest.java:18)'
            },
            {
                path:
                    'tests/email/src/test/java/action/surefire/report/email/EmailAddressTest.java',
                start_line: 32,
                end_line: 32,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'EmailAddressTest.shouldNotContainLocalHosts',
                message: "Invalid email address 'user@host'",
                raw_details:
                    "action.surefire.report.email.InvalidEmailAddressException: Invalid email address 'user@host'\n\tat action.surefire.report.email.EmailAddressTest.expectException(EmailAddressTest.java:74)\n\tat action.surefire.report.email.EmailAddressTest.shouldNotContainLocalHosts(EmailAddressTest.java:32)"
            },
            {
                path:
                    'tests/email/src/test/java/action/surefire/report/email/EmailAddressTest.java',
                start_line: 25,
                end_line: 25,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'EmailAddressTest.shouldNotMissComponents',
                message:
                    'Address user-without-host@test.com should have thrown InvalidEmailAddressException',
                raw_details:
                    'java.lang.AssertionError: Address user-without-host@test.com should have thrown InvalidEmailAddressException\n\tat action.surefire.report.email.EmailAddressTest.expectException(EmailAddressTest.java:75)\n\tat action.surefire.report.email.EmailAddressTest.shouldNotMissComponents(EmailAddressTest.java:25)'
            },
            {
                path:
                    'tests/email/src/test/java/action/surefire/report/email/EmailAddressTest.java',
                start_line: 66,
                end_line: 66,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'EmailAddressTest.shouldNotAllowDotsInWeirdPlaces',
                message: "Invalid email address '.user@host.com'",
                raw_details:
                    "action.surefire.report.email.InvalidEmailAddressException: Invalid email address '.user@host.com'\n\tat action.surefire.report.email.EmailAddressTest.expectException(EmailAddressTest.java:74)\n\tat action.surefire.report.email.EmailAddressTest.shouldNotAllowDotsInWeirdPlaces(EmailAddressTest.java:66)"
            },
            {
                path: 'tests/utils/src/test/java/action/surefire/report/calc/CalcUtilsTest.kt',
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
                path: 'tests/utils/src/test/java/action/surefire/report/calc/CalcUtilsTest.kt',
                start_line: 15,
                end_line: 15,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'CalcUtilsTest.test scale',
                message: 'Expected: <100.10>\n     but: was <100.11>',
                raw_details:
                    'java.lang.AssertionError: \n\nExpected: <100.10>\n     but: was <100.11>\n\tat action.surefire.report.calc.CalcUtilsTest.test scale(CalcUtilsTest.kt:15)'
            },
            {
                path: 'tests/utils/src/test/java/action/surefire/report/calc/StringUtilsTest.java',
                start_line: 27,
                end_line: 27,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'StringUtilsTest.require_fail',
                message:
                    'Expected: (an instance of java.lang.IllegalArgumentException and exception with message a string containing "This is unexpected")\n     but: exception with message a string containing "This is unexpected" message was "Input=\'\' didn\'t match condition."\nStacktrace was: java.lang.IllegalArgumentException: Input=\'\' didn\'t match condition.\n\tat action.surefire.report.calc.StringUtils.requireNotBlank(StringUtils.java:25)\n\tat action.surefire.report.calc.StringUtils.requireNotBlank(StringUtils.java:18)\n\tat action.surefire.report.calc.StringUtilsTest.require_fail(StringUtilsTest.java:27)\n\tat sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)\n\tat sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)\n\tat sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)\n\tat java.lang.reflect.Method.invoke(Method.java:498)\n\tat org.junit.runners.model.FrameworkMethod$1.runReflectiveCall(FrameworkMethod.java:59)\n\tat org.junit.internal.runners.model.ReflectiveCallable.run(ReflectiveCallable.java:12)\n\tat org.junit.runners.model.FrameworkMethod.invokeExplosively(FrameworkMethod.java:56)\n\tat org.junit.internal.runners.statements.InvokeMethod.evaluate(InvokeMethod.java:17)\n\tat org.junit.rules.ExpectedException$ExpectedExceptionStatement.evaluate(ExpectedException.java:258)\n\tat org.junit.runners.ParentRunner$3.evaluate(ParentRunner.java:306)\n\tat org.junit.runners.BlockJUnit4ClassRunner$1.evaluate(BlockJUnit4ClassRunner.java:100)\n\tat org.junit.runners.ParentRunner.runLeaf(ParentRunner.java:366)\n\tat org.junit.runners.BlockJUnit4ClassRunner.runChild(BlockJUnit4ClassRunner.java:103)\n\tat org.junit.runners.BlockJUnit4ClassRunner.runChild(BlockJUnit4ClassRunner.java:63)\n\tat org.junit.runners.ParentRunner$4.run(ParentRunner.java:331)\n\tat org.junit.runners.ParentRunner$1.schedule(ParentRunner.java:79)\n\tat org.junit.runners.ParentRunner.runChildren(ParentRunner.java:329)\n\tat org.junit.runners.ParentRunner.access$100(ParentRunner.java:66)\n\tat org.junit.runners.ParentRunner$2.evaluate(ParentRunner.java:293)\n\tat org.junit.runners.ParentRunner$3.evaluate(ParentRunner.java:306)\n\tat org.junit.runners.ParentRunner.run(ParentRunner.java:413)\n\tat org.apache.maven.surefire.junit4.JUnit4Provider.execute(JUnit4Provider.java:365)\n\tat org.apache.maven.surefire.junit4.JUnit4Provider.executeWithRerun(JUnit4Provider.java:273)\n\tat org.apache.maven.surefire.junit4.JUnit4Provider.executeTestSet(JUnit4Provider.java:238)\n\tat org.apache.maven.surefire.junit4.JUnit4Provider.invoke(JUnit4Provider.java:159)\n\tat org.apache.maven.surefire.booter.ForkedBooter.invokeProviderInSameClassLoader(ForkedBooter.java:384)\n\tat org.apache.maven.surefire.booter.ForkedBooter.runSuitesInProcess(ForkedBooter.java:345)\n\tat org.apache.maven.surefire.booter.ForkedBooter.execute(ForkedBooter.java:126)\n\tat org.apache.maven.surefire.booter.ForkedBooter.main(ForkedBooter.java:418)',
                raw_details:
                    'java.lang.AssertionError: \n\nExpected: (an instance of java.lang.IllegalArgumentException and exception with message a string containing "This is unexpected")\n     but: exception with message a string containing "This is unexpected" message was "Input=\'\' didn\'t match condition."\nStacktrace was: java.lang.IllegalArgumentException: Input=\'\' didn\'t match condition.\n\tat action.surefire.report.calc.StringUtils.requireNotBlank(StringUtils.java:25)\n\tat action.surefire.report.calc.StringUtils.requireNotBlank(StringUtils.java:18)\n\tat action.surefire.report.calc.StringUtilsTest.require_fail(StringUtilsTest.java:27)\n\tat sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)\n\tat sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)\n\tat sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)\n\tat java.lang.reflect.Method.invoke(Method.java:498)\n\tat org.junit.runners.model.FrameworkMethod$1.runReflectiveCall(FrameworkMethod.java:59)\n\tat org.junit.internal.runners.model.ReflectiveCallable.run(ReflectiveCallable.java:12)\n\tat org.junit.runners.model.FrameworkMethod.invokeExplosively(FrameworkMethod.java:56)\n\tat org.junit.internal.runners.statements.InvokeMethod.evaluate(InvokeMethod.java:17)\n\tat org.junit.rules.ExpectedException$ExpectedExceptionStatement.evaluate(ExpectedException.java:258)\n\tat org.junit.runners.ParentRunner$3.evaluate(ParentRunner.java:306)\n\tat org.junit.runners.BlockJUnit4ClassRunner$1.evaluate(BlockJUnit4ClassRunner.java:100)\n\tat org.junit.runners.ParentRunner.runLeaf(ParentRunner.java:366)\n\tat org.junit.runners.BlockJUnit4ClassRunner.runChild(BlockJUnit4ClassRunner.java:103)\n\tat org.junit.runners.BlockJUnit4ClassRunner.runChild(BlockJUnit4ClassRunner.java:63)\n\tat org.junit.runners.ParentRunner$4.run(ParentRunner.java:331)\n\tat org.junit.runners.ParentRunner$1.schedule(ParentRunner.java:79)\n\tat org.junit.runners.ParentRunner.runChildren(ParentRunner.java:329)\n\tat org.junit.runners.ParentRunner.access$100(ParentRunner.java:66)\n\tat org.junit.runners.ParentRunner$2.evaluate(ParentRunner.java:293)\n\tat org.junit.runners.ParentRunner$3.evaluate(ParentRunner.java:306)\n\tat org.junit.runners.ParentRunner.run(ParentRunner.java:413)\n\tat org.apache.maven.surefire.junit4.JUnit4Provider.execute(JUnit4Provider.java:365)\n\tat org.apache.maven.surefire.junit4.JUnit4Provider.executeWithRerun(JUnit4Provider.java:273)\n\tat org.apache.maven.surefire.junit4.JUnit4Provider.executeTestSet(JUnit4Provider.java:238)\n\tat org.apache.maven.surefire.junit4.JUnit4Provider.invoke(JUnit4Provider.java:159)\n\tat org.apache.maven.surefire.booter.ForkedBooter.invokeProviderInSameClassLoader(ForkedBooter.java:384)\n\tat org.apache.maven.surefire.booter.ForkedBooter.runSuitesInProcess(ForkedBooter.java:345)\n\tat org.apache.maven.surefire.booter.ForkedBooter.execute(ForkedBooter.java:126)\n\tat org.apache.maven.surefire.booter.ForkedBooter.main(ForkedBooter.java:418)'
            },
            {
                path: 'tests/utils/src/test/java/action/surefire/report/calc/StringUtilsTest.java',
                start_line: 20,
                end_line: 20,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'StringUtilsTest.require',
                message:
                    'java.lang.AssertionError\n\tat action.surefire.report.calc.StringUtilsTest.require(StringUtilsTest.java:20)',
                raw_details:
                    'java.lang.AssertionError\n\tat action.surefire.report.calc.StringUtilsTest.require(StringUtilsTest.java:20)'
            }
        ]
    }
};

const finishedSuccess = {
    name: 'Test Report',
    head_sha: 'sha123',
    status: 'completed',
    conclusion: 'success',
    output: {
        title: '1 tests run, 0 skipped, 0 failed.',
        summary: '',
        annotations: []
    }
};

const masterSuccess = {
    name: 'Test Report',
    head_sha: 'masterSha123',
    status: 'completed',
    conclusion: 'success',
    output: {
        title: '1 tests run, 0 skipped, 0 failed.',
        summary: '',
        annotations: []
    }
};

const nothingFound = {
    name: 'Test Report',
    head_sha: 'sha123',
    status: 'completed',
    conclusion: 'failure',
    output: {
        title: 'No test results found!',
        summary: '',
        annotations: []
    }
};

module.exports = { finishedWithFailures, finishedSuccess, nothingFound, masterSuccess };
