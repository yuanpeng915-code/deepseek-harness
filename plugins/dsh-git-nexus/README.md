# dsh-git-nexus

A single, self-contained DeepSeek Harness (DSH) **web** plugin that merges the
git-management features of the popular `dsh-web-ui` plugin (SCM change panel +
branch management) with GitHub access, a workflow board, and file browsing —
one panel instead of several plugins.

## Features

- **Changes (SCM)** — working-tree status, per-file diff, stage / unstage / discard, commit.
- **Branches** — list, switch, create, delete.
- **Remote** — push, pull, sync (pull then push), fetch.
- **Log** — bounded, structured commit history.
- **Files** — list tracked files with search, read any text file.
- **Workflow** — persistent step board (Claude Code-style plan tracking).
- **GitHub** — OAuth Device Flow login (full `repo` access, revocable), scope seal, PR creation.

## Install

```bash
dsh plugin --profile web add "file:/absolute/path/to/dsh-git-nexus"
# then restart the web profile
dsh web
```

The plugin appears under **Settings → Plugins** and the panel pill appears in
the session header of git-managed workspaces.

## Compatibility

Targets DSH `0.1.0-rc.6` (web profile). The plugin ships a strict
[Typert](https://github.com/deepseek-ai/deepseek-harness) host manifest
(`./typert`) and mounts strict client codecs, matching the conventions of the
plugins inside the official repository.

This is a **community plugin** published under the [`dsh-plugin`
topic](https://github.com/topics/dsh-plugin) — the channel the DeepSeek Harness
maintainers ask community extensions to use (see the project's
[CONTRIBUTING.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/CONTRIBUTING.md)).

## GitHub OAuth

GitHub auth uses the [device flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow),
so no long-lived PAT is written to disk. You need a GitHub **OAuth App client id**:

1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
2. Any name / homepage / callback will do (device flow ignores the callback).
3. Paste the resulting **Client ID** into the panel's GitHub tab, click **Connect**,
   then open the printed URL and enter the user code.

The resulting token requests the `repo`, `workflow`, `read:user` and `user:email`
scopes and is stored with `0600` permissions under
`~/.dsh/storages/dsh-git-nexus/`. If the `gh` CLI is already authenticated, the
plugin uses it automatically and no client id is required.

## Security notes

- Every git/file command runs through a fresh `/bin/sh -c` child process with a
  30s timeout and a 2 MiB output cap. The web profile scopes DSH's `shell`
  service to per-session agent realms, so the host-plane gateway executes
  directly instead of injecting it.
- Branch names, paths, and commit messages are shell-quoted; control characters are rejected.
- GitHub tokens live only under `~/.dsh/storages/dsh-git-nexus/settings.json` (mode `0600`).

## License

MIT
