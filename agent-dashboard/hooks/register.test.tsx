import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-dashboard',
  component: 'Pane',
  requestId: 'agent-dashboard',
  props: {
    title: 'Sub-agents',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const USAGE = {
  startedAt: 0,
  context: { window: 200000 },
  rateLimits: [],
}

test('the pane is empty before any sub-agent spawns, on every surface', async ($, on) => {
  on('session.usage', () => ({ value: USAGE }))
  on('clock.now', () => ({ value: 1_000_000 }))

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const text = await ui.find({ type: 'Text', text: /No sub-agents yet/ })
    expect(text?.text).toBe('No sub-agents yet.')
    await ui.unmount()
  }
})

test('a spawned sub-agent shows as a running row with its task', async ($, on) => {
  on('session.usage', () => ({ value: USAGE }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('command.register', () => ({ value: { command: 'dashboard' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ model: 'test', agentId: 'agent-1' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'Read the README.', description: 'Read README', subagentType: 'Explore' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Read README/ }))?.text).toBe('Read README')
  expect((await ui.find({ type: 'Text', text: /running/ }))?.text).toContain('running')
  await ui.unmount()
})
