# @deepseek-ai/dsh-host-file-tree

English | [中文](README.zh.md)

Remote-only Host service that lists one workspace directory as a nested, breadth-first tree for the Web file-tree browser. Consumes the `fs` service; ignores build/VCS/cache directories and caps depth (12) and entries (5000).

## Model Experience

None, as this package exposes a read-only directory listing to the browser and never reaches the agent loop.

#### KV Cache effect

No model request exists to cache against; the listing never enters agent input.

## Known Limitations and Deferred Work

- **Bounded snapshot only** — the tree caps depth (12) and entries (5000) and reflects the moment of the call; there is no change feed, so the browser re-fetches to observe edits.
