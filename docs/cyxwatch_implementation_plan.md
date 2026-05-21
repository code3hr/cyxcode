# CyxWatch Implementation Plan

Last updated: 2026-05-21

This plan turns the CyxWatch security layer from partial observability into a
runtime boundary for network exfiltration, sensitive file access, env leakage,
and prompt-correlated agent behavior.

Related memory/privacy design: [CyxWatch Memory Firewall](./cyxwatch_memory_firewall.md).

## Current Baseline

Shipped:

- `packages/opencode/src/cyxcode/watch.ts` records prompt turns, shell commands,
  file reads/writes, selected outbound requests, decisions, risk flags, and
  alerts.
- `packages/opencode/src/util/process.ts` calls `CyxWatch.enforce()` before
  spawning and blocks destructive shell commands.
- `packages/opencode/src/util/filesystem.ts` records reads/writes and runs a
  guard before sensitive reads and writes.
- `packages/opencode/src/util/http.ts` wraps runtime HTTP fetch calls and records
  host, method, and request body size before the network call.
- `packages/opencode/src/cyxcode/watch/policy.ts` loads project-local policy
  rules from `.cyxcode/cyxwatch/policy.json` or `.opencode/cyxwatch/policy.json`.
- `packages/opencode/src/cyxcode/watch/secret.ts` redacts high-confidence
  secrets from tool output and persisted assistant text.
- `packages/opencode/src/cyxcode/watch/store.ts` mirrors events and alerts into
  local SQLite while keeping JSONL as the append-only audit trail.
- `packages/opencode/src/session/prompt.ts` creates prompt/session scope.
- `packages/opencode/src/tool/bash.ts` wraps bash tool execution in CyxWatch
  scope.
- CLI commands expose `watch report`, `watch recent`, and `watch alerts`.
- `/dashboard/security` displays the current telemetry.

Known gaps:

- WebSocket connections are not monitored.
- Provider SDK injected `fetch` functions and the local recall sidecar still need
  explicit boundary review.
- `require-approval` blocks at the wrapper layer in headless contexts; it does
  not yet bridge to an interactive approval prompt.
- Policy matching covers permission, path, command, host, and generic pattern
  rules; method and byte-threshold rules are still heuristic.
- Streaming assistant deltas can still briefly surface before final persisted
  assistant text is redacted.
- Web dashboard policy editing is API-ready but not designed yet.
- Persistent memory, recall, wiki, skills, and agent profile files are not yet
  classified, minimized, permissioned, or encrypted as a dedicated memory
  firewall.

## Design Goals

- Keep the system local-first: JSONL for append-only session logs, SQLite later
  for query history.
- Put enforcement at shared runtime wrappers, not only at tool UI boundaries.
- Preserve the existing tool permission flow instead of replacing it.
- Make policy decisions auditable even when the operation is allowed.
- Avoid blocking ordinary repo work with noisy false positives.
- Treat credential isolation as complementary, not something CyxWatch can fully
  replace.
- Treat long-term memory as a protected resource because it can become a
  behavioral profile of the user or organization.

## Architecture

CyxWatch should use six small modules instead of growing `watch.ts` into one
large file.

### 1. Event Core

Files:

- `packages/opencode/src/cyxcode/watch.ts`
- future split: `packages/opencode/src/cyxcode/watch/event.ts`

Responsibilities:

- define event, alert, decision, and report types
- manage prompt/session scope
- persist events and alerts
- expose `note`, `request`, `classify`, `enforce`, `recent`, `alerts`, `report`

Target event shape:

```ts
type WatchEntry = {
  id: string
  ts: number
  kind:
    | "prompt.turn"
    | "file.read"
    | "file.write"
    | "shell.command"
    | "network.outbound"
    | "network.websocket"
    | "env.access"
    | "output.secret"
  project?: string
  sessionID?: string
  messageID?: string
  prompt?: string
  path?: string
  host?: string
  method?: string
  cmd?: string
  bytes?: number
  risk: number
  flags: string[]
  decision: "allow" | "warn" | "require-approval" | "block"
  approved?: boolean
}
```

### 2. Policy Engine

Files:

- current: `packages/opencode/src/cyxcode/watch.ts`
- current: `packages/opencode/src/cyxcode/watch/policy.ts`
- current config: `.cyxcode/cyxwatch/policy.json`

Responsibilities:

- evaluate data-driven rules before hardcoded fallbacks
- match path, command, host, method, event kind, and byte thresholds
- return `allow`, `warn`, `require-approval`, or `block`
- attach a reason and matched rule id

Default rule categories:

- block SSH key access: `**/.ssh/**`, `**/id_rsa*`, `**/id_ed25519*`
- require approval for `.env*` reads
- block browser credential stores and keychain paths
- require approval for unknown outbound hosts
- require approval for large outbound payloads
- warn on access outside project root
- warn or require approval on env enumeration commands

### 3. Runtime Wrappers

Files:

- existing: `packages/opencode/src/util/process.ts`
- existing: `packages/opencode/src/util/filesystem.ts`
- new: `packages/opencode/src/util/http.ts`
- later: `packages/opencode/src/util/websocket.ts`

