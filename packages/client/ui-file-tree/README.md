# @deepseek-ai/dsh-client-ui-file-tree

Workspace header file-tree drawer. A folder icon in the workspace browser header (`sidebar.workspaces.action`) toggles an overlay drawer listing the current workspace's directory tree; folders collapse/expand, and each file/folder row has a `+` that appends its absolute path to the composer draft (via a session-scoped bridge on `conversation.input.right`). The tree data comes from the `remote.fileTree` Remote (`@deepseek-ai/dsh-host-file-tree`).

## Model Experience

No model, token, or KV-cache effects: this package renders a read-only directory tree and writes paths into the composer draft; it never reaches the agent or the session log.
