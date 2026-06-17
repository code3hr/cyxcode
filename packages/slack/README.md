# @cyxcode/slack

Slack integration for CyxCode that opens threaded bot conversations.

## Setup

Set the Slack credentials in your environment:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_APP_TOKEN`

## Development

```sh
bun install
bun run dev
bun run typecheck
```

The bot responds in channels where it is installed and keeps separate sessions per thread.
