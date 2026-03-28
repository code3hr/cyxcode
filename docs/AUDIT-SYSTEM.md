# CyxCode Audit System

*Token accountability. Built on existing infrastructure.*

---

## Overview

CyxCode already has comprehensive audit infrastructure from the pentest/security system. Instead of building new, we **extend existing** components for token/pattern tracking.

**Existing infrastructure we reuse:**
- `governance/audit.ts` — Audit entry storage, querying, bus events
- `pentest/reports/` — Report generation (Markdown, HTML, JSON)
- `pentest/compliance/` — Framework mapping and scoring
- `dashboard/` — Web UI for findings, scans, reports

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CyxCode Core                          │
│  Router → Skills → Memory → Corrections → Dream              │
└──────────────────────────┬──────────────────────────────────┘
                           │ Bus.publish()
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Existing Audit Infrastructure                   │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ GovernanceAudit │  │    Reports      │                   │
│  │ (record, list)  │  │ (md, html, json)│                   │
│  └─────────────────┘  └─────────────────┘                   │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │     Storage     │  │      Bus        │                   │
│  │ (file, memory)  │  │ (events, alerts)│                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## What Exists vs What We Add

### Existing (Security Audit)

| Component | Purpose | Location |
|-----------|---------|----------|
| `GovernanceAudit.record()` | Store audit entries | `governance/audit.ts` |
| `GovernanceAudit.list()` | Query with filters | `governance/audit.ts` |
| `Storage.write/read()` | File/memory persistence | `storage/storage.ts` |
| `Bus.publish()` | Real-time events | `bus.ts` |
| `Reports.generate()` | Markdown/HTML/JSON reports | `pentest/reports/` |
| `ComplianceMapper` | Framework mapping | `pentest/compliance/` |

### New (Token Audit)

| Component | Purpose | Location |
|-----------|---------|----------|
| `CyxAudit.record()` | Token-specific entries | `cyxcode/audit.ts` |
| `CyxAudit.report()` | Token savings report | `cyxcode/audit.ts` |
| Privacy guard | Secret redaction | `cyxcode/audit.ts` |
| Bus events | Pattern/correction events | Integration points |

---

## Event Types

### New CyxCode Events

```typescript
// src/cyxcode/audit.ts

export type CyxEventType =
  | "cyxcode.pattern.match"      // Pattern matched, tokens saved
  | "cyxcode.pattern.miss"       // No match, AI handled
  | "cyxcode.pattern.learned"    // New pattern generated
  | "cyxcode.correction.added"   // User ran /correct
  | "cyxcode.correction.promoted"// Strength >= 3
  | "cyxcode.drift.detected"     // AI violated correction
  | "cyxcode.drift.reminded"     // Auto-reminder injected
  | "cyxcode.memory.loaded"      // Memory matched context
  | "cyxcode.commit.created"     // State snapshot
  | "cyxcode.session.start"      // New session began
  | "cyxcode.session.end"        // Session ended

export type CyxAuditEntry = {
  id: string
  timestamp: number
  type: CyxEventType
  sessionID?: string
  data: {
    patternId?: string
    skill?: string
    tokensSaved?: number
    tokensUsed?: number
    correctionId?: string
    rule?: string
    strength?: number
    memoryId?: string
    tags?: string[]
    commitHash?: string
  }
}
```

### Integration with Existing Bus

```typescript
// Emit events using existing Bus infrastructure
import { Bus } from "@/bus"

// Define event types
export namespace CyxEvents {
  export const PatternMatch = Bus.event(
    "cyxcode.pattern.match",
    z.object({
      patternId: z.string(),
      skill: z.string(),
      tokensSaved: z.number(),
    })
  )

  export const CorrectionAdded = Bus.event(
    "cyxcode.correction.added",
    z.object({
      correctionId: z.string(),
      rule: z.string(),
      strength: z.number(),
    })
  )

  export const DriftDetected = Bus.event(
    "cyxcode.drift.detected",
    z.object({
      correctionId: z.string(),
      rule: z.string(),
      violation: z.string(),
    })
  )
}
```

---

## Storage

### Using Existing Storage Namespace

```typescript
import { Storage } from "@/storage/storage"
import { Instance } from "@/project/instance"

// Store CyxCode audit entries alongside governance audit
const key = ["cyxcode", "audit", Instance.project.id, entry.id]
await Storage.write(key, entry)

// Query entries
const keys = await Storage.list(["cyxcode", "audit", Instance.project.id])
```

### File Structure

```
.opencode/
├── storage/
│   ├── governance/audit/      # Existing security audit
│   │   └── {projectId}/
│   │       └── {entryId}.json
│   └── cyxcode/audit/         # New token audit
│       └── {projectId}/
│           └── {entryId}.json
├── cyxcode-stats.json          # Existing router stats
└── history/                    # Existing versioning
```

---

## Privacy Guard

Redact secrets before storage (same patterns work for security + token audit):

