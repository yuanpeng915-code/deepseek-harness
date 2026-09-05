/**
 * dsh-git-nexus — strict Typert host manifest (hand-authored).
 *
 * The client API of current DSH requires every Remote method's parameters and
 * result to carry STRICT codecs, and the host gateway claims endpoints from
 * these strict descriptors (the source-marker fallback cannot see markers
 * written through a separate copy of `@deepseek-ai/dsh-typert-protocol`).
 *
 * This manifest mirrors the runtime `GitNexusGateway` markers one-for-one.
 * The codecs are JSON-safe pass-through schemas: the gateway itself enforces
 * JSON-safety at the wire boundary, and the plugin's methods validate their
 * own inputs. `_zod` is present because the typert-loader requires the marker
 * on strict codec schemas.
 */
const jsonCodec = (typeSymbol) => ({
  mode: 'strict',
  typeSymbol,
  schema: {
    _zod: {},
    parse(value) {
      if (value === void 0) return value
      return value
    },
  },
})

const parameter = (name) => ({
  name,
  wire: name,
  source: 'json',
  acceptsUndefined: true,
  codec: jsonCodec('dsh-git-nexus#parameter:' + name),
})

const invocation = (method, params) => ({
  id: 'dsh-git-nexus#gitNexus/' + method,
  service: 'gitNexusGateway',
  namespace: 'gitNexus',
  method,
  invocation: { kind: 'direct' },
  parameters: params.map(parameter),
  result: jsonCodec('dsh-git-nexus#result:' + method),
})

const member = (method, params) => ({
  kind: 'method',
  name: method,
  signature: `@Remote('${method}') ${method}(${params.join(', ')}): object`,
  tags: [],
  description: 'gitNexus Remote method.',
  summary: 'gitNexus Remote method.',
})

export const TYPERT = {
  package: 'dsh-git-nexus',
  face: 'host',
  schemas: [],
  invocations: [
    invocation('status', ['cwd']),
    invocation('changes', ['cwd']),
    invocation('diff', ['cwd', 'path', 'staged']),
    invocation('log', ['cwd', 'limit']),
    invocation('branches', ['cwd']),
    invocation('branchCreate', ['cwd', 'name']),
    invocation('branchDelete', ['cwd', 'name']),
    invocation('checkout', ['cwd', 'branch']),
    invocation('stage', ['cwd', 'path']),
    invocation('unstage', ['cwd', 'path']),
    invocation('discard', ['cwd', 'path']),
    invocation('commit', ['cwd', 'message']),
    invocation('push', ['cwd']),
    invocation('pull', ['cwd']),
    invocation('sync', ['cwd']),
    invocation('fetch', ['cwd']),
    invocation('files', ['cwd', 'dir']),
    invocation('readFile', ['cwd', 'path']),
    invocation('githubStatus', []),
    invocation('githubConfig', []),
    invocation('githubLogin', ['clientId', 'scopes']),
    invocation('githubPoll', []),
    invocation('githubLogout', []),
    invocation('githubPR', ['cwd', 'title', 'body', 'base', 'head']),
    invocation('workflowGet', []),
    invocation('workflowSet', ['steps']),
  ],
  model: {
    services: [
      {
        tags: [],
        description: 'gitNexus gateway service: git, files, GitHub, and workflow operations for the web panel.',
        summary: 'gitNexus gateway service.',
        key: 'gitNexusGateway',
        exportName: 'GitNexusGateway',
        members: [
          member('status', ['cwd']),
          member('changes', ['cwd']),
          member('diff', ['cwd', 'path', 'staged']),
          member('log', ['cwd', 'limit']),
          member('branches', ['cwd']),
          member('branchCreate', ['cwd', 'name']),
          member('branchDelete', ['cwd', 'name']),
          member('checkout', ['cwd', 'branch']),
          member('stage', ['cwd', 'path']),
          member('unstage', ['cwd', 'path']),
          member('discard', ['cwd', 'path']),
          member('commit', ['cwd', 'message']),
          member('push', ['cwd']),
          member('pull', ['cwd']),
          member('sync', ['cwd']),
          member('fetch', ['cwd']),
          member('files', ['cwd', 'dir']),
          member('readFile', ['cwd', 'path']),
          member('githubStatus', []),
          member('githubConfig', []),
          member('githubLogin', ['clientId', 'scopes']),
          member('githubPoll', []),
          member('githubLogout', []),
          member('githubPR', ['cwd', 'title', 'body', 'base', 'head']),
          member('workflowGet', []),
          member('workflowSet', ['steps']),
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
}
