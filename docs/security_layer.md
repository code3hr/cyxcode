# CyxWatch Security Layer

CyxWatch is the runtime observability and security layer proposed by `New TODO.txt`.
It is not an antivirus product and not a separate agent framework.
It is a set of hooks, policies, and reports that make AI-driven behavior visible, auditable, and enforceable.

Related memory/privacy design: [CyxWatch Memory Firewall](./cyxwatch_memory_firewall.md).

## Goal

CyxCode already has the right primitives:

- event bus
- audit storage
- session metadata
- shell interception
- local persistence
- recall and graph context
- dashboard reporting

CyxWatch should reuse those primitives to answer three questions:

1. What did the agent access?
2. What did the agent send out?
3. Was that behavior consistent with the user prompt and policy?

## Scope

CyxWatch tracks observable runtime behavior:

- file reads and writes
- shell commands
- outbound network requests
- clipboard access
- browser/session scraping
- microphone or camera activation
- large uploads after a prompt
- unexpected access to unrelated folders

CyxWatch does not try to infer intent from model internals.
It monitors the agent runtime and the artifacts it touches.

## Current Missing Boundaries

Two gaps need to stay explicit in the plan.

### Network Exfiltration

Shell and filesystem visibility are not enough. An agent can use cached
credentials or ambient auth to call hosts such as `api.github.com`, S3, package
registries, or private service APIs. That is the other half of the trust problem.

Current state:

- backend URL-based flows use the shared `Http.fetch()` wrapper
- outbound attempts are checked before execution and logged before the network call
- remaining raw `fetch()` surfaces are internal server dispatch, browser dashboard
  calls, plugin SDK adapters, and the local recall sidecar
- WebSocket connections are not monitored

Required next state:

- all runtime HTTP calls route through a shared network wrapper
- outbound events record host, method, payload size, session id, and prompt id
- unknown hosts and large uploads require approval or block by policy
- WebSocket connections are treated as persistent outbound channels

### Secrets Already Inside The Process

Runtime observability can show what the process did, but it does not fully solve
secret containment. If a model or tool reads `process.env` and then includes a
secret in the assistant response, that leak may not appear as a risky shell or
filesystem event.

CyxWatch should treat this as a separate boundary:

- detect obvious shell/env access such as `env`, `printenv`, `set`, and
  `echo $TOKEN`
- treat `.env`, AWS credentials, SSH keys, browser credential stores, and common
  token names as sensitive targets
- scan tool outputs and persisted assistant text for high-confidence secrets
- prefer credential isolation so secrets are not ambiently available inside the
  agent process

Current implementation note: tool output is redacted before the final tool result
is returned, and assistant text is redacted before the final text part is
persisted. Streaming assistant deltas still need a separate redaction pass.

### Persistent Memory Profiling

Long-term memory makes agents useful across sessions, but it also creates a
persistent cognitive layer around the model. Memory files, skill files, agent
profiles, recall indexes, vector databases, wiki notes, and conversation history
can become a behavioral profile of the user or organization.

The model may forget, but the surrounding system does not.

CyxWatch should treat memory as a protected resource:

- classify memory as `public`, `private`, `sensitive`, or `never_send`
- keep memory local by default
- encrypt sensitive memory at rest
- minimize and redact memory before sending it to cloud models
- require approval before exposing sensitive memory
- record which memory was accessed, why, and whether it was sent outward

The core rule is that the model can request memory, but local policy decides
what memory can be read or disclosed.

The long-term model is complementary boundaries:

- CyxWatch: observe and enforce what the agent touches, executes, and sends
- credential isolation: keep secrets out of the agent process where possible
- output filtering: catch accidental secret disclosure in model/tool responses

## Architecture

CyxWatch should be split into five layers.

### 1. Instrumentation Layer

This layer captures raw activity from the runtime.

Hook points:

- filesystem reads and writes
- shell execution
- fetch / HTTP clients
- websocket connections
- browser and session tools
- tool result plumbing

Each event should include:

- session id
- prompt id
- timestamp
- operation type
- path or host
- byte count where relevant
- approval status
- tool name or command source

### 2. Correlation Layer

This layer connects activity to user intent.

It should correlate:

- user prompt
- accessed files
- outbound network activity
- shell commands
- session phase

