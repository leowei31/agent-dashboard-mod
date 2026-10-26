import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Row } from '../types'

const PANE = 'agent-dashboard'
const MAX_ROWS = 100
const TOOL_BAR_FULL = 20
const BAR_WIDTH = 16
const CLIP = 600

const rows = atom({ plugin: 'agent-dashboard', key: 'rows' } as const, [])
const windowSize = atom({ plugin: 'agent-dashboard', key: 'window' } as const, 200000)

const blank = (id: string, now: number): Row => ({
  id,
  description: '',
  type: '',
  status: 'running',
  startedAt: now,
  endedAt: 0,
  toolCalls: 0,
  activity: '',
  contextTokens: 0,
  prompt: '',
  result: '',
  isOpen: false,
})

// Applies `change` to the row `id`, adding the row first when an agent was not seen to spawn.
const patch = (list: readonly Row[], id: string, now: number, change: (row: Row) => Partial<Row>) => {
  const base = list.some(row => row.id === id) ? list : [...list, blank(id, now)]

  return base.map(row => (row.id === id ? { ...row, ...change(row) } : row)).slice(-MAX_ROWS)
}

const bar = (fraction: number) => {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * BAR_WIDTH)

  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

const clip = (text: string) => (text.length > CLIP ? `${text.slice(0, CLIP)}...` : text)

const compact = (tokens: number) =>
  tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M` : tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : `${tokens}`

const seconds = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000))

  return total >= 60 ? `${Math.floor(total / 60)}m${String(total % 60).padStart(2, '0')}s` : `${total}s`
}

const COLORS = { running: 'yellow', done: 'green', failed: 'red', stopped: 'gray' } as const
const DOTS = { running: '●', done: '✓', failed: '✗', stopped: '■' } as const

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'dashboard',
      description: 'Open the live sub-agent dashboard pane',
    })
    void $.ui.open({ id: PANE, title: 'Sub-agents' })

    return next(e)
  })

  on('command.run', { command: 'dashboard' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Sub-agents' })

    return { text: 'Sub-agent dashboard opened.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const out = await next(e)
    const id = out.agentId

    if (id !== undefined) {
      const now = await $.clock.now()
      await update($, rows, list =>
        patch(list, id, now, () => ({
          description: e.description,
          type: e.subagentType,
          prompt: e.prompt,
          status: 'running',
        })),
      )
    }

    return out
  })

  on('turn.start', async ($, e, next) => {
    const id = e.agentId

    if (id !== undefined) {
      const now = await $.clock.now()
      await update($, rows, list =>
        patch(list, id, now, row => ({
          status: 'running',
          prompt: e.text === '' ? row.prompt : e.text,
        })),
      )
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId

    if (id !== undefined) {
      const now = await $.clock.now()
      await update($, rows, list =>
        patch(list, id, now, row => ({ toolCalls: row.toolCalls + 1, activity: e.tool })),
      )
    }

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const out = yield* next(e)
    const id = e.agentId
    const usage = out.usage

    if (id !== undefined && usage !== null && usage !== undefined) {
      const now = await $.clock.now()
      const contextTokens =
        usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens + usage.output_tokens
      await update($, rows, list => patch(list, id, now, () => ({ contextTokens })))
    }

    return out
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId

    if (id !== undefined) {
      const now = await $.clock.now()
      const status = e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed'
      await update($, rows, list =>
        patch(list, id, now, () => ({ status, endedAt: now, activity: '', result: e.answer })),
      )
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, rows)
    const now = await $.clock.now()
    const usage = await $.session.usage()
    const window = usage.context.window > 0 ? usage.context.window : await read($, windowSize)
    const running = list.filter(row => row.status === 'running').length
    const sorted = [...list].sort((a, b) =>
      a.status === 'running' && b.status !== 'running'
        ? -1
        : b.status === 'running' && a.status !== 'running'
          ? 1
          : b.startedAt - a.startedAt,
    )

    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No sub-agents yet.</Text>
          <Text dimColor>They appear here as soon as an agent spawns one.</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>
          {running} running, {list.length - running} finished
        </Text>
        {sorted.map(row => {
          const elapsed = seconds((row.endedAt > 0 ? row.endedAt : now) - row.startedAt)
          const toolFraction = row.status === 'done' ? 1 : row.toolCalls / TOOL_BAR_FULL
          const contextFraction = window > 0 ? row.contextTokens / window : 0

          return (
            <Box key={row.id} flexDirection="column">
              <Box gap={1}>
                <Text color={COLORS[row.status]}>
                  {DOTS[row.status]} {row.status}
                </Text>
                <Text bold>{row.description === '' ? row.id : row.description}</Text>
                <Text dimColor>
                  {row.type} {elapsed}
                </Text>
              </Box>
              <Text color={COLORS[row.status]}>
                work {bar(toolFraction)} {row.toolCalls} tools
              </Text>
              <Text>
                ctx {bar(contextFraction)} {compact(row.contextTokens)}/{compact(window)} {Math.round(contextFraction * 100)}%
              </Text>
              {row.activity !== '' && <Text dimColor>now: {row.activity}</Text>}
              <Button
                key={`toggle-${row.id}`}
                label={row.isOpen ? 'Hide prompt and result' : 'Show prompt and result'}
                onPress={() =>
                  update($, rows, current => current.map(r => (r.id === row.id ? { ...r, isOpen: !r.isOpen } : r)))
                }
              />
              {row.isOpen && (
                <Box flexDirection="column">
                  <Text bold>Prompt</Text>
                  <Text dimColor>{clip(row.prompt) || '(none seen)'}</Text>
                  <Text bold>Result</Text>
                  <Text dimColor>{clip(row.result) || '(not finished)'}</Text>
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
