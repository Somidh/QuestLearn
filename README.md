# Switch Dummy Test

A minimal end-to-end plumbing test for the [Flip the Switch Hackathon](https://www.wemakedevs.org/hackathons/switch).

Goal: prove the round trip works — **chat message -> Switch -> Claude Code agent -> response back in chat** — before building the real hackathon project on top of it.

## What this tests

1. Switch Console is running and connected to a chat platform (Telegram).
2. Switch correctly routes a chat message to Claude Code.
3. Claude Code can read/write files in this repo and report back.
4. The response lands back in the same chat thread.

## Setup

1. Install [Switch Console](https://docs.switchagents.ai) (desktop app) and Docker.
2. Connect a Telegram bot to Switch (no workspace/admin access needed).
3. Point Switch at this repo and register Claude Code as the agent.

## Test commands to send in chat

- `list the files in this repo`
- `create a file called hello.txt with the text "Switch works"`
- `what's 15% of 240`

Each should get a reply in the same chat thread, confirming the agent actually executed the request rather than echoing it.

## Status

- [ ] Switch Console installed
- [ ] Telegram bot connected
- [ ] Claude Code registered as agent
- [ ] Round-trip test passed
