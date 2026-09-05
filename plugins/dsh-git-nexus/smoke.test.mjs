/**
 * dsh-git-nexus smoke test.
 *
 * Instantiates GitNexusGateway with a mock `shell` service that runs commands
 * through child_process, then exercises the git methods against a real
 * temporary repository. Run with: node smoke.test.mjs
 */
import { execFile } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { GitNexusGateway } from './lib/index.js'

const execFileP = promisify(execFile)

function runGitRaw(cwd, args) {
  return execFileP('git', args, { cwd, encoding: 'utf8' })
}

// Mock shell service: resolve returns request; run executes `command` string.
function makeShell(cwd) {
  return {
    resolve(request) {
      return request
    },
    async run(spec) {
      try {
        const cmd = spec.command
        const argv = ['-c', cmd]
        const { stdout, stderr } = await execFileP('/bin/sh', argv, { cwd: spec.workdir || cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
        return { exitCode: 0, signal: null, timedOut: false, aborted: false, timeoutMs: 0, stdout: { text: stdout, truncated: false }, stderr: { text: stderr } }
      } catch (err) {
        return {
          exitCode: err.code === undefined ? -1 : err.code,
          signal: err.signal || null,
          timedOut: false,
          aborted: false,
          timeoutMs: 0,
          stdout: { text: err.stdout || '', truncated: false },
          stderr: { text: err.stderr || String(err.message) },
        }
      }
    },
  }
}

// Minimal context satisfying the Cordis Service constructor (`reflect.provide`)
// plus the `shell` service the gateway injects.
function makeCtx(cwd) {
  return {
    shell: makeShell(cwd),
    get() {
      return undefined // no sandboxPolicy in the mock
    },
    reflect: {
      provide() {
        /* no-op in the mock */
      },
    },
  }
}

let failures = 0
function assert(cond, label) {
  if (cond) {
    console.log('  ok   ' + label)
  } else {
    failures += 1
    console.error('  FAIL ' + label)
  }
}

async function main() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-git-nexus-'))
  await runGitRaw(root, ['init', '-q'])
  await runGitRaw(root, ['config', 'user.email', 't@example.com'])
  await runGitRaw(root, ['config', 'user.name', 'Tester'])
  writeFileSync(join(root, 'a.txt'), 'hello\n')
  writeFileSync(join(root, 'b.txt'), 'world')
  await runGitRaw(root, ['add', 'a.txt', 'b.txt'])
  await runGitRaw(root, ['commit', '-q', '-m', 'initial'])

  const g = new GitNexusGateway(makeCtx(root))

  console.log('status (clean repo):')
  let s = await g.status(root)
  assert(s.isRepo === true, 'isRepo')
  assert(s.branch === 'master' || s.branch === 'main', 'branch=' + s.branch)
  assert(s.staged === 0 && s.unstaged === 0 && s.untracked === 0, 'clean counts')

  console.log('changes after edits:')
  writeFileSync(join(root, 'a.txt'), 'hello edited\n')
  writeFileSync(join(root, 'c.txt'), 'new file\n')
  let ch = await g.changes(root)
  assert(ch.entries.length === 2, '2 changed entries: ' + JSON.stringify(ch.entries.map((e) => e.path + '/' + (e.untracked ? '?' : 'M'))))
  assert(ch.entries.some((e) => e.path === 'a.txt' && !e.untracked), 'a.txt modified')
  assert(ch.entries.some((e) => e.path === 'c.txt' && e.untracked), 'c.txt untracked')

  console.log('stage / commit:')
  let st = await g.stage(root, 'a.txt')
  assert(st.ok, 'stage a.txt')
  let cm = await g.commit(root, 'edit a')
  assert(cm.ok && typeof cm.hash === 'string' && cm.hash.length === 40, 'commit ok, hash=' + (cm.hash || '').slice(0, 7))

  console.log('log:')
  let lg = await g.log(root, 10)
  assert(lg.ok && lg.commits.length === 2, '2 commits in log')
  assert(lg.commits[0].subject === 'edit a', 'latest subject=' + lg.commits[0].subject)
  assert(lg.commits[0].shortHash.length >= 4, 'shortHash present')

  console.log('branches:')
  let br = await g.branches(root)
  assert(br.ok && br.branches.length === 1, '1 branch')
  let bcr = await g.branchCreate(root, 'feature-x')
  assert(bcr.ok, 'create branch feature-x')
  let chk = await g.checkout(root, br.current || 'master')
  assert(chk.ok, 'checkout back to ' + (br.current || 'master'))

  console.log('diff:')
  writeFileSync(join(root, 'a.txt'), 'hello edited again\n')
  let d = await g.diff(root, 'a.txt', false)
  assert(d.ok && d.text.indexOf('hello edited again') !== -1, 'unstaged diff contains edit')

  console.log('files:')
  let f = await g.files(root, '')
  assert(f.ok && f.entries.indexOf('a.txt') !== -1 && f.entries.indexOf('b.txt') !== -1, 'files list includes a.txt, b.txt')

  console.log('readFile:')
  let rf = await g.readFile(root, 'b.txt')
  assert(rf.ok && rf.text.trim() === 'world', 'readFile b.txt = world')

  console.log('workflow:')
  let w = await g.workflowSet([{ id: 's1', title: 'step one', status: 'pending' }])
  assert(w.ok && w.steps.length === 1, 'workflowSet persisted')
  let wg = await g.workflowGet()
  assert(wg.ok && wg.steps[0].title === 'step one', 'workflowGet roundtrip')

  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURES')
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('SMOKE TEST CRASHED:', e)
  process.exit(1)
})
