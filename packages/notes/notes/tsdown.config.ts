import { defineConfig } from 'tsdown'

/**
 * The index and invariant entries share the fold module, so each bundles as
 * its own single-entry build — the workspace multi-entry pass would emit a
 * shared chunk the package manifest does not publish. Typert artifacts are
 * emitted once per build by the workspace-mode generator in the root config.
 */
export default defineConfig([
  {
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  {
    entry: ['lib/types/invariant.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
])
