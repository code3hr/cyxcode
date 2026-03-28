# CyxCode Audit System

*Token accountability. Zero dependencies.*

---

## Overview

Built-in audit trail for CyxCode — track every pattern match, AI call, correction, and drift event. Generate reports showing ROI, compliance, and effectiveness.

**No external dependencies.** Inspired by forensic observability tools, built lean.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CyxCode Core                          │
│  Router → Skills → Memory → Corrections → Dream              │
└──────────────────────────┬──────────────────────────────────┘
                           │ emit()
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Audit Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Privacy    │  │   Events    │  │   Report    │          │
│  │  Guard      │  │   Journal   │  │   Generator │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Storage                                 │
│  .opencode/audit/                                            │
│  ├── events-2026032812.ndjson   (hourly segments)           │
│  ├── events-2026032813.ndjson                               │
│  └── summary.json               (aggregated stats)          │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Privacy Guard

Redact secrets before they reach LLM or get stored in patterns/memory.

```typescript
// src/cyxcode/audit/privacy.ts

const PATTERNS = {
  // API Keys
  openai: /sk-[a-zA-Z0-9]{32,}/g,
  anthropic: /sk-ant-[a-zA-Z0-9-]{32,}/g,
  generic: /(?:api[_-]?key|token|secret|password)\s*[=:]\s*["']?([^\s"']+)/gi,

  // High-entropy (JWTs, hex tokens)
  jwt: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  hex: /\b[a-fA-F0-9]{32,}\b/g,

  // URLs with credentials
  urlCreds: /:\/\/[^:]+:[^@]+@/g,
}

export function redact(text: string): { clean: string; redacted: number } {
  let clean = text
  let redacted = 0

  for (const [name, pattern] of Object.entries(PATTERNS)) {
    clean = clean.replace(pattern, (match) => {
      // Entropy check for hex (avoid false positives like commit hashes)
      if (name === 'hex' && entropy(match) < 3.5) return match
      redacted++
      return `[REDACTED:${name}]`
    })
  }

  return { clean, redacted }
}

function entropy(s: string): number {
  const freq: Record<string, number> = {}
  for (const c of s) freq[c] = (freq[c] || 0) + 1
  return -Object.values(freq).reduce((h, f) => {
    const p = f / s.length
    return h + p * Math.log2(p)
  }, 0)
}
```

**When applied:**
- Before saving learned patterns
- Before saving memories
- Before logging error output in events

---

### 2. Event Journal

Append-only NDJSON log with hourly rotation.

```typescript
// src/cyxcode/audit/events.ts

export type EventType =
  | "pattern.match"      // Pattern matched, tokens saved
  | "pattern.miss"       // No match, AI handled
  | "pattern.learned"    // New pattern generated
  | "correction.added"   // User ran /correct
  | "correction.promoted"// Strength >= 3
  | "drift.detected"     // AI violated correction
  | "drift.reminded"     // Auto-reminder injected
  | "memory.loaded"      // Memory matched context
  | "commit.created"     // State snapshot
  | "session.start"      // New session began
  | "session.end"        // Session ended

type Event = {
  ts: number              // Unix timestamp
  type: EventType
  session?: string        // Session slug
  data: Record<string, unknown>
}

export namespace EventJournal {
  // Append event to hourly segment
  export async function emit(type: EventType, data: Record<string, unknown>): Promise<void>

  // Read events in time range
  export async function query(since: number, until?: number): Promise<Event[]>

  // Prune segments older than N days
  export async function prune(maxAgeDays: number): Promise<number>
}
```

**File format:**
```
.opencode/audit/events-2026032812.ndjson
```

```json
{"ts":1711619245,"type":"pattern.match","data":{"patternId":"npm-404","skill":"recovery","tokensSaved":800}}
{"ts":1711619310,"type":"correction.added","data":{"id":"abc123","rule":"use bun, not npm","strength":1}}
{"ts":1711619400,"type":"drift.detected","data":{"correctionId":"abc123","violation":"npm install express"}}
```

**Rotation:** One file per hour, auto-prune after 30 days.

---

### 3. Report Generator

Aggregate events into human-readable reports.

```typescript
// src/cyxcode/audit/report.ts

export type ReportPeriod = "1d" | "7d" | "30d" | "all"

export type Report = {
  period: { start: string; end: string }
  tokens: {
    saved: number
    used: number
    savingsPercent: number
    costSaved: number  // USD at $0.002/1K tokens
  }
  patterns: {
    matches: number
    misses: number
    hitRate: number
    learned: number
    topPatterns: Array<{ id: string; matches: number; tokensSaved: number }>
  }
  corrections: {
    added: number
    promoted: number
    driftEvents: number
    complianceRate: number
  }
  sessions: number
  memories: {
    loaded: number
    avgChars: number
  }
}

export namespace ReportGenerator {
  export async function generate(period: ReportPeriod): Promise<Report>
  export function formatText(report: Report): string
  export function formatJSON(report: Report): string
  export function formatCSV(report: Report): string
}
```

