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
      title: 'pull request title'
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

  expect(git).toBeCalledWith('config', 'user.email', 'split-pr@example.com')
  expect(git).toBeCalledWith('config', 'user.name', 'split-pr-user')
  expect(git).toBeCalledWith(
    'fetch',
    'origin',
    expect.stringMatching(/base_branch:working_branch-split-\d+/),
    'working_branch:working_branch',
    '--unshallow'
  )
  expect(git).toBeCalledWith(
    'switch',
    expect.stringMatching(/working_branch-split-\d+/)
  )
  expect(git).toBeCalledWith('merge', 'working_branch', '--no-commit')
  expect(git).toBeCalledWith('reset')
  expect(git).toBeCalledWith('add', 'dir/**')
  expect(git).toBeCalledWith('commit', '-m', 'commit message')
  expect(git).toBeCalledWith(
    'push',
    'origin',
    expect.stringMatching(/working_branch-split-\d+/)
  )

  expect(result.splitPullNumber).toEqual(101)
})
