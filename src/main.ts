import * as core from '@actions/core'
import * as github from '@actions/github'

import * as split from './split'

async function run(): Promise<void> {
  try {
    const result = await split.run({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,

      pullNumber: parseInt(core.getInput('pull-number', {required: true})),
      filePattern: core.getInput('file-pattern', {required: true}),
      branchSuffix: core.getInput('branch-suffix'),
      commitMessage:
        core.getInput('commit-message') ||
        `Split pull request #${core.getInput('pull-number')}`,
      commitUser: core.getInput('commit-user'),
      commitEmail: core.getInput('commit-email'),
      titlePrefix: core.getInput('title-prefix'),
      body:
        core.getInput('body') ||
        `Split pull request #${core.getInput('pull-number')}`,
      token: core.getInput('token')
    })

    core.setOutput('split-pull-number', result.splitPullNumber)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