Responsibilities:

- call `CyxWatch.enforce()` before execution where blocking is possible
- call `CyxWatch.note()` after execution to record byte counts and outcomes
- keep wrappers small so migration is mechanical

HTTP wrapper API:

```ts
export namespace Http {
  export async function fetch(input: RequestInfo | URL, init?: RequestInit) {
    const req = new Request(input, init)
    CyxWatch.enforce({
      permission: "webfetch",
      patterns: [req.url],
      metadata: {
        url: req.url,
        method: req.method,
        bytes: bodySize(init?.body),
      },
    })
    await CyxWatch.request({
      url: req.url,
      method: req.method,
      bytes: bodySize(init?.body),
    })
    const res = await globalThis.fetch(req)
    return res
  }
}
```

Migration rule:

- replace direct external `fetch()` calls with `Http.fetch()`
- do not wrap internal `Server.Default().fetch()` calls that are in-process
- do not wrap Hono route handlers named `fetch`
- keep provider SDK injected fetch functions explicit and documented

### 4. Approval Bridge

Files:

- existing permission flow under `packages/opencode/src/permission/`
- new or extended bridge: `packages/opencode/src/cyxcode/watch/approval.ts`

Responsibilities:

- make wrapper-level `require-approval` block until the user responds
- reuse existing permission questions where a session/message context exists
- fall back to blocking or warning in non-interactive contexts, based on config
- persist the approved/denied decision with the event

Rules:

- `block` always throws before execution
- `warn` records and continues
- `require-approval` asks when an interactive permission channel exists
- `require-approval` defaults to block in headless mode unless config says warn

### 5. Secret Leakage Layer

Files:

- new: `packages/opencode/src/cyxcode/watch/secret.ts`
- integration candidates:
  - `packages/opencode/src/tool/bash.ts`
  - `packages/opencode/src/session/llm.ts`
  - message/tool result serialization paths

Responsibilities:

- classify env enumeration commands before shell execution
- scan tool outputs for high-confidence secrets
- scan assistant output before it is surfaced to users
- redact or require approval based on policy
- record `env.access` and `output.secret` events

Initial detectors:

- env commands: `env`, `printenv`, `set`, `export`, `Get-ChildItem Env:`
- variable expansion: `$TOKEN`, `$API_KEY`, `$AWS_SECRET_ACCESS_KEY`,
  `%TOKEN%`, `$env:TOKEN`
- secret patterns:
  - GitHub tokens
  - AWS access keys
  - private key blocks
  - bearer tokens
  - generic high-entropy token-like strings with sensitive names nearby

False-positive policy:

- redact only high-confidence matches by default
- warn on low-confidence matches
- record exact detector names, not the secret value
- allow user override through policy config later

### 6. Reporting and Query

Files:

- existing: `packages/opencode/src/server/watch.ts`
- existing: `packages/app/src/pages/dashboard-security.tsx`
- later: SQLite backing under `.cyxcode/cyxwatch/`

Responsibilities:

- expose report, recent events, and alerts
- add policy decision details
- add network host breakdown
- add prompt timeline views
- add output redaction/secret event views

### 7. Memory Firewall

Files:

- current memory surfaces: `packages/opencode/src/cyxcode/memory.ts`
- current recall surfaces: `packages/opencode/src/cyxcode/recall/`
- current wiki surfaces: `packages/opencode/src/cyxcode/wiki.ts`
- target policy integration: `packages/opencode/src/cyxcode/watch/policy.ts`
- target design doc: `docs/cyxwatch_memory_firewall.md`

Responsibilities:

- classify memory as `public`, `private`, `sensitive`, or `never_send`
- encrypt sensitive memory at rest
- minimize and redact memory before it is sent to a cloud model
- require approval before exposing sensitive memory
- record every memory read, retrieval, embedding, redaction, and send event
- expose memory access history in the dashboard

Principle:

- the model can request memory
- the local policy layer decides what memory can be read or sent
- every memory disclosure is auditable

## Implementation Phases

### Phase A: Network Wrapper

Goal: close the biggest exfiltration visibility gap.

Tasks:

- add `packages/opencode/src/util/http.ts`
- add `bodySize()` helper for string, Buffer, Blob, FormData, URLSearchParams,
  ArrayBuffer, and ReadableStream best-effort sizing
- migrate high-risk direct fetch paths first:
  - `packages/opencode/src/tool/webfetch.ts`
  - `packages/opencode/src/tool/websearch.ts`
  - `packages/opencode/src/tool/codesearch.ts`
  - `packages/opencode/src/provider/models.ts`
  - `packages/opencode/src/share/share-next.ts`
  - `packages/opencode/src/plugin/codex.ts`
  - `packages/opencode/src/plugin/copilot.ts`
  - `packages/opencode/src/voice/transcriber.ts`
- leave in-process server fetches alone
- add tests for logging and classification of outbound requests

Exit criteria:

- external HTTP calls in core tool/provider/share paths use `Http.fetch()`
- `cyxcode watch recent` shows outbound host/method/bytes
- unknown local/private network targets classify as `require-approval`

