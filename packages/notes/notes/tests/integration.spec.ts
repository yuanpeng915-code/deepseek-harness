/**
 * Real-composition coverage (non-unit posture): a genuine Loader boots the
 * test cordis.yml, the notes plugin binds its Typert namespace and registers
 * its Remote methods, and the assembled application exposes the durable
 * note stream, the `notes` projection, and the conditional `notes:context`
 * prompt section.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SessionStore, { SessionId, type Session, type UserMessage } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import NoteService from '../src/index.ts'
let root: string | undefined
const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function loadComposition(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-notes-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    '  config:',
    "    persona: ''",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-notes'",
    '  config:',
    '    maxNoteBytes: 64',
    '    maxNotes: 2',
    '',
  ].join('\n'))
  const ctx = new Context()
  contexts.push(ctx)
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-notes', NoteService],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()
  const unloaded = [...ctx.loader.entries()]
    .filter(entry => entry.fiber === undefined && !entry.disabled)
    .map(entry => entry.options.name)
  expect(unloaded).toEqual([])
  return ctx
}

/** Build a registry-compatible agent around one session, recording steers. */
function stubAgentFor(session: Session): { agent: Agent; steered: UserMessage[] } {
  const steered: UserMessage[] = []
  const inbox = new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} })
  const agent: Agent = {
    id: session.id,
    options: {},
    session,
    inbox,
    ctx: new Context(),
    status: 'idle',
    send: () => {},
    followup: () => {},
    steer: (message: UserMessage) => { steered.push(message) },
    inject(input) { inbox.append('next-step', input) },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle() { return Promise.resolve() },
  }
  return { agent, steered }
}

describe('notes through a real Loader composition', () => {
  it('binds the Typert namespace, drives the durable stream, projection, and prompt section', async () => {
    const ctx = await loadComposition()
    expect(ctx.notes.typertRemote.namespace).toBe('notes')
    expect(remoteMethods(ctx.notes).map(marker => marker.method).sort())
      .toEqual(['delete', 'importAsMessage', 'put', 'setInject'])

    const session = ctx.sessions.create(SessionId('loader-notes'))
    const { agent, steered } = stubAgentFor(session)
    ctx.agents.register(agent)

    const created = ctx.notes.put(agent, { text: 'loader note', color: 'pink' })
    expect(created.text).toBe('loader note')
    expect(session.events.some(event =>
      event.type === 'note/put'
      && event.data.note.id === created.id)).toBe(true)

    const snapshot = ctx.sessionProjections.snapshot(session)
    expect(snapshot.values.notes).toEqual({ notes: [created], inject: false })

    // Injection off: the section renders to no model-visible text.
    const off = await ctx.systemPrompt.assemble({ agent })
    expect(off.sections.find(section => section.name === 'notes:context')?.text).toBe('')
    expect(renderPrompt(off)).not.toContain('sticky notes')

    ctx.notes.setInject(agent, true)
    const on = await ctx.systemPrompt.assemble({ agent })
    expect(on.sections.find(section => section.name === 'notes:context')?.text)
      .toContain('- loader note')
    expect(renderPrompt(on)).toContain("The user's sticky notes for this conversation")

    const imported = ctx.notes.importAsMessage(agent, {})
    expect(imported).toEqual({ count: 1 })
    expect(steered).toHaveLength(1)
  })

  it('enforces the composed limits through the Loader config', async () => {
    const ctx = await loadComposition()
    const session = ctx.sessions.create(SessionId('loader-notes-limits'))
    const { agent } = stubAgentFor(session)
    ctx.agents.register(agent)
    ctx.notes.put(agent, { text: 'one' })
    ctx.notes.put(agent, { text: 'two' })
    expect(() => ctx.notes.put(agent, { text: 'three' })).toThrow('already holds 2 notes')
    expect(() => ctx.notes.put(agent, { text: 'x'.repeat(65) })).toThrow('UTF-8 bytes')
  })
})
