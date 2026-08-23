// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-model-board/client'

afterEach(cleanup)

async function bench() {
  const runtime = await SlotTestRuntime.create()
  await runtime.declare({
    'sidebar.footer.action': { kind: 'list', scope: 'root' },
    'shell.overlay': { kind: 'list', scope: 'root' },
  })
  await runtime.mount({ inject: [...inject], apply })
  return { runtime }
}

describe('ui-model-board', () => {
  it('registers a footer cell that renders the current phase and output price', async () => {
    const { runtime } = await bench()
    const slot = runtime.renderSlot('sidebar.footer.action', { wide: true })
    const button = slot.view.getByRole('button', { name: /模型看板/ })
    expect(button).toBeDefined()
    expect(button.textContent).toMatch(/高峰|低谷/)
    expect(button.textContent).toMatch(/¥/)
    await runtime.dispose()
  })

  it('registers an overlay panel that stays closed until hovered', async () => {
    const { runtime } = await bench()
    const slot = runtime.renderSlot('shell.overlay', {})
    expect(slot.container.textContent).toBe('')
    await runtime.dispose()
  })
})
