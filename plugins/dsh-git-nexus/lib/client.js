/**
 * dsh-git-nexus — Browser half (prebuilt client bundle).
 *
 * Mounts the Host's `gitNexus` Remote namespace and renders a management
 * panel in the session header's utilities area. Tabs: Changes (SCM), Branches,
 * Log, Files, Workflow, GitHub.
 *
 * Bundle format: lazy CJS factory registered with the shell's module loader.
 * Only `react` is externalized (resolved from the shell's static registry).
 */
window.__ModuleLoader__.load({
  id: 'dsh-git-nexus',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require('react');
    const ReactDOM = require('react-dom');
    const h = React.createElement;

    const css = `
.gnx-root { position: relative; display: inline-flex; align-items: center; }
.gnx-pill { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 13px; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.4)); background: transparent; color: var(--dsw-alias-label-secondary, #777); font-size: 12px; line-height: 1; font-family: inherit; cursor: pointer; white-space: nowrap; transition: color .12s ease, border-color .12s ease, background-color .12s ease; }
.gnx-pill:hover { color: var(--dsw-alias-label-primary, #111); border-color: var(--dsw-alias-border-l2, rgba(127,127,127,0.7)); background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.12)); }
.gnx-icon { display: inline-flex; align-items: center; color: var(--dsw-alias-brand-primary, #4f7cff); }
.gnx-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.gnx-badge { font-size: 10px; line-height: 1; padding: 2px 5px; border-radius: 8px; background: var(--dsw-alias-bg-multi-select, rgba(127,127,127,0.15)); color: var(--dsw-alias-label-secondary, #777); }
.gnx-backdrop { position: fixed; inset: 0; z-index: 10000; background: var(--dsw-alias-bg-mask-1, rgba(0,0,0,0.24)); }
/* The panel is portaled to document.body so no ancestor stacking context can
   trap it; 10001 sits above the app frame (max z-index 1100) and below the
   app's own overlay layer (2147480003). Panel surface uses bg-layer-1 (the
   dialog-surface token): bg-overlay is the app's heavy raised layer (gray-blue
   in light mode, lighter gray in dark) and reads as a dull gray slab here. */
.gnx-panel { position: fixed; z-index: 10001; width: 460px; max-width: calc(100vw - 24px); max-height: 70vh; display: flex; flex-direction: column; background: var(--dsw-alias-bg-layer-1, #fff); border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3)); border-radius: 12px; box-shadow: 0 14px 44px rgba(0,0,0,0.28); overflow: hidden; }
.gnx-tabs { display: flex; gap: 2px; padding: 6px 6px 0; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3)); overflow-x: auto; flex: none; }
.gnx-tab { border: none; background: transparent; padding: 7px 10px; font-size: 12px; color: var(--dsw-alias-label-secondary, #777); cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; white-space: nowrap; }
.gnx-tab:hover { color: var(--dsw-alias-label-primary, #111); }
.gnx-tab.gnx-active { color: var(--dsw-alias-brand-primary, #4f7cff); border-bottom-color: var(--dsw-alias-brand-primary, #4f7cff); font-weight: 600; }
.gnx-body { flex: 1 1 auto; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.gnx-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.gnx-label { font-size: 11px; color: var(--dsw-alias-label-secondary, #777); }
.gnx-value { font-size: 12px; color: var(--dsw-alias-label-primary, #111); }
.gnx-btn { border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.4)); background: transparent; color: var(--dsw-alias-label-primary, #111); border-radius: 7px; padding: 5px 9px; font-size: 12px; cursor: pointer; font-family: inherit; }
.gnx-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.15)); border-color: var(--dsw-alias-border-l2, rgba(127,127,127,0.7)); }
.gnx-btn:disabled { opacity: .45; cursor: default; }
.gnx-btn.primary { background: var(--dsw-alias-brand-primary, #4f7cff); border-color: var(--dsw-alias-brand-primary, #4f7cff); color: #fff; }
.gnx-btn.primary:hover { background: var(--dsw-alias-brand-primary, #4f7cff); opacity: .88; }
.gnx-btn.danger { color: var(--dsw-alias-state-error-primary, #d33); border-color: var(--dsw-alias-state-error-primary, #d33); }
.gnx-input { width: 100%; border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.4)); border-radius: 7px; padding: 6px 8px; font-size: 12px; font-family: inherit; background: transparent; color: var(--dsw-alias-label-primary, #111); box-sizing: border-box; }
.gnx-input:focus { outline: none; border-color: var(--dsw-alias-brand-primary, #4f7cff); }
.gnx-textarea { resize: vertical; min-height: 56px; }
.gnx-list { display: flex; flex-direction: column; gap: 2px; }
.gnx-item { display: flex; align-items: center; gap: 8px; width: 100%; border: none; background: transparent; text-align: left; padding: 6px 8px; border-radius: 7px; cursor: pointer; color: var(--dsw-alias-label-primary, #111); font-size: 12px; font-family: inherit; }
.gnx-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.15)); }
.gnx-item.gnx-current { color: var(--dsw-alias-brand-primary, #4f7cff); font-weight: 600; background: var(--dsw-alias-interactive-bg-active, rgba(127,127,127,0.12)); }
.gnx-item-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gnx-tag { font-size: 9px; line-height: 1; padding: 2px 5px; border-radius: 7px; font-weight: 600; flex: none; }
.gnx-tag.M { background: rgba(79,124,255,0.15); color: #4f7cff; }
.gnx-tag.A { background: rgba(40,167,69,0.15); color: #28a745; }
.gnx-tag.D { background: rgba(217,83,79,0.15); color: #d9534f; }
.gnx-tag.R { background: rgba(240,173,78,0.15); color: #f0ad4e; }
.gnx-tag.q { background: rgba(127,127,127,0.18); color: #777; }
.gnx-pre { margin: 0; padding: 8px; border-radius: 8px; background: var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.1)); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow: auto; color: var(--dsw-alias-label-primary, #111); }
.gnx-add { background: rgba(40,167,69,0.12); color: #28a745; }
.gnx-del { background: rgba(217,83,79,0.12); color: #d9534f; }
.gnx-empty { padding: 16px 12px; color: var(--dsw-alias-label-secondary, #777); font-size: 12px; text-align: center; }
.gnx-error { padding: 8px 10px; border-radius: 7px; font-size: 12px; line-height: 1.45; color: var(--dsw-alias-state-error-primary, #d33); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d33) 12%, transparent); }
.gnx-ok { padding: 8px 10px; border-radius: 7px; font-size: 12px; color: #28a745; background: rgba(40,167,69,0.12); }
.gnx-seal { display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 14px; font-size: 11px; font-weight: 600; }
.gnx-seal.on { background: rgba(40,167,69,0.14); color: #28a745; }
.gnx-seal.off { background: rgba(127,127,127,0.16); color: var(--dsw-alias-label-secondary, #777); }
.gnx-sec-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--dsw-alias-label-secondary, #777); margin: 2px 0 0; }
.gnx-codebox { border: 1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.3)); border-radius: 8px; padding: 10px; background: var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.08)); }
.gnx-code { font-family: ui-monospace, Menlo, monospace; font-size: 15px; letter-spacing: .12em; color: var(--dsw-alias-brand-primary, #4f7cff); }
`;

    const TAG = 'dsh-git-nexus/GitNexusPanel.css';
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + TAG + '"]') === null) {
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-git-nexus';
      tag.dataset.pluginCss = TAG;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    /**
     * Minimal JSON-safety guard for the wire boundary. Mirrors the Host
     * gateway's src-json decode: values crossing the RPC must be JSON-safe
     * (no functions, symbols, cycles, non-finite numbers, or non-plain objects).
     */
    function assertJsonSafe(value, ancestors) {
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
      if (typeof value === 'number') {
        if (Number.isFinite(value)) return;
        throw new TypeError('non-finite number is not JSON-safe');
      }
      if (typeof value !== 'object') throw new TypeError(typeof value + ' is not JSON-safe');
      if (ancestors.has(value)) throw new TypeError('cyclic value is not JSON-safe');
      ancestors.add(value);
      try {
        if (Array.isArray(value)) {
          if (Object.getOwnPropertySymbols(value).length > 0 || Object.keys(value).length !== value.length) throw new TypeError('sparse or decorated array is not JSON-safe');
          for (let index = 0; index < value.length; index += 1) {
            if (!Object.hasOwn(value, index)) throw new TypeError('sparse array is not JSON-safe');
            assertJsonSafe(value[index], ancestors);
          }
          return;
        }
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== null && prototype !== Object.prototype) throw new TypeError('non-plain object is not JSON-safe');
        if (Object.getOwnPropertySymbols(value).length > 0) throw new TypeError('symbol property is not JSON-safe');
        for (const key of Reflect.ownKeys(value)) {
          const entry = Object.getOwnPropertyDescriptor(value, key);
          if (entry === void 0 || !entry.enumerable || !('value' in entry)) throw new TypeError('non-data property is not JSON-safe');
          assertJsonSafe(entry.value, ancestors);
        }
      } finally {
        ancestors.delete(value);
      }
    }

    /**
     * Strict codec for one wire field. The current client API requires every
     * Remote codec to be `strict` (a `src-json` codec is rejected at mount
     * time), so the contribution mounts strict codecs whose `parse` validates
     * the JSON-safe wire shape and passes the value through unchanged —
     * preserving the gateway's source-mode semantics. `undefined` is accepted
     * so optional parameters can be omitted.
     */
    function strictCodec(typeSymbol) {
      return {
        mode: 'strict',
        typeSymbol,
        schema: {
          parse(value) {
            if (value === void 0) return value;
            assertJsonSafe(value, new Set());
            return value;
          },
        },
      };
    }

    /** Remote descriptors matching the Host gateway signatures (strict codecs). */
    function descriptor(method, params) {
      return {
        id: 'dsh-git-nexus#gitNexus/' + method,
        service: 'gitNexusGateway',
        namespace: 'gitNexus',
        method: method,
        invocation: { kind: 'direct' },
        parameters: params.map((name) => ({ name, wire: name, source: 'json', codec: strictCodec('dsh-git-nexus#parameter:' + name) })),
        result: strictCodec('dsh-git-nexus#result:' + method),
      };
    }

    const TYPERT_REMOTE = {
      package: 'dsh-git-nexus',
      descriptors: [
        descriptor('status', ['cwd']),
        descriptor('changes', ['cwd']),
        descriptor('diff', ['cwd', 'path', 'staged']),
        descriptor('log', ['cwd', 'limit']),
        descriptor('branches', ['cwd']),
        descriptor('branchCreate', ['cwd', 'name']),
        descriptor('branchDelete', ['cwd', 'name']),
        descriptor('checkout', ['cwd', 'branch']),
        descriptor('stage', ['cwd', 'path']),
        descriptor('unstage', ['cwd', 'path']),
        descriptor('discard', ['cwd', 'path']),
        descriptor('commit', ['cwd', 'message']),
        descriptor('push', ['cwd']),
        descriptor('pull', ['cwd']),
        descriptor('sync', ['cwd']),
        descriptor('fetch', ['cwd']),
        descriptor('files', ['cwd', 'dir']),
        descriptor('readFile', ['cwd', 'path']),
        descriptor('githubStatus', []),
        descriptor('githubConfig', []),
        descriptor('githubLogin', ['clientId', 'scopes']),
        descriptor('githubPoll', []),
        descriptor('githubLogout', []),
        descriptor('githubPR', ['cwd', 'title', 'body', 'base', 'head']),
        descriptor('workflowGet', []),
        descriptor('workflowSet', ['steps']),
      ],
    };

    const inject = ['remote', 'slots', 'timer'];

    async function apply(ctx) {
      await ctx.remote.$mount(TYPERT_REMOTE);
      // The mounted contribution registers the `remote.gitNexus` namespace
      // service. Resolve it via ctx.get: the namespace is mounted by this very
      // apply, so it cannot be declared in `inject` (that would wait on itself),
      // and the Cordis proxy path would demand an inject declaration.
      const git = ctx.get('remote.gitNexus');

      function withTimeout(promise, ms) {
        return Promise.race([promise, ctx.timer.timeout(ms).then(() => { throw new Error('timeout'); })]);
      }

      async function invoke(method, ...args) {
        try {
          const res = await withTimeout(git[method](...args), 40000);
          if (res && res.ok) return { ok: true, value: res.value };
          const err = res && res.error ? (res.error.message || res.error) : null;
          return { ok: false, error: err || 'call failed' };
        } catch (e) {
          return { ok: false, error: 'timeout or network error' };
        }
      }

      function GitIcon(props) {
        return h('svg',
          Object.assign({ viewBox: '0 0 24 24', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, props),
          h('line', { x1: '6', y1: '3', x2: '6', y2: '15' }),
          h('circle', { cx: '18', cy: '6', r: '3' }),
          h('circle', { cx: '6', cy: '18', r: '3' }),
          h('path', { d: 'M18 9a9 9 0 0 1-9 9' }),
        );
      }

      // ── Changes (SCM) ──────────────────────────────────────────────────
      function ChangesTab(props) {
        const { cwd, info, refresh } = props;
        const [entries, setEntries] = React.useState(null);
        const [err, setErr] = React.useState(null);
        const [selected, setSelected] = React.useState(null);
        const [diffText, setDiffText] = React.useState('');
        const [diffStaged, setDiffStaged] = React.useState(false);
        const [message, setMessage] = React.useState('');
        const [busy, setBusy] = React.useState(null);
        const [opMsg, setOpMsg] = React.useState(null);

        async function load() {
          setErr(null);
          const res = await invoke('changes', cwd);
          if (res.ok) setEntries(res.value.entries || []);
          else { setEntries([]); setErr(res.error); }
        }

        React.useEffect(() => { load(); }, [cwd]);

        async function loadDiff(path, staged) {
          setSelected(path);
          setDiffStaged(staged);
          const res = await invoke('diff', cwd, path, staged);
          setDiffText(res.ok ? (res.value.text || '') : '');
        }

        async function run(op, fn, arg) {
          setBusy(op + (arg ? ':' + arg : ''));
          setOpMsg(null);
          const res = await fn();
          setBusy(null);
          if (!res.ok) { setOpMsg(res.error); return; }
          await load();
          if (refresh) refresh();
          setOpMsg({ ok: true, text: op + ' ok' });
        }

        const summary = h('div', { className: 'gnx-row' },
          h('span', { className: 'gnx-label' }, '\u2191 ' + (info.ahead || 0) + '  \u2193 ' + (info.behind || 0)),
          h('span', { className: 'gnx-tag M' }, (info.staged || 0) + ' staged'),
          h('span', { className: 'gnx-tag q' }, (info.unstaged || 0) + ' modified'),
          h('span', { className: 'gnx-tag q' }, (info.untracked || 0) + ' untracked'),
        );

        const remote = h('div', { className: 'gnx-row' },
          h('button', { className: 'gnx-btn primary', disabled: !!busy, onClick: () => run('Push', () => invoke('push', cwd)) }, 'Push'),
          h('button', { className: 'gnx-btn', disabled: !!busy, onClick: () => run('Pull', () => invoke('pull', cwd)) }, 'Pull'),
          h('button', { className: 'gnx-btn', disabled: !!busy, onClick: () => run('Sync', () => invoke('sync', cwd)) }, 'Sync'),
          h('button', { className: 'gnx-btn', disabled: !!busy, onClick: () => run('Fetch', () => invoke('fetch', cwd)) }, 'Fetch'),
        );

        const commitBox = h('div', { className: 'gnx-row', style: { alignItems: 'flex-end' } },
          h('textarea', {
            className: 'gnx-input gnx-textarea',
            placeholder: 'Commit message (staged changes only)',
            value: message,
            style: { flex: '1 1 200px' },
            onChange: (e) => setMessage(e.target.value),
          }),
          h('button', { className: 'gnx-btn primary', disabled: !!busy || message.trim() === '', onClick: () => { run('Commit', () => invoke('commit', cwd, message)); setMessage(''); } }, 'Commit'),
        );

        const stageAll = h('div', { className: 'gnx-row' },
          h('button', { className: 'gnx-btn', onClick: () => run('Stage all', () => invoke('stage', cwd, '')) }, 'Stage all'),
          h('button', { className: 'gnx-btn', onClick: () => run('Unstage all', () => invoke('unstage', cwd, '')) }, 'Unstage all'),
        );

        let listBody;
        if (err) listBody = h('div', { className: 'gnx-error' }, err);
        else if (entries === null) listBody = h('div', { className: 'gnx-empty' }, 'Loading\u2026');
        else if (entries.length === 0) listBody = h('div', { className: 'gnx-empty' }, 'Working tree clean');
        else listBody = h('div', { className: 'gnx-list' },
          entries.map((e) => {
            const tag = e.untracked ? 'q' : e.renamed ? 'R' : e.deleted ? 'D' : e.added ? 'A' : 'M';
            const tagLabel = e.untracked ? '?' : e.renamed ? 'R' : e.deleted ? 'D' : e.added ? 'A' : 'M';
            return h('div', { key: e.path, className: 'gnx-item', style: { cursor: 'default' } },
              h('span', { className: 'gnx-tag ' + tag }, tagLabel),
              h('span', { className: 'gnx-item-name', title: e.path, onClick: () => loadDiff(e.path, e.staged) }, e.path),
              e.staged
                ? h('button', { className: 'gnx-btn', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => run('Unstage', () => invoke('unstage', cwd, e.path)) }, 'Unstage')
                : h('button', { className: 'gnx-btn', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => run('Stage', () => invoke('stage', cwd, e.path)) }, 'Stage'),
              !e.staged && !e.untracked
                ? h('button', { className: 'gnx-btn danger', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => run('Discard', () => invoke('discard', cwd, e.path)) }, 'Discard')
                : null,
            );
          }),
        );

        let diffBody = null;
        if (selected) {
          diffBody = h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h('div', { className: 'gnx-row' },
              h('span', { className: 'gnx-value', style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, selected),
              h('button', { className: 'gnx-btn', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => loadDiff(selected, !diffStaged) }, diffStaged ? 'staged diff' : 'unstaged diff'),
              h('button', { className: 'gnx-btn', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => setSelected(null) }, '\u2715'),
            ),
            h('pre', { className: 'gnx-pre' }, diffText === '' ? '(no diff)' : diffText),
          );
        }

        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          summary, remote, commitBox, stageAll, listBody,
          opMsg ? (opMsg.ok ? h('div', { className: 'gnx-ok' }, opMsg.text) : h('div', { className: 'gnx-error' }, opMsg)) : null,
          diffBody,
        );
      }

      // ── Branches ───────────────────────────────────────────────────────
      function BranchesTab(props) {
        const { cwd, info, refresh } = props;
        const [branches, setBranches] = React.useState(null);
        const [err, setErr] = React.useState(null);
        const [name, setName] = React.useState('');
        const [busy, setBusy] = React.useState(null);
        const [opMsg, setOpMsg] = React.useState(null);

        async function load() {
          setErr(null);
          const res = await invoke('branches', cwd);
          if (res.ok) setBranches(res.value.branches || []);
          else { setBranches([]); setErr(res.error); }
        }
        React.useEffect(() => { load(); }, [cwd]);

        async function run(label, fn) {
          setBusy(label); setOpMsg(null);
          const res = await fn();
          setBusy(null);
          if (!res.ok) { setOpMsg(res.error); return; }
          setOpMsg({ ok: true, text: label + ' ok' });
          await load();
          if (refresh) refresh();
        }

        let body;
        if (err) body = h('div', { className: 'gnx-error' }, err);
        else if (branches === null) body = h('div', { className: 'gnx-empty' }, 'Loading\u2026');
        else body = h('div', { className: 'gnx-list' },
          branches.map((b) => {
            const cur = b === info.branch;
            return h('div', { key: b, className: 'gnx-item' + (cur ? ' gnx-current' : '') },
              h('span', { className: 'gnx-item-name', onClick: () => run('Checkout ' + b, () => invoke('checkout', cwd, b)) }, (cur ? '\u2713 ' : '') + b),
              cur ? null : h('button', { className: 'gnx-btn danger', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => run('Delete ' + b, () => invoke('branchDelete', cwd, b)) }, 'Del'),
            );
          }),
        );

        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          h('div', { className: 'gnx-row' },
            h('input', { className: 'gnx-input', style: { flex: '1 1 auto' }, placeholder: 'New branch name', value: name, onChange: (e) => setName(e.target.value) }),
            h('button', { className: 'gnx-btn primary', disabled: name.trim() === '' || !!busy, onClick: () => { run('Create ' + name.trim(), () => invoke('branchCreate', cwd, name.trim())); setName(''); } }, 'Create + switch'),
          ),
          body,
          opMsg ? (opMsg.ok ? h('div', { className: 'gnx-ok' }, opMsg.text) : h('div', { className: 'gnx-error' }, opMsg)) : null,
        );
      }

      // ── Log ────────────────────────────────────────────────────────────
      function LogTab(props) {
        const { cwd } = props;
        const [commits, setCommits] = React.useState(null);
        const [err, setErr] = React.useState(null);
        React.useEffect(() => {
          (async () => {
            const res = await invoke('log', cwd, 100);
            if (res.ok) setCommits(res.value.commits || []);
            else { setCommits([]); setErr(res.error); }
          })();
        }, [cwd]);

        if (err) return h('div', { className: 'gnx-error' }, err);
        if (commits === null) return h('div', { className: 'gnx-empty' }, 'Loading\u2026');
        if (commits.length === 0) return h('div', { className: 'gnx-empty' }, 'No commits');
        return h('div', { className: 'gnx-list' },
          commits.map((c) => h('div', { key: c.hash, className: 'gnx-item', style: { cursor: 'default', alignItems: 'flex-start' } },
            h('span', { className: 'gnx-tag q', style: { fontFamily: 'monospace' } }, c.shortHash),
            h('span', { style: { display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto', minWidth: 0 } },
              h('span', { className: 'gnx-value', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.subject),
              h('span', { className: 'gnx-label' }, c.author + ' \u00b7 ' + c.date + (c.refs ? ' \u00b7 ' + c.refs : '')),
            ),
          )),
        );
      }

      // ── Files ──────────────────────────────────────────────────────────
      function FilesTab(props) {
        const { cwd } = props;
        const [files, setFiles] = React.useState(null);
        const [err, setErr] = React.useState(null);
        const [q, setQ] = React.useState('');
        const [content, setContent] = React.useState(null);
        const [cur, setCur] = React.useState(null);

        React.useEffect(() => {
          (async () => {
            const res = await invoke('files', cwd, '');
            if (res.ok) setFiles(res.value.entries || []);
            else { setFiles([]); setErr(res.error); }
          })();
        }, [cwd]);

        async function openFile(p) {
          setCur(p);
          const res = await invoke('readFile', cwd, p);
          setContent(res.ok ? res.value : { text: res.error, truncated: false });
        }

        const ql = q.toLowerCase();
        const shown = files ? files.filter((f) => f.toLowerCase().indexOf(ql) !== -1).slice(0, 300) : [];
        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          h('input', { className: 'gnx-input', placeholder: 'Search files\u2026', value: q, onChange: (e) => setQ(e.target.value) }),
          err ? h('div', { className: 'gnx-error' }, err) : null,
          files === null ? h('div', { className: 'gnx-empty' }, 'Loading\u2026') : h('div', { className: 'gnx-list', style: { maxHeight: 200, overflowY: 'auto' } },
            shown.map((f) => h('div', { key: f, className: 'gnx-item' + (cur === f ? ' gnx-current' : ''), onClick: () => openFile(f) }, h('span', { className: 'gnx-item-name' }, f))),
          ),
          cur ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h('div', { className: 'gnx-row' }, h('span', { className: 'gnx-value', style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, cur)),
            content ? h('pre', { className: 'gnx-pre' }, content.text + (content.truncated ? '\n\u2026(truncated)' : '')) : h('div', { className: 'gnx-empty' }, 'Loading\u2026'),
          ) : null,
        );
      }

      // ── Workflow ───────────────────────────────────────────────────────
      function WorkflowTab() {
        const [steps, setSteps] = React.useState(null);
        const [title, setTitle] = React.useState('');

        async function load() {
          const res = await invoke('workflowGet');
          setSteps(res.ok ? (res.value.steps || []) : []);
        }
        React.useEffect(() => { load(); }, []);

        async function save(next) {
          const res = await invoke('workflowSet', next);
          if (res.ok) setSteps(res.value.steps || []);
        }
        function add() {
          if (title.trim() === '') return;
          save([...(steps || []), { id: 's-' + Date.now(), title: title.trim(), status: 'pending' }]);
          setTitle('');
        }
        function cycle(s) {
          const map = { pending: 'active', active: 'done', done: 'pending' };
          save((steps || []).map((x) => x.id === s.id ? { ...x, status: map[x.status] || 'pending' } : x));
        }
        function remove(id) {
          save((steps || []).filter((x) => x.id !== id));
        }

        const icon = { pending: '\u25cb', active: '\u25d0', done: '\u2713' };
        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          h('div', { className: 'gnx-row' },
            h('input', { className: 'gnx-input', style: { flex: '1 1 auto' }, placeholder: 'Add a step\u2026', value: title, onChange: (e) => setTitle(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') add(); } }),
            h('button', { className: 'gnx-btn primary', onClick: add, disabled: title.trim() === '' }, 'Add'),
          ),
          steps === null ? h('div', { className: 'gnx-empty' }, 'Loading\u2026') : steps.length === 0 ? h('div', { className: 'gnx-empty' }, 'No steps yet') :
            h('div', { className: 'gnx-list' }, steps.map((s) => h('div', { key: s.id, className: 'gnx-item', style: { cursor: 'default' } },
              h('span', { className: 'gnx-tag ' + (s.status === 'done' ? 'A' : s.status === 'active' ? 'M' : 'q') }, icon[s.status] || '\u25cb'),
              h('span', { className: 'gnx-item-name', style: { textDecoration: s.status === 'done' ? 'line-through' : 'none', opacity: s.status === 'done' ? .6 : 1 }, onClick: () => cycle(s) }, s.title),
              h('button', { className: 'gnx-btn danger', style: { padding: '2px 6px', fontSize: '11px' }, onClick: () => remove(s.id) }, '\u2715'),
            ))),
        );
      }

      // ── GitHub ─────────────────────────────────────────────────────────
      function GithubTab(props) {
        const { cwd, refresh } = props;
        const [cfg, setCfg] = React.useState(null);
        const [status, setStatus] = React.useState(null);
        const [clientId, setClientId] = React.useState('');
        const [flow, setFlow] = React.useState(null);
        const [prTitle, setPrTitle] = React.useState('');
        const [prBody, setPrBody] = React.useState('');
        const [prBase, setPrBase] = React.useState('');
        const [prUrl, setPrUrl] = React.useState(null);
        const [msg, setMsg] = React.useState(null);
        const stopRef = React.useRef(null);

        async function load() {
          const c = await invoke('githubConfig');
          if (c.ok) { setCfg(c.value); setClientId(c.value.clientId || ''); }
          const s = await invoke('githubStatus');
          if (s.ok) setStatus(s.value);
        }
        React.useEffect(() => {
          load();
          return () => { if (stopRef.current) { stopRef.current(); stopRef.current = null; } };
        }, []);

        async function connect() {
          setMsg(null);
          const res = await invoke('githubLogin', clientId, '');
          if (!res.ok) { setMsg(res.error); return; }
          setFlow(res.value);
          if (stopRef.current) stopRef.current();
          stopRef.current = ctx.timer.interval(pollOnce, 5000);
          pollOnce();
        }

        async function pollOnce() {
          const res = await invoke('githubPoll');
          if (!res.ok || !res.value) return;
          const v = res.value;
          if (v.status === 'authorized') {
            if (stopRef.current) { stopRef.current(); stopRef.current = null; }
            setFlow(null);
            await load();
            if (refresh) refresh();
            setMsg({ ok: true, text: 'Connected as ' + (v.login || 'GitHub') + (v.fullAccess ? ' \u2014 full access' : '') });
          } else if (v.status !== 'pending') {
            if (stopRef.current) { stopRef.current(); stopRef.current = null; }
            setFlow(null);
            setMsg(v.error || 'Authorization failed');
          }
        }

        async function disconnect() {
          await invoke('githubLogout');
          await load();
          setMsg({ ok: true, text: 'Disconnected' });
        }

        async function createPR() {
          setMsg(null);
          setPrUrl(null);
          const res = await invoke('githubPR', cwd, prTitle, prBody, prBase, '');
          if (!res.ok) { setMsg(res.error); return; }
          setPrUrl(res.value.url);
        }

        if (cfg === null) return h('div', { className: 'gnx-empty' }, 'Loading\u2026');

        const seal = status
          ? h('span', { className: 'gnx-seal ' + (status.authed ? 'on' : 'off') },
              status.authed ? '\u2713 GitHub: ' + (status.login || 'connected') + (status.fullAccess ? ' \u00b7 full' : '') : '\u2013 GitHub: not connected')
          : null;

        let authArea;
        if (status && status.authed) {
          authArea = h('div', { className: 'gnx-row' },
            h('span', { className: 'gnx-label' }, 'method: ' + status.method),
            h('button', { className: 'gnx-btn danger', onClick: disconnect }, 'Disconnect'),
          );
        } else if (flow) {
          authArea = h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            h('div', { className: 'gnx-ok' }, 'Open this URL and enter the code:'),
            h('div', { className: 'gnx-codebox' },
              h('div', { className: 'gnx-value' }, flow.verificationUri),
              h('div', { style: { marginTop: 8 } }, h('span', { className: 'gnx-code' }, flow.userCode)),
            ),
            h('div', { className: 'gnx-label' }, 'Waiting for authorization\u2026'),
          );
        } else {
          authArea = h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h('span', { className: 'gnx-sec-title' }, 'Connect with OAuth'),
            h('input', { className: 'gnx-input', placeholder: 'GitHub OAuth App Client ID', value: clientId, onChange: (e) => setClientId(e.target.value) }),
            h('button', { className: 'gnx-btn primary', onClick: connect, disabled: clientId.trim() === '' }, 'Connect GitHub'),
            cfg && cfg.hasGh ? h('span', { className: 'gnx-label' }, 'Or run `gh auth login -s repo` \u2014 the plugin auto-detects gh.') : null,
          );
        }

        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          seal, authArea,
          msg ? (msg.ok ? h('div', { className: 'gnx-ok' }, msg.text) : h('div', { className: 'gnx-error' }, msg)) : null,
          h('span', { className: 'gnx-sec-title' }, 'Create pull request'),
          h('input', { className: 'gnx-input', placeholder: 'PR title', value: prTitle, onChange: (e) => setPrTitle(e.target.value) }),
          h('textarea', { className: 'gnx-input gnx-textarea', placeholder: 'PR body (optional)', value: prBody, onChange: (e) => setPrBody(e.target.value) }),
          h('input', { className: 'gnx-input', placeholder: 'Base branch (default: main)', value: prBase, onChange: (e) => setPrBase(e.target.value) }),
          h('button', { className: 'gnx-btn primary', disabled: prTitle.trim() === '' || !(status && status.authed), onClick: createPR }, 'Create PR'),
          prUrl ? h('a', { className: 'gnx-value', href: prUrl, target: '_blank', rel: 'noreferrer' }, prUrl) : null,
        );
      }

      // ── Panel shell ────────────────────────────────────────────────────
      function GitNexusUtility(props) {
        const sessionId = props.sessionId;
        const useSessions = props.useSessions;
        const cwd = useSessions && sessionId
          ? useSessions((s) => (s.byId[sessionId] ? s.byId[sessionId].cwd : undefined))
          : undefined;

        const [info, setInfo] = React.useState({ ok: false, isRepo: false, branch: null, detached: false, ahead: 0, behind: 0, staged: 0, unstaged: 0, untracked: 0 });
        const [open, setOpen] = React.useState(false);
        const [pos, setPos] = React.useState({ top: 0, right: 0 });
        const [tab, setTab] = React.useState('changes');

        async function refresh() {
          if (!cwd) return;
          const res = await invoke('status', cwd);
          if (res.ok) setInfo(res.value);
        }

        React.useEffect(() => {
          if (!cwd) return;
          let alive = true;
          const tick = async () => {
            const res = await invoke('status', cwd);
            if (alive && res.ok) setInfo(res.value);
          };
          tick();
          const stop = ctx.timer.interval(tick, 30000);
          return () => { alive = false; stop(); };
        }, [cwd]);

        function openPanel(event) {
          const el = event.currentTarget;
          const rect = el.getBoundingClientRect();
          setPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
          setOpen(true);
        }

        if (!cwd || !info.ok || !info.isRepo) return null;

        const TABS = [
          ['changes', 'Changes'],
          ['branches', 'Branches'],
          ['log', 'Log'],
          ['files', 'Files'],
          ['workflow', 'Workflow'],
          ['github', 'GitHub'],
        ];

        const pill = h('button', { type: 'button', className: 'gnx-pill', title: 'Git manager', onClick: openPanel },
          h('span', { className: 'gnx-icon' }, h(GitIcon)),
          h('span', { className: 'gnx-name' }, info.branch || 'git'),
          (info.ahead || info.behind) ? h('span', { className: 'gnx-badge' }, '\u2191' + (info.ahead || 0) + '\u2193' + (info.behind || 0)) : null,
        );

        let panel = null;
        if (open) {
          let tabBody = null;
          if (tab === 'changes') tabBody = h(ChangesTab, { cwd, info, refresh });
          else if (tab === 'branches') tabBody = h(BranchesTab, { cwd, info, refresh });
          else if (tab === 'log') tabBody = h(LogTab, { cwd });
          else if (tab === 'files') tabBody = h(FilesTab, { cwd });
          else if (tab === 'workflow') tabBody = h(WorkflowTab);
          else if (tab === 'github') tabBody = h(GithubTab, { cwd, refresh });

          panel = h('div', { className: 'gnx-panel', style: { top: pos.top, right: pos.right } },
            h('div', { className: 'gnx-tabs' },
              TABS.map(([key, label]) => h('button', { key, className: 'gnx-tab' + (tab === key ? ' gnx-active' : ''), onClick: () => setTab(key) }, label)),
            ),
            h('div', { className: 'gnx-body' }, tabBody),
          );
        }

        // The backdrop and panel are portaled to <body>: the panel is rendered
        // from inside the session-header slot, whose ancestors may create
        // stacking contexts that would otherwise trap `position: fixed` below
        // the conversation content (background text bleeding through/over the
        // panel). Portaling escapes those contexts so the z-index above is
        // honored against the whole app frame.
        return h('div', { className: 'gnx-root' }, pill,
          open ? ReactDOM.createPortal(h('div', { className: 'gnx-backdrop', onMouseDown: () => setOpen(false) }), document.body) : null,
          open ? ReactDOM.createPortal(panel, document.body) : null);
      }

      ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
        { name: 'conversation.session.header.utilities', id: 'git-nexus', order: 5, label: 'Git manager' },
        (props) => h(GitNexusUtility, props),
      ));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
