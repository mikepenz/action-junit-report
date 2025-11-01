<div align="center">
  :octocat:
</div>
<h1 align="center">
  action-junit-report
</h1>

<p align="center">
    ... reports JUnit test results as GitHub pull request check.
</p>

<div align="center">
  <img src=".github/images/action.png"/>
</div>

<div align="center">
  <a href="https://github.com/mikepenz/action-junit-report">
		<img src="https://github.com/mikepenz/action-junit-report/workflows/CI/badge.svg"/>
	</a>
</div>
<br />

-------

<p align="center">
    <a href="#whats-included-">What's included 🚀</a> &bull;
    <a href="#setup">Setup 🛠️</a> &bull;
    <a href="#sample-%EF%B8%8F">Sample 🖥️</a> &bull;
    <a href="#contribute-">Contribute 🧬</a> &bull;
    <a href="#license">License 📓</a>
</p>

-------

### What's included 🚀

- Flexible JUnit parser with wide support
- Supports nested test suites
- Blazingly fast execution
- Lighweight
- Rich build log output

This action processes JUnit XML test reports on pull requests and shows the result as a PR check with summary and
annotations.

Based on action for [Surefire Reports by ScaCap](https://github.com/ScaCap/action-surefire-report)

## Setup

### Configure the workflow

```yml
name: build
on:
  pull_request:

jobs:
  build:
    name: Build and Run Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
      - name: Build and Run Tests
        run: # execute your tests generating test results
      - name: Publish Test Report
        uses: mikepenz/action-junit-report@v5
        if: success() || failure() # always run even if the previous step fails
        with:
          report_paths: '**/build/test-results/test/TEST-*.xml'
```

### Inputs

| **Input**                    | **Description**                                                                                                                                                                                     |
|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `report_paths`               | Optional. [Glob](https://github.com/actions/toolkit/tree/master/packages/glob) expression to junit report paths. Defaults to: `**/junit-reports/TEST-*.xml`.                                        |
| `token`                      | Optional. GitHub token for creating a check run. Set to `${{ github.token }}` by default.                                                                                                           |
| `group_reports`              | Optional. Defines if different reports found by a single `report_paths` glob expression are grouped together. Defaults to `true`.                                                                   |
| `test_files_prefix`          | Optional. Prepends the provided prefix to test file paths within the report when annotating on GitHub.                                                                                              |
| `exclude_sources`            | Optional. Provide `,` seperated array of folders to ignore for source lookup. Defaults to: `/build/,/__pycache__/`                                                                                  |
| `check_name`                 | Optional. Check name to use when creating a check run. The default is `JUnit Test Report`.                                                                                                          |
| `suite_regex`                | REMOVED (as of v5). Instead use `check_title_template` and configure: `{{BREAD_CRUMB}}{{SUITE_NAME}}/{{TEST_NAME}}`                                                                                 |
| `commit`                     | Optional. The commit SHA to update the status. This is useful when you run it with `workflow_run`.                                                                                                  |
| `fail_on_failure`            | Optional. Fail the build in case of a test failure.                                                                                                                                                 |
| `fail_on_parse_error`        | Optional. Fail the build if the test report file cannot be parsed.                                                                                                                                  |
| `require_tests`              | Optional. Fail if no test are found.                                                                                                                                                                |
| `require_passed_tests`       | Optional. Fail if no passed test are found. (This is stricter than `require_tests`, which accepts skipped tests).                                                                                   |
| `include_passed`             | Optional. By default the action will skip passed items for the annotations. Enable this flag to include them.                                                                                       |
| `include_skipped`            | Optional. Controls whether skipped tests are included in the detailed summary table. Defaults to `true`.                                                                                             |
| `check_retries`              | Optional. If a testcase is retried, ignore the original failure.                                                                                                                                    |
| `check_title_template`       | Optional. Template to configure the title format. Placeholders: {{FILE_NAME}}, {{SUITE_NAME}}, {{TEST_NAME}}, {{CLASS_NAME}}, {{BREAD_CRUMB}}.                                                      |
| `bread_crumb_delimiter`      | Optional. Defines the delimiter characters between the breadcrumb elements. Defaults to: `/`.                                                                                                       |
| `summary`                    | Optional. Additional text to summary output                                                                                                                                                         |
| `check_annotations`          | Optional. Defines if the checks will include annotations. If disabled skips all annotations for the check. (This does not affect `annotate_only`, which uses no checks).                            |
| `update_check`               | Optional. Uses an alternative API to update checks, use for cases with more than 50 annotations. Default: `false`.                                                                                  |
| `annotate_only`              | Optional. Will only annotate the results on the files, won't create a check run. Defaults to `false`.                                                                                               |
| `transformers`               | Optional. Array of `Transformer`s offering the ability to adjust the fileName. Defaults to: `[{"searchValue":"::","replaceValue":"/"}]`                                                             |
| `job_summary`                | Optional. Enables the publishing of the job summary for the results. Defaults to `true`. May be required to disable [Enterprise Server](https://github.com/mikepenz/action-junit-report/issues/637) |
| `job_summary_text`           | Optional. Additional text to include in the job summary prior to the tables. Defaults to empty string.                                                                                              |
| `detailed_summary`           | Optional. Include table with all test results in the summary (Also applies to comment). Defaults to `false`.                                                                                        |
| `flaky_summary`              | Optional. Include table with all flaky results in the summary (Also applies to comment). Defaults to `false`.                                                                                       |
| `verbose_summary`            | Optional. Detail table will note if there were no test annotations for a test suite (Also applies to comment). Defaults to `true`.                                                                  |
| `skip_success_summary`       | Optional. Skips the summary table if only successful tests were detected (Also applies to comment). Defaults to `false`.                                                                            |
| `include_empty_in_summary`   | Optional. Include entries in summaries that have 0 count. Defaults to `true`.                                                                                                                       |
| `include_time_in_summary`    | Optional. Include spent time in summaries. Defaults to `false`.                                                                                                                                     |
| `simplified_summary`         | Optional. Use icons instead of text to indicate status in summary. Defaults to `false`.                                                                                                             |
| `group_suite`                | Optional. If enabled, will group the testcases by test suite in the `detailed_summary`. Defaults to `false`.                                                                                        |
| `comment`                    | Optional. Enables a comment being added to the PR with the summary tables (Respects the summary configuration flags). Defaults to `false`.                                                          |
| `updateComment`              | Optional. If a prior action run comment exists, it is updated. If disabled, new comments are creted for each run. Defaults to `true`.                                                               |
| `annotate_notice`            | Optional. Annotate passed test results along with warning/failed ones. Defaults to `false`. (Changed in v3.5.0)                                                                                     |
| `follow_symlink`             | Optional. Enables to follow symlinks when searching test files via the globber. Defaults to `false`.                                                                                                |
| `job_name`                   | Optional. Specify the name of a check to update                                                                                                                                                     |
| `annotations_limit`          | Optional. Specify the limit for annotations. This will also interrupt parsing all test-suites if the limit is reached. Defaults to: `No Limit`.                                                     |
| `skip_annotations`           | Optional. Setting this flag will result in no annotations being added to the run. Defaults to `false`.                                                                                              |
| `truncate_stack_traces`      | Optional. Truncate stack traces from test output to 2 lines in annotations. Defaults to `true`.                                                                                                     |
| `resolve_ignore_classname`   | Optional. Force ignore test case classname from the xml report (This can help fix issues with some tools/languages). Defaults to `false`.                                                           |
| `skip_comment_without_tests` | Optional. Disable commenting if no tests are detected. Defaults to `false`.                                                                                                                         |
| `pr_id`                      | Optional. PR number to comment on (useful for workflow_run contexts where the action runs outside the PR context). When provided, overrides the automatic PR detection.                             |

### Common Configurations

<details><summary><b>Common report_paths</b></summary>
<p>

- Surefire:
  `**/target/surefire-reports/TEST-*.xml`
- sbt:
  `**/target/test-reports/*.xml`

</p>
</details>

If you observe out-of-memory errors, follow the below configuration suggestion.

> [!TIP]
> FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory

<details><summary><b>Increase Node Heap Memory</b></summary>
<p>

If you encounter an out-of-memory from Node, such as

```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

you can increase the memory allocation by setting an environment variable

```yaml
- name: Publish Test Report
  uses: mikepenz/action-junit-report@v5
  env:
    NODE_OPTIONS: "--max-old-space-size=4096"
  if: success() || failure() # always run even if the previous step fails
  with:
    report_paths: '**/build/test-results/test/TEST-*.xml'
```

</p>
</details>

### Action outputs

After action execution it will return the test counts as output.

```yml
# ${{steps.{CHANGELOG_STEP_ID}.outputs.total}}
```

A full set list of possible output values for this action.

| **Output**                 | **Description**                                                                                                     |
|----------------------------|---------------------------------------------------------------------------------------------------------------------|
| `outputs.total`            | The total number of test cases covered by this test-step.                                                           |
| `outputs.passed`           | The number of passed test cases.                                                                                    |
| `outputs.skipped`          | The number of skipped test cases.                                                                                   |
| `outputs.retried`          | The number of retried test cases.                                                                                   |
| `outputs.failed`           | The number of failed test cases.                                                                                    |
| `outputs.summary`          | The short summary of the junit report. In html format (as also constructed by GitHub for the summary).              |
| `outputs.detailed_summary` | The full table with all test results in a summary. In html format (as also constructed by GitHub for the summary).  |
| `outputs.flaky_summary`    | The full table with all flaky results in a summary. In html format (as also constructed by GitHub for the summary). |
| `outputs.report_url`       | The URL(s) to the test report(s). If multiple reports are created, they are separated by newlines.                  |

### PR run permissions

The action requires `write` permission on the checks. If the GA token is `read-only` (this is a repository
configuration) please enable `write` permission via:

```yml
permissions:
  checks: write
  pull-requests: write # only required if `comment: true` was enabled
```

Additionally for [security reasons], the github token used for `pull_request` workflows is [marked as read-only].
If you want to post checks to a PR from an external repository, you will need to use a separate workflow
which has a read/write token, or use a PAT with elevated permissions.

[security reasons]: https://securitylab.github.com/research/github-actions-preventing-pwn-requests/

[marked as read-only]: https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token

<details><summary><b>Example</b></summary>
<p>

```yml
name: build
on:
  pull_request:

jobs:
  build:
    name: Build and Run Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3
      - name: Build and Run Tests
        run: # execute your tests generating test results
      - name: Upload Test Report
        uses: actions/upload-artifact@v3
        if: always() # always run even if the previous step fails
        with:
          name: junit-test-results
          path: '**/build/test-results/test/TEST-*.xml'
          retention-days: 1

---
name: report
on:
  workflow_run:
    workflows: [ build ]
    types: [ completed ]

permissions:
  checks: write

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - name: Download Test Report
        uses: dawidd6/action-download-artifact@v2
        with:
          name: junit-test-results
          workflow: ${{ github.event.workflow.id }}
          run_id: ${{ github.event.workflow_run.id }}
      - name: Publish Test Report
        uses: mikepenz/action-junit-report@v5
        with:
          commit: ${{github.event.workflow_run.head_sha}}
          report_paths: '**/build/test-results/test/TEST-*.xml'
          # Optional: if you want to add PR comments from workflow_run context  
          # comment: true
          # pr_id: ${{ github.event.workflow_run.pull_requests[0].number }}
```

This will securely post the check results from the privileged workflow onto the PR's checks report.

> [!TIP]
> When running from `workflow_run` context, use the `pr_id` parameter to enable PR comments: `pr_id: ${{ github.event.workflow_run.pull_requests[0].number }}`

</p>
</details>

In environments that do not allow `checks: write`, the action can be configured to leverage the annotate\_only option.

<details><summary><b>Example</b></summary>
<p>

```yml
name: pr

on:
  pull_request:

jobs:
  unit_test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Build and Run Tests
        run: # execute your tests generating test results

      - name: Write out Unit Test report annotation for forked repo
        if: ${{ failure() &&  (github.event.pull_request.head.repo.full_name != github.repository) }}
        uses: mikepenz/action-junit-report@v5
        with:
          annotate_only: true # forked repo cannot write to checks so just do annotations
```

This will selectively use different methods for forked and unforked repos.
</p>
</details>

## Sample 🖥️

<div align="center">
  <img src=".github/images/annotated.png"/>
</div>

<div align="center">
  <img src=".github/images/annotations.png"/>
</div>

## Contribute 🧬

```bash
# Install the dependencies  
$ npm install

# Verify lint is happy
$ npm run lint -- --fix

# Format
$ npm run format

# Build the typescript and package it for distribution
$ npm run build && npm run package

# Run the tests, use to debug, and test it out
$ npm test
```

### Credits

Original idea and GitHub Actions by: https://github.com/ScaCap/action-surefire-report

## Other actions

- [release-changelog-builder-action](https://github.com/mikepenz/release-changelog-builder-action)
- [xray-action](https://github.com/mikepenz/xray-action/)
- [jira-release-composition-action](https://github.com/mikepenz/jira-release-composite-action)

## License

    Copyright (C) 2025 Mike Penz

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
