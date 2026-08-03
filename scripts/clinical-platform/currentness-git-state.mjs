import { spawnSync } from 'node:child_process'

export const GIT_CAPTURE_MAX_BUFFER = 200 * 1024 * 1024

export function gitOutput(args, cwd = process.cwd()) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: GIT_CAPTURE_MAX_BUFFER,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || `Git command failed: ${args.join(' ')}`)
  return result.stdout.replace(/\r\n/g, '\n')
}

export function repositoryContent(cwd = process.cwd()) {
  return JSON.stringify({
    unstagedPatch: gitOutput(['diff', '--binary', '--full-index', '--no-ext-diff'], cwd),
    stagedPatch: gitOutput(['diff', '--cached', '--binary', '--full-index', '--no-ext-diff'], cwd),
    untrackedFiles: gitOutput(['ls-files', '--others', '--exclude-standard'], cwd).split('\n').filter(Boolean).sort(),
  })
}