```typescript
// src/cyxcode/audit.ts

const SECRET_PATTERNS = {
  openai: /sk-[a-zA-Z0-9]{32,}/g,
  anthropic: /sk-ant-[a-zA-Z0-9-]{32,}/g,
  generic: /(?:api[_-]?key|token|secret|password)\s*[=:]\s*["']?([^\s"']+)/gi,
  jwt: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  hex: /\b[a-fA-F0-9]{32,}\b/g,
  urlCreds: /:\/\/[^:]+:[^@]+@/g,
}

export function redactSecrets(text: string): string {
  let clean = text
  for (const [name, pattern] of Object.entries(SECRET_PATTERNS)) {
    clean = clean.replace(pattern, `[REDACTED:${name}]`)
  }
  return clean
}
```

---

## Report Generation

### Extend Existing Reports Namespace

```typescript
// Add to pentest/reports/index.ts or new cyxcode/report.ts

export namespace CyxReport {
  export type Period = "1d" | "7d" | "30d" | "all"

  export type TokenReport = {
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
      top: Array<{ id: string; matches: number; tokensSaved: number }>
    }
    corrections: {
      added: number
      promoted: number
      driftEvents: number
      complianceRate: number
    }
    sessions: number
  }

  export async function generate(period: Period): Promise<TokenReport> {
    // Query from Storage
    const entries = await CyxAudit.list({ since: periodToTimestamp(period) })
    return aggregate(entries)
  }

  export function formatText(report: TokenReport): string { /* ... */ }
  export function formatJSON(report: TokenReport): string { /* ... */ }
  export function formatMarkdown(report: TokenReport): string { /* ... */ }
}
```

---

## CLI Commands

### `cyxcode audit`

```bash
$ cyxcode audit --last 1h

[12:42:15] pattern.match    npm-404           800 tokens saved
[12:43:01] pattern.miss     —                 1,200 tokens used
[12:45:30] correction.added "use bun"         strength=1
[12:48:12] drift.detected   "use bun"         violation: npm install
```

### `cyxcode report`

```bash
$ cyxcode report --last 7d

╭─────────────────────────────────────────────────────────────╮
│  CyxCode Token Report: Mar 21-28, 2026                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TOKEN SAVINGS                                              │
│  ├── Saved:     187,200 tokens ($0.37)                     │
│  ├── Used:       48,600 tokens ($0.10)                     │
│  └── Efficiency: 79.4%                                      │
│                                                             │
│  PATTERNS                           CORRECTIONS             │
│  ├── Matches: 847                   ├── Added:    12        │
│  ├── Misses:  203                   ├── Promoted: 4         │
│  ├── Hit Rate: 80.7%                ├── Drift:    7         │
│  └── Learned: 12                    └── Compliance: 94%     │
│                                                             │
│  TOP PATTERNS                                               │
│  1. npm-404           142 matches    28,400 tokens          │
│  2. git-conflict       98 matches    19,600 tokens          │
│  3. ts-module-error    87 matches    17,400 tokens          │
│                                                             │
╰─────────────────────────────────────────────────────────────╯
```

---

## Integration Points

### Where to Emit Events

| Location | Event | Data |
|----------|-------|------|
| `router.ts` → `route()` | `pattern.match` | patternId, skill, tokensSaved |
| `router.ts` → `route()` | `pattern.miss` | errorOutput (redacted), tokensUsed |
| `learned.ts` → `generatePattern()` | `pattern.learned` | patternId, source |
| `corrections.ts` → `add()` | `correction.added` | correctionId, rule, strength |
| `corrections.ts` → `reinforce()` | `correction.promoted` | correctionId, rule |
| `drift.ts` → `check()` | `drift.detected` | correctionId, violation |
| `drift.ts` → `remind()` | `drift.reminded` | correctionId |
| `memory.ts` → `relevant()` | `memory.loaded` | memoryId, tags, chars |
| `commit.ts` → `autoCommit()` | `commit.created` | hash, trigger |

### Privacy Guard Applied

| Location | What's Redacted |
|----------|-----------------|
| `learned.ts` → before pattern save | Error output in pattern |
| `memory.ts` → before memory save | Memory content |
| `audit.ts` → before event store | All event data fields |

---

## Implementation Plan

| Phase | Task | Effort |
|-------|------|--------|
| 1 | `cyxcode/audit.ts` — CyxAudit namespace using Storage | 1 hr |
| 2 | Privacy guard (redactSecrets) | 30 min |
| 3 | Bus events (CyxEvents namespace) | 30 min |
| 4 | Emit events from router, corrections, drift | 1 hr |
| 5 | `cyxcode/report.ts` — CyxReport namespace | 1 hr |
| 6 | CLI commands (`audit`, `report`) | 1 hr |
| 7 | Auto-prune in `/dream` | 30 min |

**Total: ~5-6 hours** (down from 8-9 with new build)

---

## Benefits of Extending vs New Build

| Aspect | New Build | Extend Existing |
|--------|-----------|-----------------|
| Storage | Custom NDJSON | Existing `Storage` namespace |
| Events | Custom emitter | Existing `Bus` |
| Reports | Custom generator | Extend `Reports` patterns |
| Dashboard | Build new | Add tab to existing |
| Testing | All new tests | Reuse patterns |
| Maintenance | Two systems | One unified system |

---

## Future: Dashboard Integration

Add CyxCode tab to existing security dashboard:

```
http://localhost:4096/dashboard
├── /findings      (existing)
├── /scans         (existing)
├── /compliance    (existing)
├── /reports       (existing)
└── /tokens        (NEW - CyxCode metrics)
```

---

*"Tokens are the new currency. Built on battle-tested infrastructure."*