---

## CLI Commands

### `cyxcode audit`

Show recent events:

```bash
$ cyxcode audit --last 1h

[12:42:15] pattern.match    npm-404           800 tokens saved
[12:43:01] pattern.miss     —                 AI handled
[12:45:30] correction.added "use bun, not npm" strength=1
[12:48:12] pattern.match    git-conflict      600 tokens saved
```

### `cyxcode report`

Generate summary report:

```bash
$ cyxcode report --last 7d

╭─────────────────────────────────────────────────────────────╮
│  CyxCode Report: Mar 21-28, 2026                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TOKEN SAVINGS                                              │
│  ├── Saved:     187,200 tokens ($0.37)                     │
│  ├── Used:       48,600 tokens ($0.10)                     │
│  └── Efficiency: 79.4%                                      │
│                                                             │
│  PATTERNS                                                   │
│  ├── Matches:   847                                         │
│  ├── Misses:    203                                         │
│  ├── Hit Rate:  80.7%                                       │
│  └── Learned:   12 new patterns                             │
│                                                             │
│  TOP PATTERNS                                               │
│  1. npm-404           142 matches    28,400 tokens          │
│  2. git-conflict       98 matches    19,600 tokens          │
│  3. ts-module-error    87 matches    17,400 tokens          │
│                                                             │
│  CORRECTIONS                                                │
│  ├── Added:     12                                          │
│  ├── Promoted:  4 (auto-promoted at strength 3)             │
│  ├── Drift:     7 events                                    │
│  └── Compliance: 94.2%                                      │
│                                                             │
│  SESSIONS: 45                                               │
│                                                             │
╰─────────────────────────────────────────────────────────────╯
```

### Export formats:

```bash
$ cyxcode report --last 30d --format json > report.json
$ cyxcode report --last 30d --format csv > report.csv
```

---

## Integration Points

### Where events are emitted:

| Location | Event |
|----------|-------|
| `router.ts` → `route()` | `pattern.match`, `pattern.miss` |
| `learned.ts` → `generatePattern()` | `pattern.learned` |
| `corrections.ts` → `add()` | `correction.added` |
| `corrections.ts` → `reinforce()` | `correction.promoted` |
| `drift.ts` → `check()` | `drift.detected`, `drift.reminded` |
| `memory.ts` → `relevant()` | `memory.loaded` |
| `commit.ts` → `autoCommit()` | `commit.created` |
| `index.ts` → session hooks | `session.start`, `session.end` |

### Privacy guard applied:

| Location | What's redacted |
|----------|-----------------|
| `learned.ts` → before saving pattern | Error output |
| `memory.ts` → before saving memory | Memory content |
| `events.ts` → before logging | All event data |

---

## Storage

```
.opencode/
├── audit/
│   ├── events-2026032800.ndjson    # Hour 00
│   ├── events-2026032801.ndjson    # Hour 01
│   ├── ...
│   ├── events-2026032823.ndjson    # Hour 23
│   └── summary.json                 # Cached aggregates
├── cyxcode-stats.json               # (existing) router stats
├── cyxcode-learned.json             # (existing) learned patterns
└── history/                         # (existing) versioning
```

**Size estimate:**
- ~100 bytes per event
- ~1000 events/day = ~100KB/day
- 30 days = ~3MB (before pruning)

---

## Implementation Plan

| Phase | Task | Effort |
|-------|------|--------|
| 1 | `privacy.ts` — secret redaction | 1 hr |
| 2 | `events.ts` — NDJSON journal | 2 hrs |
| 3 | Emit events from router, corrections, drift | 2 hrs |
| 4 | `report.ts` — aggregation + formatting | 2 hrs |
| 5 | CLI commands (`audit`, `report`) | 1 hr |
| 6 | Auto-prune on `/dream` | 30 min |

**Total: ~8-9 hours**

---

## Future Extensions

| Feature | Description |
|---------|-------------|
| **Web dashboard** | Visual charts in `/dashboard` |
| **Email reports** | Weekly summary via webhook |
| **Team aggregation** | Combine reports across machines |
| **Compliance export** | PDF with signatures for auditors |

---

## Design Principles

1. **Zero dependencies** — No external services, all local
2. **Append-only** — Events are immutable once written
3. **Privacy-first** — Secrets redacted before storage
4. **Lightweight** — NDJSON, hourly rotation, auto-prune
5. **Offline** — Works without network, no tokens for audit

---

*"Tokens are the new currency. Now you can audit every one."*
