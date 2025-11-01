# Using action-junit-report with pytest

This document explains how to use action-junit-report with pytest to get accurate file annotations.

## Problem

Pytest generates JUnit XML reports with dot-separated classnames (e.g., `app.app_one.tests.test_util`) instead of file paths. This can cause issues when:
1. Multiple test files have the same name in different directories (e.g., `app_one/tests/test_util.py` and `app_two/tests/test_util.py`)
2. Test files might be confused with files in virtual environments (`.venv`)

## Solution

Use the `transformers` parameter to convert dot-separated classnames to file paths before resolution.

## Example Workflow

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.x'
      
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install pytest
      
      - name: Run tests
        run: pytest --junitxml=report.xml
        continue-on-error: true
      
      - name: Publish Test Report
        uses: mikepenz/action-junit-report@v5
        if: always()
        with:
          report_paths: '**/report.xml'
          check_name: 'Test Results'
          # Transform pytest classnames to file paths
          # Replace dots with slashes: app.tests.test_util -> app/tests/test_util
          transformers: '[{"searchValue": "\\.", "replaceValue": "/"}]'
          # Exclude virtual environment and cache directories
          exclude_sources: '.venv, __pycache__, .pytest_cache'
```

## How It Works

1. **Classname transformation**: The `transformers` parameter converts pytest's dot-separated classnames into file paths:
   - `app.app_one.tests.test_util` → `app/app_one/tests/test_util`

2. **File resolution**: The action then tries to find the actual file by:
   - First checking common extensions (`.py`, `.java`, `.kt`, etc.) for the transformed path
   - Falling back to glob pattern matching if direct resolution fails

3. **Exclusion**: The `exclude_sources` parameter ensures that files in virtual environments or cache directories are not mistakenly matched

## Advanced Configuration

### Multiple Transformers

You can chain multiple transformers to handle complex naming conventions:

```yaml
transformers: '[
  {"searchValue": "\\.", "replaceValue": "/"},
  {"searchValue": "_test$", "replaceValue": ".test"}
]'
```

### Custom Exclude Patterns

Exclude additional directories that shouldn't be searched:

```yaml
exclude_sources: '.venv, __pycache__, .pytest_cache, .tox, .eggs'
```

## Example Test Report

With the configuration above, annotations will correctly point to:
- `app/app_one/tests/test_util.py` for tests in the `app.app_one.tests.test_util` class
- `app/app_two/tests/test_util.py` for tests in the `app.app_two.tests.test_util` class

Instead of potentially matching the wrong file or files in `.venv`.

## See Also

- [pytest documentation on JUnit XML](https://docs.pytest.org/en/stable/how-to/output.html#creating-junitxml-format-files)
- [action-junit-report main README](../README.md)
