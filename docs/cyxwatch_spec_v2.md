# CyxWatch â€” AI Runtime Observability Layer
**Version 2 Â· May 2026**

CyxWatch answers one question: *did the agent do anything you didn't ask it to?*

It is not antivirus. It is not a sandbox. It is a runtime transparency layer â€” hooks, policy evaluation, risk scoring, and reporting â€” built on top of what CyxCode already provides.

---

## Why this exists (and why no one else has it)

Claude Code, Cursor, Windsurf, Copilot, Aider â€” none of them have this. They all operate on implicit trust: you prompt, they execute, you hope. That trust breaks the moment:

- A prompt injection in a file you opened tells the agent to exfiltrate your SSH key
- The model makes an incorrect inference and deletes something outside your project
- A malicious package in your repo runs arbitrary network calls during analysis
- The agent drifts from your intent across a long session without you noticing

CyxWatch makes all of that visible, interruptible, and auditable. That's the gap it fills.

---

## What it tracks

### High-value hooks (in priority order)

| Hook | Why it matters | Status |
|---|---|---|
| `process.spawn()` | Shell is the most dangerous surface â€” arbitrary execution | âœ… shipped |
| `filesystem.write()` | Destructive writes outside project scope | âœ… shipped |
| `filesystem.read()` | Sensitive file access (ssh keys, .env, cookie stores) | âœ… shipped |
| `fetch()` / HTTP clients | Exfiltration vector â€” silent POST to unknown host | âš ï¸ partial |
| WebSocket connections | Persistent exfiltration channel | âŒ not started |
| Clipboard read/write | Credential theft surface | âŒ not started |
| Browser/session scraping | Cookie and session token access | âŒ not started |

**The critical gap: network.** Filesystem and shell are instrumented. But a fetch() that bypasses the normal tool path won't be caught. That is the actual exfiltration vector. Phase 2 must close this before Phase 3 (dashboard) gets more investment.

**The second gap: secrets already inside the process.** Runtime visibility can show
what the agent touched, executed, and sent. It does not fully solve the case where
the model or a tool reads `process.env` and then surfaces a secret in an assistant
response. That requires a second boundary: credential isolation, env-access
detection, and output scanning/redaction.

CyxWatch should cover the observable side of this problem:

- flag shell commands that enumerate environment variables (`env`, `printenv`,
  `set`, `echo $TOKEN`)
- flag reads of `.env`, cloud credential files, SSH keys, browser credential
  stores, and other known-sensitive locations
- scan tool results and assistant output for high-confidence secret patterns
- record any redaction or policy decision as a CyxWatch event

This complements tools that keep secrets out of the agent process entirely. The
boundary split is: CyxWatch watches what the runtime does; credential isolation
limits what the runtime can leak.

---

## The five layers

### 1 Â· Instrumentation

Captures raw events at the wrapper level â€” not at the tool API level.

Why the distinction matters: if you only hook at the tool permission layer, a library call that goes direct to `fetch()` bypasses it entirely. CyxWatch needs hooks at the lowest shared wrappers:

```ts
// Process wrapper â€” already shipped
class Process {
  static async spawn(cmd, opts) {
    await CyxWatch.guard({ kind: 'ai.shell.command', target: cmd, ...opts })
    // guard throws on block, continues on allow/warn
    return nativeSpawn(cmd, opts)
  }
}

// Filesystem wrapper â€” already shipped
class Filesystem {
  static async write(path, data) {
    await CyxWatch.guard({ kind: 'ai.file.write', target: path, bytes: data.length })
    return nativeWrite(path, data)
  }
}

// Network wrapper â€” NOT YET SHIPPED â€” top priority
class Http {
  static async fetch(url, opts) {
    await CyxWatch.guard({ kind: 'ai.network.outbound', target: url, bytes: opts?.body?.length })
    return nativeFetch(url, opts)
  }
}
```

Each event shape:

