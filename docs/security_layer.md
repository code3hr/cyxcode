# CyxWatch Security Layer

CyxWatch is the runtime observability and security layer proposed by `New TODO.txt`.
It is not an antivirus product and not a separate agent framework.
It is a set of hooks, policies, and reports that make AI-driven behavior visible, auditable, and enforceable.

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
- access unrelated to prompt
- repeated denied access
- policy violation

The risk engine should emit a score and a small set of flags.

Example flags:

- sensitive file access
- unexpected outbound connection
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

## Implementation Order

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

### Phase 3

- add dashboard reporting
- add CLI summary command
- add alert history

Current shipped pieces:

- dashboard security page
- `cyxcode watch report`
- `cyxcode watch recent`
- `cyxcode watch alerts`
- alert history in the dashboard and CLI

### Phase 4

- add recall-based anomaly detection
- add graph links between incidents, files, and prompts
- add stronger sandbox enforcement

## Recommended Positioning

Use the following framing in docs and UI:

- AI Runtime Observability
- AI Agent Transparency Layer

Do not frame it as spyware detection or anti-AI tooling.

## Summary

CyxWatch is the missing security/observability layer around the existing CyxCode runtime.
It should reuse current infrastructure, stay local-first, and begin as an observability pipeline before it becomes an enforcement system.
