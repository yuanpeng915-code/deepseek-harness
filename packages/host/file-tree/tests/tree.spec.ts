import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import FileTreeGateway from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

interface FakeEntry {
  readonly name: string
  readonly type: 'file' | 'directory'
  readonly path: string
}

/** In-memory fake fs: keys are paths, values are the directory's direct children. */
async function harness(tree: Record<string, FakeEntry[]>): Promise<{ gateway: FileTreeGateway }> {
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide('fs', {
    async resolve(path: string): Promise<string> { return path },
    processPath(target: unknown): string { return target as string },
    async listDir(target: unknown): Promise<Array<{ name: string; type: string; target: string }>> {
      return (tree[target as string] ?? []).map(e => ({ name: e.name, type: e.type, target: e.path }))
    },
  })
  await ctx.plugin(FileTreeGateway)
  return { gateway: ctx.get('fileTree') as FileTreeGateway }
}

describe('FileTreeGateway', () => {
  it('builds a nested tree, skips ignored directories, and caps entries', async () => {
    const { gateway } = await harness({
      '/root': [
        { name: 'src', type: 'directory', path: '/root/src' },
        { name: 'a.txt', type: 'file', path: '/root/a.txt' },
        { name: 'node_modules', type: 'directory', path: '/root/node_modules' },
        { name: '.git', type: 'directory', path: '/root/.git' },
      ],
      '/root/src': [{ name: 'b.ts', type: 'file', path: '/root/src/b.ts' }],
      '/root/node_modules': [{ name: 'x.js', type: 'file', path: '/root/node_modules/x.js' }],
      '/root/.git': [{ name: 'HEAD', type: 'file', path: '/root/.git/HEAD' }],
    })
    const nodes = await gateway.tree('/root')
    expect(nodes).toEqual([
      { name: 'src', path: '/root/src', kind: 'dir', children: [{ name: 'b.ts', path: '/root/src/b.ts', kind: 'file' }] },
      { name: 'a.txt', path: '/root/a.txt', kind: 'file' },
    ])
  })

  it('returns an empty tree for an empty or unlistable directory', async () => {
    const { gateway } = await harness({})
    await expect(gateway.tree('/root')).resolves.toEqual([])
  })
})
