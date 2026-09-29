# CyxCode ACP (Agent Client Protocol)

CyxCode uses `@agentclientprotocol/sdk` to serve ACP over standard input/output:

```sh
cyxcode acp
```

Connect a model provider through CyxCode's `/connect` before starting an editor session. ACP's `authenticate` handler is not implemented; clients with terminal authentication support can launch CyxCode's advertised login command.

## Architecture

- `agent.ts`: ACP requests, history replay, event streaming, permission requests, and prompt dispatch through the CyxCode SDK.
- `session.ts`: connection-local session state, working directories, MCP configuration, model, variant, and mode selections.
- `selection.ts`: shared model parsing, available choices, variant metadata, and ACP configuration options.
- `types.ts`: internal session/configuration contracts.
- `../cli/cmd/acp.ts`: backend startup and JSON-RPC transport using the official ACP SDK.

## Session Configuration

New, loaded, resumed, and forked sessions return `configOptions` alongside the existing `models`, `modes`, and variant metadata. Clients can send `session/set_config_option` with:

| `configId` | Value                              | Behavior                                                                                         |
| ---------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `model`    | An advertised `provider/model` ID  | Reselecting the same model preserves a valid effort; changing models resets the effort override. |
| `mode`     | An advertised agent ID             | Selects a visible primary agent, such as `build` or `plan`.                                      |
| `effort`   | An advertised variant or `default` | Available only for models with variants. `default` clears the explicit override.                 |

The setter returns the complete option list and sends a `config_option_update` notification. Invalid option IDs or values return an invalid-params protocol error without changing selections.

Existing `session/set_model` and `session/set_mode` requests remain supported and also publish option updates. Legacy model IDs can include a reasoning variant suffix. Selecting a base model through the legacy model setter continues to clear the explicit variant, preserving existing CyxCode behavior. Exact model IDs containing slashes take precedence over interpreting a suffix as a variant.

Loading, resuming, and forking restore available selections from the last user message. Live selections, including explicit effort clearing, survive reload/resume within the same connection and working directory. Selections made without sending a prompt are **not persisted across connections**; durable session model/agent fields remain pending upstream work.

## Events and Permissions

CyxCode streams message and reasoning chunks, tool progress, usage, and available commands through session updates. Events are routed to their owning session. Tool permission requests are forwarded to the client, and its response is sent to CyxCode's existing permission system.

ACP excludes the question tool by default. Enable it only for clients that support interactive question prompts:

```sh
CYXCODE_ENABLE_QUESTION_TOOL=1 cyxcode acp
```

## Editor Configuration

For an editor that accepts an ACP executable, use `cyxcode` with argument `acp`. For example, a Zed agent-server entry is:

```json
{
  "agent_servers": {
    "CyxCode": {
      "command": "cyxcode",
      "args": ["acp"]
    }
  }
}
```

Editor support determines whether configuration options or legacy selectors are displayed. This batch was verified with paired ACP SDK connections, not a live external editor.

## Remaining Compatibility Work

- Persist unsent selections across ACP connections using durable session fields.
- Coordinate an SDK/protocol update for reasoning-part message boundaries; the pinned SDK's `ContentChunk` does not expose upstream's `messageId` field.
- Implement ACP authentication if in-protocol login is needed.

## Testing

Run from `packages/opencode`:

```sh
bun test test/acp
bun typecheck
```

Tests cover history restoration, model/mode/effort changes, invalid selections, prompt dispatch, concurrent session events, permissions, and SDK JSON-RPC request/notification handling. Backend fixtures are synthetic; these tests do not call live models.

## References

- [ACP specification](https://agentclientprotocol.com/)
- [ACP TypeScript SDK](https://github.com/agentclientprotocol/typescript-sdk)
