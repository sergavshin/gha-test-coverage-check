<p align="right">
  <a href="https://github.com/actions/typescript-action/actions"><img alt="typescript-action status" src="https://github.com/actions/typescript-action/workflows/build-test/badge.svg"></a>
</p>

# Test coverage check

Verify that test coverage pass threshold

### Usage

```yml
coverage:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v2

    - run: npm install
    - run: npm run coverage

    - name: check
      uses: inzephirum/gha-test-coverage-check
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        min_threshold: '100'
        report_file_path: './coverage/lcov.info'
```