The result is a prompt-aware activity record.
That record makes it possible to distinguish normal repo work from suspicious drift.

### 3. Policy Layer

This layer evaluates behavior against rules.

Examples:

- allow project-local reads
- deny `~/.ssh/**`
- deny browser cookie stores
- require approval for external uploads
- require approval for unknown domains
- block shell commands outside the project root

Policy outcomes:

- allow
- warn
- require approval
- block

The policy layer should be simple first.
Rules should be data-driven, not hard-coded.

### 4. Risk Engine

This layer converts events into a score.

Signals:

- sensitive path access
- unknown host
- large upload
- environment variable enumeration
- high-confidence secret in tool or assistant output
- access unrelated to prompt
- repeated denied access
- policy violation

The risk engine should emit a score and a small set of flags.

Example flags:

- sensitive file access
- unexpected outbound connection
- env access
- secret in output
- suspicious prompt mismatch
- repeated denied access

### 5. Reporting Layer

This layer turns raw telemetry into useful surfaces.

Outputs:

- CLI summary
- dashboard page
- audit trail
- anomaly history
- policy violation list

## Integration Points

CyxWatch should attach to the places CyxCode already uses.

### Shell

Shell execution is the highest-value first hook.
It should record commands, working directory, and approval context.

### File System

File access should be recorded for:

- read
- write
- readdir
- stat where useful

The first implementation can focus on wrapper functions around the existing filesystem helpers.

### Network

Track:

- host
- method
- payload size
- destination category
- whether the call was user-expected

Network tracking must cover direct HTTP clients, not only tool-level web fetches.
The target design is a shared wrapper used by all runtime fetch paths, followed by
WebSocket monitoring for persistent outbound channels.

### Environment and Output Leakage

Track:

- shell commands that enumerate environment variables
- reads of `.env` and known credential files
- tool results that contain high-confidence secret patterns
- assistant output that appears to include credentials or bearer tokens

This is not a replacement for credential isolation. It is the observability and
redaction layer for cases where a secret is already visible to the process.

### Tool Pipeline

CyxCode already attaches metadata to tool results.
CyxWatch can extend that metadata with:

- `cyxwatchRisk`
- `cyxwatchFileAccess`
- `cyxwatchNetworkActivity`
- `cyxwatchSensitiveAccess`

### Audit

CyxWatch events should be stored in the existing audit system.

Suggested event types:

- `ai.file.read`
- `ai.file.write`
- `ai.file.sensitive`
- `ai.network.outbound`
- `ai.network.large_upload`
- `ai.policy.violation`
- `ai.prompt.mismatch`
- `ai.shell.command`

## Storage Model

Keep storage local.

Recommended structure:

- `cyxwatch/events`
- `cyxwatch/sessions`
- `cyxwatch/policies`
- `cyxwatch/alerts`

Use the existing storage and SQLite backing rather than introducing a separate datastore.

Suggested record shape:

```ts
type WatchEvent = {
  id: string
  sessionId: string
  promptId?: string
  timestamp: number
  kind: string
  target?: string
  bytes?: number
  approved: boolean
  risk: number
  flags: string[]
}
```

## Enforcement Model

CyxWatch should support progressive enforcement.

Stage 1:

- observe only
- log and score

Stage 2:

- warn on policy violations
- ask for approval on risky operations

Stage 3:

- block denied paths and unknown exfiltration targets
- sandbox sensitive operations

This progression keeps the system usable while still adding control.

## Recall and Graph

CyxWatch should feed into the existing knowledge layer.

Use cases:

- detect repeated suspicious sequences
- surface similar past incidents
- link policies to observed behavior
- connect alerts to sessions, files, and prompts

That makes the security layer searchable instead of only reactive.

## Dashboard

Add a dedicated web surface for security telemetry.

Suggested views:

- session timeline
- file access list
- network activity list
- policy violations
- risk score trend
- prompt-to-action correlation

Suggested route:

- `/dashboard/security`

In the consolidated UI, this lives in the main app on port `3000`.

## Implementation Order

Detailed build sequencing lives in `docs/cyxwatch_implementation_plan.md`.

### Phase 1

- add event schemas
- capture shell and file access
- store audit records
- compute a basic risk score