```ts
type WatchEvent = {
  id: string
  sessionId: string
  promptId?: string          // links activity to the prompt that triggered it
  timestamp: number
  kind: string               // ai.file.read | ai.file.write | ai.shell.command | ai.network.outbound | ...
  target?: string            // path or host
  bytes?: number
  approved: boolean
  risk: number               // 0â€“100
  flags: string[]            // sensitive-file-access | unexpected-outbound | prompt-mismatch | repeat-deny
}
```

### 2 Â· Correlation

This is the layer that distinguishes CyxWatch from a dumb logger. It answers: *is this activity consistent with what the user asked?*

Every event is tagged with `promptId`. The correlation layer builds a `PromptActivityRecord`:

```ts
type PromptActivityRecord = {
  promptId: string
  prompt: string             // the actual user message
  filesRead: string[]
  filesWritten: string[]
  shellCommands: string[]
  outboundHosts: string[]
  startTime: number
  endTime?: number
  riskScore: number
  flags: string[]
}
```

**Prompt mismatch detection** â€” currently specified but not implemented. Two practical approaches:

**Option A â€” path heuristics (ship first):**
Maintain a blocklist of paths that are almost never relevant to coding tasks:
```ts
const SENSITIVE_PATTERNS = [
  '~/.ssh/**',
  '**/.env',
  '**/id_rsa*',
  '**/id_ed25519*',
  '~/.aws/credentials',
  '**/Library/Cookies/**',
  '**/Login Data',           // Chrome credentials
  '**/*.keychain*',
]
```
Any access to these paths during a prompt is flagged `sensitive-file-access` regardless of context. This catches the most dangerous cases with zero inference cost.

**Option B â€” local LLM scoring (Phase 4):**
Pass the prompt and the list of accessed paths to a local T1 model:
```
Prompt: "fix the import error in src/auth/login.ts"
Accessed paths: ["src/auth/login.ts", "~/.ssh/id_ed25519"]
Is ~/.ssh/id_ed25519 relevant to this task? Score 0-10.
```
Score above threshold â†’ `prompt-mismatch` flag. This adds semantic detection but costs inference time.

Ship Option A first. Option B is a Phase 4 enhancement.

### 3 Â· Policy

Data-driven rules evaluated per event. No hardcoded logic â€” rules live in `cyxwatch/policies/`.

```ts
type PolicyRule = {
  id: string
  pattern: string            // glob for path/host
  kind?: string              // filter by event kind
  action: 'allow' | 'warn' | 'require-approval' | 'block'
  reason?: string            // shown to user on block/warn
}
```

Default ruleset:

```yaml
# cyxwatch/policies/default.yaml

- id: block-ssh-keys
  pattern: "**/.ssh/**"
  action: block
  reason: "SSH key access blocked by default"

- id: block-env-files
  pattern: "**/.env*"
  kind: ai.file.read
  action: require-approval
  reason: "Environment file access requires approval"

- id: block-credential-stores
  pattern: "**/Library/Cookies/**"
  action: block
  reason: "Browser credential store access blocked"

- id: block-aws-creds
  pattern: "~/.aws/credentials"
  action: block
  reason: "AWS credentials blocked by default"

- id: warn-outside-project
  pattern: "!./{{project_root}}/**"
  action: warn
  reason: "Access outside project root"

- id: require-approval-unknown-host
  kind: ai.network.outbound
  pattern: "!api.anthropic.com"
  action: require-approval
  reason: "Outbound request to unknown host"

- id: block-large-upload
  kind: ai.network.outbound
  bytes_gt: 102400           # 100KB
  action: require-approval
  reason: "Large outbound upload (>100KB)"
```

**The `require-approval` decision point** â€” currently unresolved. The right answer is: `require-approval` must exist at **both** the tool permission layer AND the wrapper layer. If it only lives in the tool UI, any direct library call bypasses it. Implement it in the wrapper as a blocking `await`:

```ts
async function guard(event: WatchEvent) {
  const decision = evaluatePolicy(event)

  if (decision.action === 'block') {
    throw new GovernanceDeniedError(decision.reason)
  }

  if (decision.action === 'require-approval') {
    // Block execution until user responds
    const approved = await requestApproval(event, decision.reason)
    if (!approved) throw new GovernanceDeniedError('User denied')
  }

  if (decision.action === 'warn') {
    emitWarning(event, decision.reason)
    // Continue â€” warn does not block
  }

  // Store event regardless
  storeEvent({ ...event, approved: decision.action !== 'block' })
}
```

### 4 Â· Risk Engine

Converts events into a single score (0â€“100) and a set of flags per prompt session.

```ts
function scoreEvent(event: WatchEvent, context: PromptActivityRecord): number {
  let score = 0

  // Sensitive path access
  if (matchesSensitivePatterns(event.target)) score += 40

  // Unknown outbound host
  if (event.kind === 'ai.network.outbound' && !isKnownHost(event.target)) score += 35

  // Large upload
  if (event.kind === 'ai.network.outbound' && event.bytes > 102400) score += 30

  // Access unrelated to prompt (heuristic or LLM)
  if (isOutsideProjectRoot(event.target)) score += 20

  // Repeated denied access (agent retrying a blocked path)
  if (repeatedDeniedAccess(event, context)) score += 25

  // Policy violation
  if (event.flags.includes('policy-violation')) score += 15

  return Math.min(score, 100)
}
```

Flags emitted per session (not per event):

| Flag | Trigger |
|---|---|
| `sensitive-file-access` | Any access to known-sensitive paths |
| `unexpected-outbound` | Network call to non-allowlisted host |
| `prompt-mismatch` | Accessed paths inconsistent with prompt (heuristic) |
| `repeat-deny` | Agent retried a blocked operation 2+ times |
| `large-upload` | Outbound bytes > 100KB in one session |
| `env-access` | Command or tool enumerated process environment |
| `secret-in-output` | Tool result or assistant output matched high-confidence secret patterns |

### 5 Â· Reporting

Already shipped. Three surfaces:

```bash
cyxcode watch report          # summary of current session
cyxcode watch recent          # last N events across sessions
cyxcode watch alerts          # flagged anomalies
```

Dashboard at `/dashboard/security` on port 3000. Views:

- Session timeline (events in chronological order, colored by risk)
- File access list (read/write, path, risk score)
- Network activity list (host, method, bytes, decision)
- Policy violations (rule triggered, action taken, context)
- Risk score trend (per-session graph)
- Prompt-to-action correlation (prompt â†’ what the agent actually did)

**Missing from dashboard:** UI for editing governance policy config. Add a `/dashboard/security/policy` route with a rule editor â€” this is the most important missing UI piece because it's what lets users tune the system without editing YAML.

---

## Implementation priority (what to do next)

Detailed build sequencing lives in `docs/cyxwatch_implementation_plan.md`.

### 1. Network wrapper â€” immediate

This is the gap that matters most. Without it, exfiltration is undetected.

```ts
// packages/opencode/src/util/http.ts
export class Http {
  static async fetch(url: string, opts?: RequestInit): Promise<Response> {
    const event: WatchEvent = {
      id: ulid(),
      sessionId: Session.current(),
      promptId: Session.currentPrompt(),
      timestamp: Date.now(),
      kind: 'ai.network.outbound',
      target: new URL(url).hostname,
      bytes: opts?.body ? JSON.stringify(opts.body).length : 0,
      approved: false,
      risk: 0,
      flags: [],
    }
    await CyxWatch.guard(event)
    return fetch(url, opts)
  }
}
```

All existing `fetch()` calls in the codebase need to route through `Http.fetch()`. Run `grep -r "fetch(" packages/opencode/src` and replace. This is tedious but mechanical.

### 2. WebSocket monitoring

Add to the network wrapper. WebSocket connections are a persistent channel â€” flag any connection to a non-allowlisted host.

### 3. Env and output leakage

