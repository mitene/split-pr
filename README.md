<a href="https://github.com/mitene/split-pr/actions"><img alt="typescript-action status" src="https://github.com/mitene/split-pr/workflows/build-test/badge.svg"></a>

# split-pr

## Getting Started

```yaml
name: Split PR

on:
  issue_comment:
    types: [created]

jobs:
  split-pr:
    runs-on: ubuntu-latest
    if: ${{ github.event.issue.pull_request && startsWith(github.event.comment.body, '/split-pr') }}

    steps:
      - uses: actions/checkout@v2

      - name: Split pull request
        uses: mitene/split-pr@main
        with:
          pull-number: ${{ github.event.issue.number }}
          file-pattern: "dir/**"
          branch-suffix: "-split"
          commit-message: "Split pull request #${{ github.event.issue.number }}"
          commit-user: ${{ github.event.comment.sender.login }}
          commit-email: ${{ github.event.comment.sender.id }}+${{ github.event.comment.sender.login }}@users.noreply.github.com
          title-prefix: "split-pr: "
          body: "This pull request is branched from #${{ github.event.issue.number }}",
          token: ${{ github.token }}
```

## Development

### Setup

First, you'll need to have a reasonably modern version of `node` handy. This won't work with versions older than 9, for instance.

Install the dependencies  
```bash
$ npm install
```

Build the typescript and package it for distribution
```bash
$ npm run build && npm run package
```

Run the tests :heavy_check_mark:  
```bash
$ npm test

 PASS  ./index.test.js
  ✓ throws invalid number (3ms)
  ✓ wait 500 ms (504ms)
  ✓ test runs (95ms)

...
```

### Push

Actions are run from GitHub repos so we will checkin the packed dist folder. 

Then run npm package command and push the results:
```bash
$ npm run all
$ git add . -v
$ git commit -v
$ git push origin BRANCH
```

Check test results and merge working branch into main.

### Release

Push v1 tag:
```
$ git fetch origin
$ git tag -f v1 origin/master
$ git push -f origin v1
```