Current shipped pieces:

- `cyxcode watch report`
- `cyxcode watch recent`
- `cyxcode watch alerts`
- dashboard route: `/dashboard/security`
- filesystem read/write telemetry
- shell command telemetry from the process wrapper and bash tool
- outbound request telemetry for URL-based instruction, community, and provider fetches
- outbound request telemetry for import, MCP, and GitHub helper requests
- prompt-turn correlation with session and message ids
- basic policy decisions on events: allow, warn, require-approval, block
- anomaly alerts and local alert history
- local JSONL event storage under the project state directory

### Phase 2

- add network instrumentation
- add prompt correlation
- add allow / deny / require-approval rules
- add shared HTTP wrapper and migrate direct `fetch()` calls
- add env-access detection for shell commands and file reads

Current shipped pieces:

- prompt-turn correlation for CyxWatch events
- outbound request telemetry for core URL-based flows
- governance config schema for scope, policies, default action, and audit settings
- governance scope and policy engine
- permission-gate enforcement for governance outcomes:
  - `auto-approve` skips the normal permission prompt
  - `require-approval` keeps the normal permission prompt
  - `blocked` denies the tool call before execution
- low-level wrapper enforcement for hard block decisions:
  - process wrapper blocks destructive shell commands before spawn
  - filesystem write wrapper runs CyxWatch guard before write

### Phase 3

- add dashboard reporting
- add CLI summary command
- add alert history

Current shipped pieces:

- dashboard security page
- app route: `/dashboard/security` on port `3000`
- `cyxcode watch report`
- `cyxcode watch recent`
- `cyxcode watch alerts`
- alert history in the dashboard and CLI

### Phase 4

- add recall-based anomaly detection
- add graph links between incidents, files, and prompts
- add stronger sandbox enforcement
- add response and tool-result secret scanning
- integrate with credential isolation patterns so secrets are not ambiently available

Current shipped pieces:

- CyxWatch anomaly alerts over local telemetry
- local alert history surfaced in CLI and dashboard
- first enforcement bridge into risky tool permission checks
- first low-level wrapper guard for paths that bypass normal tool permission checks

## Recommended Positioning

Use the following framing in docs and UI:

- AI Runtime Observability
- AI Agent Transparency Layer

Do not frame it as spyware detection or anti-AI tooling.

## Current Handoff

Last updated: 2026-05-19.

What is done:

- CyxWatch records prompt turns, file reads/writes, shell commands, selected outbound requests, risk flags, decisions, and alerts.
- `cyxcode watch report`, `cyxcode watch recent`, and `cyxcode watch alerts` expose the local telemetry.
- `/dashboard/security` exists in the main app on port `3000`.
- Governance config supports scope, policy rules, default action, and audit settings.
- Governance policy decisions are enforced through the tool permission gate:
  - `auto-approve` skips the normal permission prompt
  - `require-approval` keeps the normal permission prompt
  - `blocked` returns a governance-denied tool result before execution
- CyxWatch now also guards shared lower-level wrappers for hard block decisions:
  - `Process.spawn()` blocks destructive commands before spawn
  - `Filesystem.write()` checks the CyxWatch guard before writing
- CyxWatch avoids startup import cycles by lazy-loading `Log` and `Instance`.

Verified:

- `bun typecheck` from `packages/opencode`
- `bun test test/governance/governance.test.ts test/cyxcode/watch.test.ts` from `packages/opencode`

Next time:

- Add live-session tests proving configured governance policies block real tool calls end to end.
- Expand lower-level enforcement to network wrappers and direct fetch paths.
- Add WebSocket monitoring after the shared HTTP wrapper exists.
- Add env/secret leakage detection for shell commands, `.env` reads, and assistant/tool output.
- Decide where output redaction lives in the response pipeline and how users can override false positives.
- Add a UI for viewing/editing governance policy config.
- Link security incidents into the graph so prompts, files, commands, and alerts are explorable together.
- Decide whether `require-approval` should ever be handled below the tool layer, or remain only in the permission UI path.

## Summary

CyxWatch is the missing security/observability layer around the existing CyxCode runtime.
It should reuse current infrastructure, stay local-first, and begin as an observability pipeline before it becomes an enforcement system.
