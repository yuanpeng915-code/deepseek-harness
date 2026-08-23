// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import type { FileTreeNode } from '@deepseek-ai/dsh-api-remotes/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-file-tree/client'

afterEach(cleanup)

const fakeTree: FileTreeNode[] = [
  { name: 'a.txt', path: '/root/a.txt', kind: 'file' },
  { name: 'src', path: '/root/src', kind: 'dir', children: [{ name: 'b.ts', path: '/root/src/b.ts', kind: 'file' }] },
]

async function bench() {
  const runtime = await SlotTestRuntime.create()
  const fileTree = { tree: async (_root: string) => ({ ok: true as const, value: fakeTree }) }
  runtime.provide('remote', { fileTree })
  runtime.provide('remote.fileTree', fileTree)
  await runtime.declare({
    'sidebar.workspaces.action': { kind: 'list', scope: 'root' },
    'shell.overlay': { kind: 'list', scope: 'root' },
  })
  await runtime.mount({ inject: [...inject], apply })
  return { runtime }
}

describe('ui-file-tree', () => {
  it('registers a header toggle that renders a folder icon button', async () => {
    const { runtime } = await bench()
    const slot = runtime.renderSlot('sidebar.workspaces.action', { wide: true })
    const button = slot.view.getByRole('button', { name: '文件' })
    expect(button).toBeDefined()
    await runtime.dispose()
  })

  it('registers a drawer that stays closed until the toggle opens it', async () => {
    const { runtime } = await bench()
    const slot = runtime.renderSlot('shell.overlay', {})
    expect(slot.container.textContent).toBe('')
    await runtime.dispose()
  })
})
