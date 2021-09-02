import nock from 'nock'
import * as split from '../src/split'
import {git} from '../src/git'

nock.disableNetConnect()
jest.mock('../src/git')

test('foo', async () => {
  const scope = nock('https://api.github.com')
    .get('/repos/owner/repo/pulls/100')
    .reply(200, {
      head: {
        ref: 'working_branch',
        sha: 'head_sha'
      },
      base: {
        ref: 'base_branch'
      },
      title: 'pull request title',
      mergeable: true,
      merge_commit_sha: 'merge_sha'
    })
    .post(`/repos/owner/repo/statuses/head_sha`, {
      state: 'pending',
      context: 'split-pr',
      target_url: 'https://github.com/owner/repo/actions/runs/3'
    })
    .reply(201, {})
    .post('/repos/owner/repo/pulls', {
      head: /working_branch-split-\d+/,
      base: 'base_branch',
      title: 'split: pull request title',
      body: 'body'
    })
    .reply(201, {
      number: 101
    })
    .post(`/repos/owner/repo/statuses/head_sha`, {
      state: 'success',
      context: 'split-pr',
      target_url: 'https://github.com/owner/repo/actions/runs/3'
    })
    .reply(201, {})

  const result = await split.run({
    owner: 'owner',
    repo: 'repo',
    runId: 3,
    pullNumber: 100,
    filePattern: 'dir/**',
    branchSuffix: '-split',
    titlePrefix: 'split: ',
    body: 'body',
    commitMessage: 'commit message',
    commitUser: 'split-pr-user',
    commitEmail: 'split-pr@example.com',
    commitStatusContext: 'split-pr',
    commitStatusDescription: undefined,
    token: 'secret'
  })

  scope.done() // assert github apis are called as expected

  expect(git).toBeCalledWith('fetch', 'origin', expect.stringMatching(/base_branch:working_branch-split-\d+/), 'merge_sha', '--depth', '1')
  expect(git).toBeCalledWith('switch', expect.stringMatching(/working_branch-split-\d+/))
  expect(git).toBeCalledWith('restore', '-s', 'merge_sha', 'dir/**')
  expect(git).toBeCalledWith('add', '-Av', '.')
  expect(git).toBeCalledWith(
    '-c',
    'user.email=split-pr@example.com',
    '-c',
    'user.name=split-pr-user',
    'commit',
    '-m',
    'commit message'
  )
  expect(git).toBeCalledWith('push', 'origin', expect.stringMatching(/working_branch-split-\d+/))

  expect(result.splitPullNumber).toEqual(101)
})
