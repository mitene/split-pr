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
  commitStatusContext: string
  commitStatusDescription?: string
  token: string
}): Promise<{splitPullNumber: number}> {
  const octokit = github.getOctokit(params.token)

  // Get target pull request
  core.startGroup('Get the target pull request')

  const targetPull = await (async function() {
    for (let i = 0; i < 5; i++) {
      const {data: p} = await octokit.pulls.get({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pullNumber
      })
      if (p.mergeable === true) {
        return p
      } else if (p.mergeable === false) {
        throw new Error("this pull request cannot be merged")
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    throw new Error("cannot get mergeable state")
  })()

  core.endGroup()

  const createCommitStatus = async (
    state: 'error' | 'failure' | 'pending' | 'success'
  ): ReturnType<typeof octokit.repos.createCommitStatus> => {
    return octokit.repos.createCommitStatus({
      owner: params.owner,
      repo: params.repo,
      sha: targetPull.head.sha,
      state,
      context: params.commitStatusContext,
      description: params.commitStatusDescription,
      target_url: `https://github.com/${params.owner}/${params.repo}/actions/runs/${params.runId}`
    })
  }

  await createCommitStatus('pending')

  try {
    core.startGroup('Create and push the split branch')

    const splitBranch = targetPull.head.ref + params.branchSuffix + '-' + Date.now()
    const baseRef = targetPull.base.ref
    const mergeSha = targetPull.merge_commit_sha as string

    targetPull.base.ref
    await git('fetch', 'origin', `${baseRef}:${splitBranch}`, `${mergeSha}`, '--depth', '1')
    await git('switch', splitBranch)
    await git('restore', '-s', mergeSha, params.filePattern)
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
      base: baseRef,
      title: params.titlePrefix + targetPull.title,
      body: params.body
    })
    core.endGroup()

    await createCommitStatus('success')

    return {splitPullNumber: splitPull.number}
  } catch (e) {
    console.error(e)
    await createCommitStatus('failure')
    throw e
  }
}
