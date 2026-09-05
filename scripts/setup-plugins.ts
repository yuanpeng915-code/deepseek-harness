/**
 * Install every vendored plugin under plugins/<name>/ into a local DSH profile.
 *
 * A fresh clone needs `pnpm install && pnpm run setup:plugins` before
 * `dsh web` mounts the vendored panels; the run is idempotent because pnpm
 * reports "Already up to date" when the file: dependency already matches.
 * @see ../AGENTS.md "Plugin installs"
 */
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pnpmInvocation } from './pnpm-invocation.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const profile = process.argv[2] ?? 'web'

const vendoredPlugins = readdirSync(new URL('../plugins', import.meta.url), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)

for (const name of vendoredPlugins) {
  console.log(`setup-plugins: installing ${name} into profile ${profile}`)
  const invocation = pnpmInvocation(['dsh', 'plugin', '--profile', profile, 'add', `file:${repoRoot}plugins/${name}`])
  const result = spawnSync(invocation.command, invocation.args, { cwd: repoRoot, stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`setup-plugins: installing ${name} failed with exit code ${result.status}`)
  }
}
