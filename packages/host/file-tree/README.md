# @deepseek-ai/dsh-host-file-tree

Remote-only Host service that lists one workspace directory as a nested, breadth-first tree for the Web file-tree browser. Consumes the `fs` service; ignores build/VCS/cache directories and caps depth (12) and entries (5000).

## Model Experience

No model, token, or KV-cache effects: this package exposes a read-only directory listing to the browser and never reaches the agent loop.
