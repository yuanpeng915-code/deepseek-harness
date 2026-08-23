/** Model pricing board browser half: footer button + overlay popover. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { createBoardStore, ModelBoardButton, ModelBoardPanel } from './ModelBoard.tsx'

/** Services required by the two footer/overlay registrations. */
export const inject = ['slots']

/** Mount the footer board and its overlay popover on one shared store. */
export function apply(ctx: ClientContext): void {
  const store = createBoardStore()
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'model-board', store },
    ModelBoardButton,
  ))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'model-board-panel', store },
    ModelBoardPanel,
  ))
}