### Phase B: Wrapper-Level Approval

Goal: make `require-approval` mean "execution pauses" below the tool layer.

Tasks:

- add approval bridge from CyxWatch to existing permission system
- make `CyxWatch.enforce()` async
- update `Process.spawn()` and `Filesystem.write()` to await enforcement
- update new `Http.fetch()` to await enforcement
- add headless behavior config: block by default
- persist approved/denied events

Exit criteria:

- risky shell/network/write operations pause before execution
- denied decisions throw before execution
- headless mode does not silently allow `require-approval`

### Phase C: Sensitive Reads and Env Access

Goal: cover the env/process leakage raised in the threat model.

Tasks:

- add pre-read guard for `Filesystem.readText`, `readJson`, `readBytes`,
  `readArrayBuffer`
- expand sensitive path matching for `.env`, AWS credentials, SSH keys, browser
  stores, and common token files
- add command classifier for env enumeration in `CyxWatch.classify()`
- add `env.access` event kind
- add tests for `env`, `printenv`, PowerShell env access, and `.env` reads

Exit criteria:

- `.env` and credential-file reads classify before read
- env enumeration shell commands are flagged before spawn
- report and dashboard show env-access flags

### Phase D: Output Secret Scanning

Goal: catch the case where the model or a tool emits a secret.

Tasks:

- add `watch/secret.ts` detectors
- scan bash output before returning tool results
- scan tool result text before it enters the LLM transcript where practical
- scan assistant output before UI/event emission
- redact high-confidence matches with stable placeholders
- record `output.secret` events with detector names and counts

Exit criteria:

- obvious secrets in tool output are redacted
- assistant output containing a high-confidence secret is redacted or blocked
- no raw secret is written into CyxWatch event logs

### Phase E: Policy Config and UI

Goal: make policy tunable without editing source code.

Tasks:

- add `.cyxcode/cyxwatch/policies/default.json`
- load user policy and merge with defaults
- add server routes to read/update policy
- add `/dashboard/security/policy`
- add validation for patterns, actions, and byte thresholds

Exit criteria:

- users can add allow/warn/require-approval/block rules in the dashboard
- invalid policy does not break startup
- policy changes affect runtime decisions without code changes

### Phase F: SQLite and Graph Linkage

Goal: make history queryable and connected to project intelligence.

Tasks:

- keep JSONL as append-only source of truth
- add SQLite projection for events, alerts, prompts, paths, hosts, and decisions
- link alerts to sessions, messages, files, commands, hosts, and graph nodes
- add queries for "show sessions where agent accessed X" and "show all unknown
  outbound hosts"

Exit criteria:

- dashboard can filter by session, host, path, flag, and decision
- graph can answer incident-to-prompt and incident-to-file questions

### Phase M: Memory Firewall

Goal: prevent persistent agent memory from becoming invisible behavioral
surveillance infrastructure.

Tasks:

- add memory privacy class metadata
- default existing memory, wiki, and recall-derived records to `private`
- add `never_send` path and tag patterns
- record memory read, retrieve, send, and redact events
- add context minimizer before cloud model calls
- add memory approval prompts
- encrypt sensitive memory at rest
- add dashboard controls for inspect, export, delete, and reclassify

Exit criteria:

- users can see which memory was accessed and why
- users can see which context was sent to a model provider
- sensitive memory requires approval before disclosure
- `never_send` memory is blocked before read or send
- memory records can be exported, deleted, or reclassified

## Test Plan

Unit tests:

- `test/cyxcode/watch.test.ts`
  - sensitive path classification
  - env command classification
  - private/unknown host classification
  - large upload classification
- new `test/util/http.test.ts`
  - logs outbound request
  - blocks private host when policy says block
  - does not double-wrap internal server fetches
- new `test/cyxcode/secret.test.ts`
  - detects high-confidence tokens
  - avoids logging raw secret values
  - redacts output deterministically

Integration tests:

- session prompt that tries to read `.env` is blocked or requires approval
- shell tool running `printenv` is flagged before execution
- webfetch to unknown host records outbound event
- denied wrapper-level approval prevents execution

Manual verification:

- run `bun typecheck` from `packages/opencode`
- run focused tests from `packages/opencode`, not repo root
- start API and dashboard
- verify `/dashboard/security` shows shell, file, network, env, and output
  events

## Rollout Strategy

1. Ship network wrapper in observe-only mode.
2. Turn on warnings for unknown hosts and large uploads.
3. Enable require-approval for sensitive hosts/files in interactive sessions.
4. Enable block defaults for SSH keys, browser credential stores, and private key
   material.
5. Add output redaction in warn mode first, then enforce high-confidence
   redaction.

## Open Decisions

- Should wrapper-level `require-approval` use the same persisted approval rules as
  tool permissions, or a separate CyxWatch approval store?
- Should unknown outbound hosts default to warn or require approval on first
  release?
- Where is the safest single point to scan assistant output without duplicating
  streaming content?
- How much provider/plugin traffic should be allowlisted by default?
- Should credential isolation be a built-in CyxCode mode or documented as an
  integration boundary for tools like local credential proxies?
