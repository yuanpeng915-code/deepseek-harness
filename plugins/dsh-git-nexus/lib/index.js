/**
 * dsh-git-nexus — Host half.
 *
 * Registers a single Typert Remote service (`gitNexus` wire namespace) that
 * owns every capability behind the panel:
 *
 *   Git        status / changes / diff / log / branches / branchCreate /
 *              branchDelete / checkout / stage / unstage / discard / commit /
 *              push / pull / sync / fetch
 *   Files      files / readFile
 *   GitHub     githubStatus / githubConfig / githubLogin / githubPoll /
 *              githubLogout / githubPR   (OAuth device flow, gh CLI fallback)
 *   Workflow   workflowGet / workflowSet
 *
 * Every command runs through a fresh `/bin/sh -c` child process with an
 * explicit timeout and output cap. No implicit `git add`/`reset`/
 * `stash`/`push` happens anywhere: every mutating method is an explicit,
 * user-invoked action.
 *
 * @module dsh-git-nexus
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

const execFileAsync = promisify(execFile)

const GIT_TIMEOUT_MS = 30000
const GIT_STDOUT_MAX_BYTES = 2 * 1024 * 1024
const MAX_LOG_ENTRIES = 200
const MAX_FILE_ENTRIES = 500
const READ_FILE_MAX_BYTES = 512 * 1024
const CONTROL_CHARS = /[\x00-\x1f\x7f]/
const BRANCH_RE = /^[^\s~^:?*[\\]{1,255}$/

const STORAGE_DIR = join(homedir(), '.dsh', 'storages', 'dsh-git-nexus')
const SETTINGS_PATH = join(STORAGE_DIR, 'settings.json')
const WORKFLOW_PATH = join(STORAGE_DIR, 'workflow.json')

const GITHUB_API = 'https://api.github.com'
const GITHUB_SCOPES = 'repo workflow read:user user:email'
const GITHUB_UA = 'dsh-git-nexus'

/** Quote one argv element for POSIX shell so no metacharacter can break out. */
function escapeShell(arg) {
  return "'" + String(arg).replace(/'/g, "'\\''") + "'"
}

function ensureStorage() {
  if (!existsSync(STORAGE_DIR)) mkdirSync(STORAGE_DIR, { recursive: true, mode: 0o700 })
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(path, value) {
  ensureStorage()
  writeFileSync(path, JSON.stringify(value, null, 2), { mode: 0o600 })
}

/**
 * Apply Typert Remote markers in plain JavaScript (no decorator syntax).
 * Mirrors what the `Remote(name)` method decorator does: records
 * direct-invocation markers on the class prototype.
 */
function markRemoteMethods(cls, methods) {
  for (const method of methods) {
    const initializers = []
    Remote(method)(cls.prototype[method], {
      kind: 'method',
      name: method,
      static: false,
      private: false,
      addInitializer(init) {
        initializers.push(init)
      },
    })
    const sample = Object.create(cls.prototype)
    for (const init of initializers) init.call(sample)
  }
}

/** Normalized result from a child-process command, never throwing. */

function textOf(run, which) {
  return (run && run[which] && typeof run[which].text === 'string' ? run[which].text : '').trim()
}

/** Like textOf but preserves leading/trailing whitespace (porcelain output). */
function rawOf(run, which) {
  return run && run[which] && typeof run[which].text === 'string' ? run[which].text : ''
}

class GitNexusGateway extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'gitNexusGateway', { namespace: 'gitNexus' })
    // Pending device-flow state (kept in memory, never written to disk).
    this._deviceCode = null
    this._clientId = null
    this._pollInterval = 5
    this._deviceExpiresAt = 0
  }

  /**
   * Run an arbitrary command through a fresh `/bin/sh -c` child process.
   *
   * The web profile scopes the DSH `shell` service to per-session agent
   * realms, so a host-plane plugin cannot inject it; executing directly keeps
   * the gateway self-contained. The result shape matches the shell service's
   * `ShellRunResult` so downstream handling is unchanged.
   */
  async runCmd(command, workdir, timeoutMs, stdoutMaxBytes) {
    const timeout = timeoutMs || GIT_TIMEOUT_MS
    const maxBuffer = (stdoutMaxBytes || GIT_STDOUT_MAX_BYTES) + 1024 * 1024
    try {
      const { stdout, stderr } = await execFileAsync('/bin/sh', ['-c', command], {
        cwd: workdir,
        timeout,
        maxBuffer,
        encoding: 'utf8',
        windowsHide: true,
      })
      return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
        timeoutMs: timeout,
        stdout: { text: stdout, truncated: false },
        stderr: { text: stderr },
      }
    } catch (err) {
      const { stdout = '', stderr = '' } = err
      const timedOut = err.killed === true
      return {
        exitCode: typeof err.code === 'number' ? err.code : -1,
        signal: err.signal || null,
        timedOut,
        aborted: false,
        timeoutMs: timeout,
        stdout: { text: stdout, truncated: false },
        stderr: { text: stderr || (err && err.message ? String(err.message) : 'shell execution failed') },
      }
    }
  }

  runGit(cwd, args) {
    return this.runCmd('git ' + args, cwd)
  }

  async gitExitCode(cwd, args) {
    const run = await this.runGit(cwd, args)
    return run.exitCode === 0
  }

  // ──────────────────────────────────────────────────────────────────────
  // Git — status / changes / diff / log
  // ──────────────────────────────────────────────────────────────────────

  async status(cwd) {
    const base = { ok: true, isRepo: false, branch: null, detached: false, ahead: 0, behind: 0, staged: 0, unstaged: 0, untracked: 0, remote: null, error: null }
    if (typeof cwd !== 'string' || cwd === '') {
      return { ...base, ok: false, error: 'No project directory' }
    }
    const check = await this.runGit(cwd, 'rev-parse --is-inside-work-tree')
    if (check.exitCode !== 0) return base

    const branch = await this.runGit(cwd, 'symbolic-ref --quiet --short HEAD')
    if (branch.exitCode === 0 && textOf(branch, 'stdout') !== '') {
      base.branch = textOf(branch, 'stdout')
    } else {
      const head = await this.runGit(cwd, 'rev-parse --short HEAD')
      base.detached = true
      base.branch = head.exitCode === 0 ? textOf(head, 'stdout') : null
    }

    const remote = await this.runGit(cwd, 'remote get-url origin')
    if (remote.exitCode === 0) base.remote = textOf(remote, 'stdout') || null

    const upstream = await this.runGit(cwd, 'rev-parse --abbrev-ref --symbolic-full-name @{u}')
    if (upstream.exitCode === 0) {
      const counts = await this.runGit(cwd, 'rev-list --left-right --count HEAD...@{u}')
      if (counts.exitCode === 0) {
        const parts = textOf(counts, 'stdout').split(/\s+/)
        const a = Number.parseInt(parts[0], 10)
        const b = Number.parseInt(parts[1], 10)
        base.ahead = Number.isFinite(a) ? a : 0
        base.behind = Number.isFinite(b) ? b : 0
      }
    }

    const porc = await this.runGit(cwd, 'status --porcelain=v1')
    if (porc.exitCode === 0) {
      for (const line of rawOf(porc, 'stdout').split('\n')) {
        if (line.length < 2) continue
        const x = line[0]
        const y = line[1]
        if (x === '?' && y === '?') base.untracked += 1
        else {
          if (x !== ' ') base.staged += 1
          if (y !== ' ') base.unstaged += 1
        }
      }
    }

    base.isRepo = true
    return base
  }

  async changes(cwd) {
    if (typeof cwd !== 'string' || cwd === '') return { ok: false, entries: [], error: 'No project directory' }
    const run = await this.runGit(cwd, 'status --porcelain=v1')
    if (run.exitCode !== 0) return { ok: false, entries: [], error: textOf(run, 'stderr') || 'git status failed' }
    const entries = []
    for (const raw of rawOf(run, 'stdout').split('\n')) {
      if (raw.length < 4) continue
      const code = raw.slice(0, 2)
      let path = raw.slice(3)
      const arrow = path.indexOf(' -> ')
      if (arrow !== -1) path = path.slice(arrow + 4)
      const x = code[0]
      const y = code[1]
      entries.push({
        path,
        x,
        y,
        staged: x !== ' ' && x !== '?',
        unstaged: y !== ' ',
        untracked: x === '?' && y === '?',
        added: x === 'A',
        deleted: x === 'D' || y === 'D',
        renamed: code.includes('R'),
      })
    }
    entries.sort((a, b) => a.path.localeCompare(b.path))
    return { ok: true, entries, error: null }
  }

  async diff(cwd, path, staged) {
    if (typeof cwd !== 'string' || cwd === '') return { ok: false, text: '', error: 'No project directory' }
    let args = staged ? 'diff --cached' : 'diff'
    if (typeof path === 'string' && path !== '') args += ' -- ' + escapeShell(path)
    const run = await this.runGit(cwd, args)
    if (run.exitCode !== 0 && run.exitCode !== 1) {
      return { ok: false, text: '', error: textOf(run, 'stderr') || 'git diff failed' }
    }
    return { ok: true, text: run.stdout && run.stdout.text ? run.stdout.text : '', truncated: !!(run.stdout && run.stdout.truncated), error: null }
  }

  async log(cwd, limit) {
    if (typeof cwd !== 'string' || cwd === '') return { ok: false, commits: [], error: 'No project directory' }
    let n = Number.parseInt(limit, 10)
    if (!Number.isFinite(n) || n < 1) n = 50
    if (n > MAX_LOG_ENTRIES) n = MAX_LOG_ENTRIES
    const fmt = '%H%x1f%h%x1f%s%x1f%an%x1f%ad%x1f%D'
    const run = await this.runGit(cwd, "log --pretty=format:'" + fmt + "' --date=short -n " + n)
    if (run.exitCode !== 0) return { ok: false, commits: [], error: textOf(run, 'stderr') || 'git log failed' }
    const commits = []
    const body = run.stdout && run.stdout.text ? run.stdout.text : ''
    for (const line of body.split('\n')) {
      if (line === '') continue
      const f = line.split('\x1f')
      commits.push({
        hash: f[0] || '',
        shortHash: f[1] || '',
        subject: f[2] || '',
        author: f[3] || '',
        date: f[4] || '',
        refs: f[5] ? f[5].trim() : '',
      })
    }
    return { ok: true, commits, error: null }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Git — branches
  // ──────────────────────────────────────────────────────────────────────

  async branches(cwd) {
    if (typeof cwd !== 'string' || cwd === '') return { ok: false, branches: [], current: null, error: 'No project directory' }
    const run = await this.runGit(cwd, "for-each-ref '--format=%(refname:short)' '--sort=refname' 'refs/heads'")
    if (run.exitCode !== 0) return { ok: false, branches: [], current: null, error: textOf(run, 'stderr') || 'git failed' }
    const branches = textOf(run, 'stdout').split('\n').filter((s) => s !== '')
    const st = await this.status(cwd)
    return { ok: true, branches, current: st.branch, error: null }
  }

  async branchCreate(cwd, name) {
    if (typeof name !== 'string' || !BRANCH_RE.test(name)) return { ok: false, error: 'Invalid branch name' }
    const run = await this.runGit(cwd, 'checkout -b ' + escapeShell(name))
    if (run.exitCode !== 0) return { ok: false, error: textOf(run, 'stderr') || 'Create branch failed' }
    return { ok: true, branch: name, error: null }
  }

  async branchDelete(cwd, name) {
    if (typeof name !== 'string' || name === '' || CONTROL_CHARS.test(name)) return { ok: false, error: 'Invalid branch name' }
    const run = await this.runGit(cwd, 'branch -d ' + escapeShell(name))
    if (run.exitCode !== 0) return { ok: false, error: textOf(run, 'stderr') || 'Delete branch failed (maybe not merged?)' }
    return { ok: true, error: null }
  }

  async checkout(cwd, branch) {
    if (typeof branch !== 'string' || branch === '' || branch.length > 255 || CONTROL_CHARS.test(branch)) return { ok: false, error: 'Invalid branch name' }
    const run = await this.runGit(cwd, 'checkout ' + escapeShell(branch))
    if (run.exitCode !== 0) return { ok: false, error: textOf(run, 'stderr') || 'Checkout failed' }
    return { ok: true, branch, error: null }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Git — staging / commit
  // ──────────────────────────────────────────────────────────────────────

  async stage(cwd, path) {
    const target = typeof path === 'string' && path !== '' ? ' -- ' + escapeShell(path) : ' -A'
    const run = await this.runGit(cwd, 'add' + target)
    if (run.exitCode !== 0) return { ok: false, error: textOf(run, 'stderr') || 'git add failed' }
    return { ok: true, error: null }
  }

  async unstage(cwd, path) {
    const target = typeof path === 'string' && path !== '' ? ' -- ' + escapeShell(path) : ' -- .'
    const run = await this.runGit(cwd, 'restore --staged' + target)
    if (run.exitCode !== 0) return { ok: false, error: textOf(run, 'stderr') || 'git restore --staged failed' }
    return { ok: true, error: null }
  }

  async discard(cwd, path) {
    if (typeof path !== 'string' || path === '') return { ok: false, error: 'No file selected' }
    // Discard tracked working-tree changes; untracked files are left alone.
    const run = await this.runGit(cwd, 'restore -- ' + escapeShell(path))
    if (run.exitCode !== 0) return { ok: false, error: textOf(run, 'stderr') || 'git restore failed' }
    return { ok: true, error: null }
  }

  async commit(cwd, message) {
    if (typeof message !== 'string' || message.trim() === '') return { ok: false, error: 'Empty commit message' }
    if (CONTROL_CHARS.test(message)) return { ok: false, error: 'Invalid commit message' }
    const run = await this.runGit(cwd, 'commit -m ' + escapeShell(message.trim()))
    if (run.exitCode !== 0) return { ok: false, error: textOf(run, 'stderr') || 'git commit failed' }
    const head = await this.runGit(cwd, 'rev-parse HEAD')
    return { ok: true, hash: textOf(head, 'stdout'), error: null }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Git — remote (push / pull / sync / fetch)
  // ──────────────────────────────────────────────────────────────────────

  async push(cwd) {
    const st = await this.status(cwd)
    const branch = st.branch
    if (!branch) return { ok: false, error: 'Detached HEAD — cannot push' }
    const run = await this.runGit(cwd, 'push -u origin ' + escapeShell(branch))
    if (run.exitCode !== 0) return { ok: false, error: textOf(run, 'stderr') || 'git push failed' }
    return { ok: true, error: null }
  }

  async pull(cwd) {
    const run = await this.runGit(cwd, 'pull --ff-only')
    if (run.exitCode !== 0) return { ok: false, error: textOf(run, 'stderr') || 'git pull failed (diverged? try sync)' }
    return { ok: true, error: null }
  }

  async sync(cwd) {
    const pull = await this.runGit(cwd, 'pull --rebase --autostash')
    if (pull.exitCode !== 0) return { ok: false, error: textOf(pull, 'stderr') || 'sync: pull failed' }
    const st = await this.status(cwd)
    const branch = st.branch
    if (!branch) return { ok: false, error: 'sync: detached HEAD — cannot push' }
    const push = await this.runGit(cwd, 'push -u origin ' + escapeShell(branch))
    if (push.exitCode !== 0) return { ok: false, error: textOf(push, 'stderr') || 'sync: push failed' }
    return { ok: true, error: null }
  }

  async fetch(cwd) {
    const run = await this.runGit(cwd, 'fetch --all --prune')
    if (run.exitCode !== 0) return { ok: false, error: textOf(run, 'stderr') || 'git fetch failed' }
    return { ok: true, error: null }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Files
  // ──────────────────────────────────────────────────────────────────────

  async files(cwd, dir) {
    if (typeof cwd !== 'string' || cwd === '') return { ok: false, entries: [], error: 'No project directory' }
    const scope = typeof dir === 'string' && dir !== '' ? ' -- ' + escapeShell(dir) : ''
    const run = await this.runGit(cwd, 'ls-files --cached --others --exclude-standard' + scope)
    if (run.exitCode !== 0) return { ok: false, entries: [], error: textOf(run, 'stderr') || 'git ls-files failed' }
    const files = textOf(run, 'stdout').split('\n').filter((s) => s !== '').sort()
    const truncated = files.length > MAX_FILE_ENTRIES
    return { ok: true, entries: truncated ? files.slice(0, MAX_FILE_ENTRIES) : files, truncated, error: null }
  }

  async readFile(cwd, path) {
    if (typeof path !== 'string' || path === '' || CONTROL_CHARS.test(path)) return { ok: false, text: '', error: 'Invalid path' }
    const run = await this.runCmd('cat ' + escapeShell(path), cwd, GIT_TIMEOUT_MS, READ_FILE_MAX_BYTES)
    if (run.exitCode !== 0) return { ok: false, text: '', error: textOf(run, 'stderr') || 'read failed' }
    return { ok: true, text: run.stdout && run.stdout.text ? run.stdout.text : '', truncated: !!(run.stdout && run.stdout.truncated), error: null }
  }

  // ──────────────────────────────────────────────────────────────────────
  // GitHub — OAuth device flow + gh CLI fallback
  // ──────────────────────────────────────────────────────────────────────

  _settings() {
    return readJson(SETTINGS_PATH, { clientId: '', accessToken: null })
  }

  _saveSettings(patch) {
    const next = { ...this._settings(), ...patch }
    writeJson(SETTINGS_PATH, next)
    return next
  }

  async _ghApi(path, opts = {}) {
    const settings = this._settings()
    const token = settings.accessToken
    if (token) {
      const res = await fetch(GITHUB_API + path, {
        ...opts,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': GITHUB_UA,
          Authorization: 'Bearer ' + token,
          ...(opts.headers || {}),
        },
      })
      return { via: 'oauth', res }
    }
    // gh CLI fallback: run `gh api <path>` and capture JSON.
    const run = await this.runCmd('gh api ' + escapeShell(path), undefined, GIT_TIMEOUT_MS)
    if (run.exitCode !== 0) return { via: 'gh', res: null, error: textOf(run, 'stderr') || 'gh api failed' }
    let data = null
    try {
      data = JSON.parse(run.stdout && run.stdout.text ? run.stdout.text : 'null')
    } catch {
      data = null
    }
    return { via: 'gh', res: { ok: true, status: 200, json: async () => data, headers: { get: () => null } }, error: null }
  }

  async githubConfig() {
    const settings = this._settings()
    const gh = await this.runCmd('gh --version', undefined, 10000)
    return {
      ok: true,
      clientId: settings.clientId || '',
      hasToken: !!settings.accessToken,
      hasGh: gh.exitCode === 0,
      error: null,
    }
  }

  async githubStatus() {
    const settings = this._settings()
    const token = settings.accessToken
    if (token) {
      try {
        const res = await fetch(GITHUB_API + '/user', {
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': GITHUB_UA,
            Authorization: 'Bearer ' + token,
          },
        })
        if (res.status === 401) return { ok: true, authed: false, method: 'oauth', login: null, scopes: [], fullAccess: false, error: 'Token expired or revoked — reconnect.' }
        const data = await res.json()
        const scopes = (res.headers.get('x-oauth-scopes') || '').split(',').map((s) => s.trim()).filter(Boolean)
        return { ok: true, authed: true, method: 'oauth', login: data.login || null, scopes, fullAccess: scopes.includes('repo'), error: null }
      } catch (err) {
        return { ok: true, authed: false, method: 'oauth', login: null, scopes: [], fullAccess: false, error: 'Network error checking GitHub.' }
      }
    }
    // gh fallback
    const run = await this.runCmd('gh auth status', undefined, 10000)
    if (run.exitCode !== 0) return { ok: true, authed: false, method: 'none', login: null, scopes: [], fullAccess: false, error: 'Not connected.' }
    const user = await this.runCmd('gh api user --jq .login', undefined, 10000)
    const login = user.exitCode === 0 ? textOf(user, 'stdout') : null
    return { ok: true, authed: true, method: 'gh', login, scopes: [], fullAccess: true, error: null }
  }

  async githubLogin(clientId, scopes) {
    if (typeof clientId !== 'string' || clientId.trim() === '') return { ok: false, error: 'A GitHub OAuth App Client ID is required.' }
    const scope = typeof scopes === 'string' && scopes.trim() !== '' ? scopes.trim() : GITHUB_SCOPES
    try {
      const res = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': GITHUB_UA },
        body: new URLSearchParams({ client_id: clientId.trim(), scope }).toString(),
      })
      const data = await res.json()
      if (!res.ok || !data.device_code) {
        return { ok: false, error: (data && (data.error_description || data.error)) || 'Device flow start failed' }
      }
      this._clientId = clientId.trim()
      this._deviceCode = data.device_code
      this._pollInterval = Number.parseInt(data.interval, 10) || 5
      this._deviceExpiresAt = Date.now() + (Number.parseInt(data.expires_in, 10) || 900) * 1000
      this._saveSettings({ clientId: clientId.trim() })
      return {
        ok: true,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        expiresIn: data.expires_in,
        interval: this._pollInterval,
        error: null,
      }
    } catch (err) {
      return { ok: false, error: 'Network error starting device flow.' }
    }
  }

  async githubPoll() {
    if (!this._deviceCode || !this._clientId) return { ok: true, status: 'idle', error: null }
    if (Date.now() > this._deviceExpiresAt) {
      this._deviceCode = null
      return { ok: true, status: 'expired', error: 'Authorization window expired — start again.' }
    }
    try {
      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': GITHUB_UA },
        body: new URLSearchParams({
          client_id: this._clientId,
          device_code: this._deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }).toString(),
      })
      const data = await res.json()
      if (data.access_token) {
        this._deviceCode = null
        this._saveSettings({ accessToken: data.access_token })
        const st = await this.githubStatus()
        return { ok: true, status: 'authorized', login: st.login, scopes: st.scopes, fullAccess: st.fullAccess, error: null }
      }
      if (data.error === 'authorization_pending' || data.error === 'slow_down') {
        return { ok: true, status: 'pending', error: null }
      }
      if (data.error === 'access_denied') {
        this._deviceCode = null
        return { ok: true, status: 'denied', error: 'Authorization was declined.' }
      }
      if (data.error === 'expired_token') {
        this._deviceCode = null
        return { ok: true, status: 'expired', error: 'Authorization window expired.' }
      }
      return { ok: true, status: 'error', error: (data && data.error_description) || data.error || 'Unknown error' }
    } catch (err) {
      return { ok: true, status: 'error', error: 'Network error polling authorization.' }
    }
  }

  async githubLogout() {
    this._deviceCode = null
    this._saveSettings({ accessToken: null })
    return { ok: true, error: null }
  }

  async githubPR(cwd, title, body, base, head) {
    if (typeof title !== 'string' || title.trim() === '') return { ok: false, error: 'PR title is required.' }
    const st = await this.status(cwd)
    const headBranch = typeof head === 'string' && head !== '' ? head : st.branch
    if (!headBranch) return { ok: false, error: 'Cannot determine head branch.' }

    // Resolve owner/repo from origin remote.
    const remote = await this.runGit(cwd, 'remote get-url origin')
    if (remote.exitCode !== 0) return { ok: false, error: 'No origin remote.' }
    const url = textOf(remote, 'stdout')
    const m = url.match(/github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/)
    if (!m) return { ok: false, error: 'Could not parse origin owner/repo.' }
    const owner = m[1]
    const repo = m[2]

    const baseBranch = typeof base === 'string' && base !== '' ? base : 'main'
    const payload = { title: title.trim(), head: owner + ':' + headBranch, base: baseBranch }
    if (typeof body === 'string' && body.trim() !== '') payload.body = body.trim()

    const via = await this._ghApi('/repos/' + owner + '/' + repo + '/pulls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (via.error) return { ok: false, error: via.error }
    if (!via.res || !via.res.ok) {
      let msg = 'PR creation failed'
      try {
        const d = await via.res.json()
        msg = (d && (d.message || d.errors && d.errors[0] && d.errors[0].message)) || msg
      } catch { /* ignore */ }
      return { ok: false, error: msg }
    }
    const pr = await via.res.json()
    return { ok: true, url: pr.html_url || pr.url, number: pr.number, error: null }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Workflow board
  // ──────────────────────────────────────────────────────────────────────

  async workflowGet() {
    const data = readJson(WORKFLOW_PATH, { steps: [] })
    return { ok: true, steps: Array.isArray(data.steps) ? data.steps : [], error: null }
  }

  async workflowSet(steps) {
    if (!Array.isArray(steps)) return { ok: false, error: 'steps must be an array' }
    const clean = steps.slice(0, 200).map((s, i) => ({
      id: s && typeof s.id === 'string' ? s.id : 'step-' + i,
      title: s && typeof s.title === 'string' ? s.title.slice(0, 500) : '',
      status: s && (s.status === 'done' || s.status === 'active') ? s.status : 'pending',
    }))
    writeJson(WORKFLOW_PATH, { steps: clean })
    return { ok: true, steps: clean, error: null }
  }
}

markRemoteMethods(GitNexusGateway, [
  'status', 'changes', 'diff', 'log', 'branches', 'branchCreate', 'branchDelete',
  'checkout', 'stage', 'unstage', 'discard', 'commit', 'push', 'pull', 'sync',
  'fetch', 'files', 'readFile', 'githubStatus', 'githubConfig', 'githubLogin',
  'githubPoll', 'githubLogout', 'githubPR', 'workflowGet', 'workflowSet',
])

export { GitNexusGateway }
export default GitNexusGateway
