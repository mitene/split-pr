import * as core from '@actions/core'
import * as child from 'child_process'

export async function git(...args: string[]): Promise<void> {
  return new Promise<void>((resove, reject) => {
    core.info(`git ${args.join(' ')}`)

    child
      .spawn('git', args, {stdio: 'inherit'})
      .on('close', code => {
        if (code === 0) {
          resove()
        } else {
          const err = new Error(`git command failed with exit code: ${code}`)
          core.error(err)
          reject(err)
        }
      })
      .on('error', err => {
        core.error(err)
        reject(err)
      })
  })
}
