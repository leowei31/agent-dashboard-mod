# agent-dashboard

A Claude Code mod that opens a live side pane showing every sub-agent in your session.

When one large agent orchestrates many sub-agents, you can't see what each one is doing.
This pane shows it as it happens.

## What it shows

For each sub-agent:

- Status: running, done, failed or stopped, with elapsed time.
- A work bar based on tool-call count.
- A context bar showing tokens used against the context window.
- The tool it is using right now.
- The prompt it was given and the result it returned, behind a show and hide button.

The view is read-only.
There are no stop or message controls yet.

## Install

```
/plugin install agent-dashboard --marketplace leowei31/agent-dashboard-mod
```

Then start a new session.
The pane opens at session start.
Run `/dashboard` to open it again.

## What the bars mean

A sub-agent has no known total amount of work, so the work bar can't be a true percentage.
It fills as the agent makes tool calls and is full at 20 calls, or when the agent finishes.
The context bar is exact.
It uses the token counts of the agent's latest model request against the context window of your session's model.

## Limits

- The elapsed time of a running agent updates when something else redraws the pane, such as a tool call, not on a timer.
- A sub-agent started by a workflow outside the normal Agent tool may not report its details.
- The context window size is your session's model window, so a sub-agent on a different model can show a slightly wrong percentage.
- It needs a Claude Code build that supports mods.

## Development

Run `claude plugin test ./agent-dashboard` to run the tests.
Run `claude plugin validate ./agent-dashboard` to validate the manifest.
