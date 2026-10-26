export type Row = {
  id: string
  description: string
  type: string
  status: 'running' | 'done' | 'failed' | 'stopped'
  startedAt: number
  endedAt: number
  toolCalls: number
  activity: string
  contextTokens: number
  prompt: string
  result: string
  isOpen: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'agent-dashboard': { rows: Row[]; window: number }
  }
}