Add a separate leakage path for secrets that are already visible inside the
process. This should not be modeled as shell security only.

Required pieces:

- classify shell commands that enumerate env vars (`env`, `printenv`, `set`,
  `echo $TOKEN`)
- expand sensitive path matching for `.env`, AWS credentials, SSH keys, browser
  stores, and common token files
- scan tool results and assistant output for high-confidence secret patterns
- redact or require approval before returning suspected secrets
- record redaction decisions as CyxWatch events so the user can audit them

This is complementary to credential isolation. The preferred architecture keeps
secrets out of the agent process, then uses CyxWatch as the audit and fallback
redaction layer.

### 4. End-to-end governance tests

From the next-time list: live-session tests proving configured policies block real tool calls. Without these, you can't trust the enforcement path holds up across refactors.

```ts
test('governance blocks ssh key access', async () => {
  const session = await startSession()
  await session.setPolicy({ pattern: '~/.ssh/**', action: 'block' })

  const result = await session.run('read the file ~/.ssh/id_ed25519')

  expect(result.blocked).toBe(true)
  expect(result.reason).toContain('SSH key access blocked')
  expect(CyxWatch.events()).toContainEqual(
    expect.objectContaining({ kind: 'ai.file.read', target: '~/.ssh/id_ed25519', approved: false })
  )
})
```

### 5. Policy UI

Add `/dashboard/security/policy` â€” a basic rule editor. Table of current rules with add/edit/delete. No YAML editing required. This is what makes CyxWatch useful to someone who isn't you.

### 6. Graph linkage (Phase 4)

Link alerts â†’ sessions â†’ files â†’ prompts in the existing knowledge graph. Makes CyxWatch searchable ("show me all sessions where the agent accessed files outside the project root") rather than only reactive (reading the alert list after the fact).

---

## Positioning

**Internal framing:** The primary threat model is a misbehaving or compromised AI agent. Say this clearly in internal docs. It drives the right architectural decisions.

**External framing:** AI Runtime Observability / AI Agent Transparency Layer. Not "AI monitoring" (sounds like surveillance). Not "anti-AI tooling" (sounds adversarial). The message is: *you can trust the agent more because you can see exactly what it did.*

**Competitive differentiation:** Claude Code, Cursor, Windsurf, Copilot, Aider â€” none have this. CyxWatch is the first runtime transparency layer in a coding CLI. That is a real differentiator worth calling out.

---

## Storage

Local only. No external datastores introduced.

```
.cyxcode/
  cyxwatch/
    events/          # JSONL, one file per session
    sessions/        # session metadata
    policies/        # YAML rule files (user-editable)
    alerts/          # flagged anomalies
```

SQLite for queryable history. JSONL for streaming append during a session.

---

## Current status

Additional missing boundaries called out by the current analysis:

- env access detection is not done
- tool/assistant output secret scanning is not done
- credential isolation integration is not done

| Component | Status |
|---|---|
| Shell instrumentation | âœ… shipped |
| Filesystem read/write instrumentation | âœ… shipped |
| Event schema + JSONL storage | âœ… shipped |
| Governance policy engine | âœ… shipped |
| Tool permission gate enforcement | âœ… shipped |
| Low-level process/filesystem wrappers | âœ… shipped |
| CLI commands (report / recent / alerts) | âœ… shipped |
| Dashboard `/dashboard/security` | âœ… shipped |
| Prompt-turn correlation | âœ… shipped |
| Network instrumentation | âš ï¸ partial â€” URL-based flows only |
| Network wrapper (all fetch paths) | âŒ not done |
| WebSocket monitoring | âŒ not done |
| Clipboard/camera/microphone hooks | âŒ not done |
| End-to-end governance tests | âŒ not done |
| Policy UI (`/dashboard/security/policy`) | âŒ not done |
| Graph linkage (incidents â†’ prompts â†’ files) | âŒ not done |
| Prompt mismatch LLM scoring | âŒ Phase 4 |
