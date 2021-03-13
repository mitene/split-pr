import * as github from '@actions/github'
import * as core from '@actions/core'
import {git} from './git'

export async function run(params: {
  owner: string
  repo: string
  runId: number

  pullNumber: number
  filePattern: string
  branchSuffix: string
  titlePrefix: string
  body: string
  commitMessage: string
  commitUser: string
  commitEmail: string
  token: string
}): Promise<{splitPullNumber: number}> {
  const octokit = github.getOctokit(params.token)

  // Get target pull request
  core.startGroup('Get the target pull request')
  const {data: targetPull} = await octokit.pulls.get({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber
  })
  const {data: targetPullCommits} = await octokit.pulls.listCommits({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber
  })
  core.endGroup()

  try {
    core.startGroup('Create and push the split branch')
    const splitBranch = targetPull.head.ref + params.branchSuffix
    await git(
      'fetch',
      'origin',
      targetPullCommits[0].parents[0].sha,
      targetPull.head.sha
    )
    await git('switch', '-c', splitBranch, targetPullCommits[0].parents[0].sha)
    await git('restore', '-s', targetPull.head.sha, params.filePattern)
    await git('add', '-Av', '.')
    await git(
      '-c',
      `user.email=${params.commitEmail}`,
      '-c',
      `user.name=${params.commitUser}`,
      'commit',
      '-m',
      params.commitMessage
    )
    await git('push', 'origin', splitBranch)
    core.endGroup()

    core.startGroup('Create the split pull request')
    const {data: splitPull} = await octokit.pulls.create({
      owner: params.owner,
      repo: params.repo,
      head: splitBranch,
      base: targetPull.base.ref,
      title: params.titlePrefix + targetPull.title,
      body: params.body
    })
    core.endGroup()

    await octokit.repos.createCommitStatus({
      owner: params.owner,
      repo: params.repo,
      sha: targetPull.head.sha,
      state: 'success',
      context: 'split-pr',
      target_url: `https://github.com/${params.owner}/${params.repo}/actions/runs/${params.runId}`
    })

    return {splitPullNumber: splitPull.number}
  } catch (e) {
    await octokit.repos.createCommitStatus({
      owner: params.owner,
      repo: params.repo,
      sha: targetPull.head.sha,
      state: 'failure',
      context: 'split-pr',
      target_url: `https://github.com/${params.owner}/${params.repo}/actions/runs/${params.runId}`
    })
    throw e
  }
}
