# CyxCode State Versioning — Architecture & Implementation

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    USER SESSION                          │
│                                                         │
│  User types message                                     │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────────┐    ┌──────────────┐                   │
│  │ System      │◄───│ State        │ Load HEAD commit  │
│  │ Prompt      │    │ Versioning   │ + corrections     │
│  │ Assembly    │    │ (resume)     │                   │
│  └──────┬──────┘    └──────────────┘                   │
│         │                                               │
│         ▼                                               │
│  ┌─────────────┐                                       │
│  │ LLM Call    │ AI has full context from commit       │
│  └──────┬──────┘                                       │
│         │                                               │
│         ▼                                               │
│  ┌─────────────┐    ┌──────────────┐                   │
│  │ Tool        │───▶│ Correction   │ Detect user       │
│  │ Execution   │    │ Detector     │ corrections       │
│  └──────┬──────┘    └──────┬───────┘                   │
│         │                   │                           │
│         ▼                   ▼                           │
│  ┌─────────────┐    ┌──────────────┐                   │
│  │ Context     │───▶│ Auto-Commit  │ Save state before │
│  │ Compaction  │    │              │ compaction         │
│  └──────┬──────┘    └──────┬───────┘                   │
│         │                   │                           │
│         ▼                   ▼                           │
│  ┌─────────────┐    ┌──────────────┐                   │
│  │ Session     │───▶│ Final Commit │ Save on session   │
│  │ End / Idle  │    │              │ close              │
│  └─────────────┘    └──────────────┘                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
packages/opencode/src/cyxcode/

  versioning/
    index.ts          # Public API: StateVersioning namespace (init, autoCommit, sessionEnd)
    commit.ts         # Commit creation, SHA-256 hashing, HEAD management, epoch archival
    corrections.ts    # Correction CRUD, strength scoring, decay, auto-promotion, detection
    resume.ts         # HEAD loading, system prompt formatting, budget enforcement (300 tokens)
    changelog.ts      # Append-only event log (corrections, commits, drifts, promotions)
    types.ts          # All type definitions (see Type Definitions section below)

  memory.ts           # (existing) Indexed project memory — add strength field
  learned.ts          # (existing) Pattern learning — unchanged
  dream.ts            # (existing) Dream consolidation — add dreamConsolidate()
  router.ts           # (existing) Skill router — unchanged
  index.ts            # (existing) Init — wire StateVersioning.init()

.opencode/
  history/
    HEAD.json         # { hash, timestamp } — pointer to latest commit
    commits/          # Content-hashed state snapshots (max 100, epoch archival)
    corrections/      # Individual correction files (JSON, not .md — structured data)
    changelog.json    # Linear event log [{type, timestamp, data}, ...]
  memory/             # (existing) Indexed project memories
  cyxcode-learned.json  # (existing) Learned error patterns
  cyxcode-stats.json    # (existing) Persisted router stats
```

### Type Definitions (`versioning/types.ts`)

```typescript
// Commit — content-hashed state snapshot
type Commit = {
  hash: string                    // SHA-256 of JSON.stringify(state)
  parent: string | null           // Previous commit hash (linked list)
  timestamp: string               // ISO 8601
  trigger: "compaction" | "session-end" | "manual" | "correction"
  session: {
    slug: string                  // Human-readable session name
    timestamp: string             // Session start time
  }
  state: CommitState
}

type CommitState = {
  goal: string                    // What user is working on
  workingFiles: string[]          // Active file paths
  inProgress: string              // Current task
  completed: string[]             // Done items
  corrections: CorrectionRef[]    // Active corrections (id + strength)
  discoveries: string[]           // What was learned
  activeMemories: string[]        // Memory IDs loaded this session
  activePatterns: string[]        // Learned pattern IDs active
}

// Correction — behavioral rule with strength
type Correction = {
  id: string                      // Content hash of rule text
  rule: string                    // The behavioral instruction
  strength: number                // Reinforcement count (1=new, 3+=auto-promoted)
  created: string                 // ISO 8601
  updated: string                 // Last reinforcement
  source: "explicit" | "heuristic" | "dream"
  promoted: boolean               // true if migrated to AGENTS.md
  decayBase: number               // Session count at last reinforcement (for decay calc)
}

type CorrectionRef = {
  id: string
  strength: number
}

// Changelog — append-only event log
type ChangelogEntry = {
  type: "commit" | "correction" | "correction-reinforced"
      | "drift" | "promotion" | "decay" | "epoch-archive"
  timestamp: string
  data: Record<string, any>       // Event-specific payload
}

// HEAD pointer
type Head = {
  hash: string
  timestamp: string
}

// Epoch — summarized archive of old commits
type EpochCommit = {
  hash: string
  timestamp: string
  range: { from: string; to: string }  // Timestamp range covered
  sessionsCount: number
  corrections: CorrectionRef[]         // Corrections active during this epoch
  summary: string                       // One-line summary of epoch
}
```

---

## Data Flow

### Flow 1: Session Start (Resume)

```
1. initCyxCode() fires
        │
        ▼
2. StateVersioning.init()
   ├── Read HEAD.json → get latest commit hash
   ├── Read commit file → get state snapshot
   └── Load corrections (sorted by strength)
        │
        ▼
3. prompt.ts builds system array (line 680)
   [
     SystemPrompt.environment(),     # env info
     skills,                          # tool descriptions
     StateVersioning.corrections(),   # HIGH PRIORITY corrections
     InstructionPrompt.system(),      # AGENTS.md
     Memory.relevant(msgs),           # project memories
   ]
        │
        ▼
4. LLM receives structured context:
   "You were working on: {goal}
    IMPORTANT corrections:
    - Use /commit skill (corrected 5x, DO NOT use raw git)
    - Keep responses under 3 lines (corrected 2x)
    Active files: auth.ts, middleware.ts
    In progress: Token refresh endpoint"
```

### Flow 2: During Session (Correction Detection)

```
1. User sends message
        │
        ▼
2. Correction detector scans message:
   ├── Explicit: /correct "always use bun, not npm"
   ├── Heuristic: "no, I said...", "don't do that", "stop doing X"
   └── Pattern: User repeats instruction from earlier in session
        │
        ▼
3. If correction detected:
   ├── correction exists? → strength += 1
   └── new correction? → create with strength: 1
        │
        ▼
4. Write to .opencode/history/corrections/{id}.json
   Append to changelog.json
        │
        ▼
5. If strength >= 3:
   └── Auto-promote: inject into system prompt immediately
       (don't wait for next session)
```

### Flow 3: Compaction (Auto-Commit)

```
1. Context overflow detected (compaction.ts:33-49)
        │
        ▼
2. SessionCompaction.create() runs (prompt.ts line 747)
   Summary generated, old tool outputs pruned
        │
        ▼
3. DIRECT CALL from prompt.ts (line 754):
   StateVersioning.autoCommit(sessionID, "compaction")
   ├── Read messages from DB (still available after compaction)
   ├── Extract goal, working files, progress
   ├── Hash state: sha256(JSON.stringify(state))
   ├── If hash === HEAD.hash → skip (no changes)
   └── Write commit, update HEAD, append changelog
        │
        ▼
4. Session continues with compacted context
   Corrections re-injected on next prompt via resume (Phase 4)
```

### Flow 4: Session End (Final Commit)

```
1. Session loop exits (prompt.ts line 832)
   (all prompts processed, model finished)
        │
        ▼
2. DIRECT CALL from prompt.ts (line 834):
   StateVersioning.autoCommit(sessionID, "session-end")
   ├── Read messages from DB
   ├── Extract goal, working files, progress
   ├── Hash and write commit
   └── Append to changelog
        │
        ▼
3. SessionCompaction.prune() runs (existing cleanup)
```

**Why direct calls, not events or hooks:**
- Bus events don't work cross-module (Bun `--conditions=browser` creates separate module instances)
- Plugin hooks can't block compaction (only customize the prompt)
- Direct `await import()` from prompt.ts works reliably — same pattern used for pattern learning and short-circuit

### Flow 5: Dream Integration

```
1. /dream runs or auto-dream on startup
        │
        ▼
2. Dream.run() (existing phases 1-4)
        │
        ▼
3. NEW: Dream reads commit history
   ├── Which corrections were reinforced?
   ├── Which corrections keep drifting?
   ├── Which memories are never accessed?
   └── Session patterns (files always worked together)
        │
        ▼
4. Dream actions:
   ├── Corrections with strength >= 3 → add to AGENTS.md
   ├── Corrections with 0 reinforcement in 10 sessions → decay strength
   ├── Merge duplicate corrections
   └── Archive old commits (keep last 100)
```

---

## Integration Points (Exact Code Locations)

### 1. System Prompt Injection (direct code)
**File:** `packages/opencode/src/session/prompt.ts` line 680

```typescript
// AFTER (with versioning):
const { StateVersioning } = await import("@/cyxcode/versioning")
const system = [
  ...(await SystemPrompt.environment(model)),
  ...(skills ? [skills] : []),
  ...(await StateVersioning.corrections()),    // NEW: high-priority
  ...(await StateVersioning.resume()),         // NEW: context from HEAD
  ...(await InstructionPrompt.system()),
  ...(await Memory.relevant(msgs)),
]
```

No hooks needed — just add to the system array directly.

### 2. Auto-Commit on Compaction (direct call)
**File:** `packages/opencode/src/session/prompt.ts` line 754

```typescript
// Right after SessionCompaction.create() completes:
try {
  const { StateVersioning } = await import("@/cyxcode/versioning")
  await StateVersioning.autoCommit(sessionID, "compaction")
} catch {}
```

### 3. Session End (direct call)
**File:** `packages/opencode/src/session/prompt.ts` line 834

```typescript
// After while(true) loop exits, before SessionCompaction.prune():
try {
  const { StateVersioning } = await import("@/cyxcode/versioning")
  await StateVersioning.autoCommit(sessionID, "session-end")
} catch {}
```

### 4. Correction Detection (direct code, Phase 3)
**File:** `packages/opencode/src/session/prompt.ts` line 304

```typescript
// In the outer loop, after messages are loaded:
// Scan latest user message for corrections (Phase 3: explicit /correct only)
```

### 5. Dream Enhancement (direct code, Phase 7)
**File:** `packages/opencode/src/cyxcode/dream.ts`

```typescript
// In Dream.run(), add after existing phases:
await StateVersioning.dreamConsolidate()
```

### Summary: All Direct Calls from prompt.ts

| Integration | Mechanism | Why? |
|-------------|-----------|---------------|
| System prompt | Direct code in prompt.ts | Just adding to an array |
| Compaction commit | Direct call after `SessionCompaction.create()` in prompt.ts | Bus events don't cross module boundary |
| Session end commit | Direct call after while loop exits in prompt.ts | Same — Bus subscribe in versioning/ never fires |
| Corrections | Direct code in prompt.ts (Phase 3) | Simple text scan in the loop |
| Dream | Direct function call in dream.ts (Phase 7) | Already inside our code |

**Lesson learned:** Bun's `--conditions=browser` flag creates separate module instances. Bus events published in `session/` are never received by subscribers in `cyxcode/`. Direct `await import()` from `prompt.ts` is the only reliable cross-module pattern. This is the same approach used for pattern learning, short-circuit, and memory capture.

---

## Storage Architecture

### Option A: File-based (like memory.ts, learned.ts)
```
.opencode/history/
  HEAD.json                    # { hash: "a7f3b2", timestamp: "..." }
  changelog.json               # [{ type, timestamp, data }, ...]
  commits/
    a7f3b2.json               # Full state snapshot
    c4e1d8.json
  corrections/
    use-commit-skill.json      # { id, rule, strength, created, updated }
    concise-responses.json
```

**Pros:** Simple, portable, human-readable, gitignore-able
**Cons:** No built-in locking (use writeLock pattern)

### Option B: Storage service (packages/opencode/src/storage/storage.ts)
```
~/.opencode/data/storage/
  history/HEAD.json
  history/commits/a7f3b2.json
  history/corrections/use-commit.json
  history/changelog.json
```

**Pros:** Built-in atomic locking, consistent with existing patterns
**Cons:** Global location (not project-specific), harder to inspect

### Recommendation: Option A with writeLock
- Same pattern as `learned.ts` and `memory.ts`
- Project-local (`.opencode/history/`)
- Add `.opencode/history/` to `.gitignore` for privacy
- Use `writeLock` Promise chain for concurrent safety

---

## Use Cases

### Use Case 1: Daily Development
```
Morning: Open CyxCode, type "resume"
→ AI loads: "Yesterday you were building the auth system.
   Completed: login endpoint, password hashing.
   In progress: token refresh. Files: auth.ts, middleware.ts"
→ AI starts with full context. Zero file re-reading.
→ Token savings: ~25K tokens
```

### Use Case 2: Repeated Correction
```
Session 1: "Use bun, not npm" → strength: 1
Session 3: AI uses npm → user corrects → strength: 2
Session 5: AI uses npm again → strength: 3 → AUTO-PROMOTED
Session 6+: AI always uses bun. Never corrected again.
→ Time saved: 5+ corrections × 30 seconds = 2.5 minutes
→ Token savings: 5 × ~100 tokens = ~500 tokens
```

### Use Case 3: Long Session with Compaction
```
Hour 1-3: Working on feature, giving instructions
Hour 4: Context fills → compaction
→ OLD: Corrections lost, user repeats them
→ NEW: Auto-commit before compaction.
   After compaction, corrections re-injected.
   User never notices compaction happened.
→ Token savings: ~2K tokens (corrections) + trust preserved
```

### Use Case 4: Project Handoff
```
Developer A works for a week, builds up corrections + memories.
Developer B takes over:
→ /history shows what A did, what corrections were made
→ /resume loads latest state
→ B starts with A's context
→ No ramp-up time for the AI
```

### Use Case 5: Dream Consolidation
```
After 20 sessions:
→ /dream reads commit history
→ Finds: "use bun" corrected 8 times, auto-promoted
→ Finds: "auth.ts uses bcrypt" accessed 15 times
→ Finds: old correction "use npm" has 0 reinforcement for 15 sessions → decayed
→ Updates AGENTS.md with permanent learnings
→ Archives old commits, keeps last 100
```

### Use Case 6: Multi-Agent (Future)
```
Main agent spawns 3 subagents:
→ Agent A: works on frontend (branch: agent-a)
→ Agent B: works on backend (branch: agent-b)
→ Agent C: runs tests (branch: agent-c)

Each agent commits its discoveries to its branch.
When done: merge all branches into main state.
Dream resolves any conflicts.
```

---

## Workflow: Step by Step

### 1. First Session Ever
```
User starts CyxCode
→ No HEAD.json exists
→ Normal startup (no resume)
→ User works normally
→ User corrects AI: /correct "always use /commit, not raw git"
→ Correction saved: strength 1
→ Session ends → first commit created → HEAD.json points to it
```

### 2. Second Session
```
User starts CyxCode
→ HEAD.json exists → load commit
→ System prompt includes: "CORRECTION (strength 1): always use /commit"
→ AI follows the correction
→ No drift → session ends → new commit (parent: previous)
```

### 3. Tenth Session (Compaction Happens)
```
User working, context fills up
→ Compaction hook fires
→ Auto-commit: save current state (corrections, goal, files)
→ Compaction runs (old messages pruned)
→ Corrections survive (they're in the commit, re-injected)
→ Session continues seamlessly
```

### 4. Twentieth Session (Dream Runs)
```
Auto-dream on startup:
→ Read all commits (20 entries)
→ Corrections with strength >= 3: promote to AGENTS.md
→ Corrections with no reinforcement: decay strength
→ Archive commits older than 100
→ Report: "Promoted 2 corrections, decayed 1, archived 10 commits"
```

---

## Token Budget

### System Prompt Allocation
```
Total system prompt budget: variable (depends on model context)
Typical allocation:

Environment info:     ~100 tokens (fixed)
Skills:               ~200 tokens (fixed)
Corrections:          ~300 tokens (max budget, sorted by strength)
Resume context:       ~200 tokens (goal, files, progress)
AGENTS.md:            ~500 tokens (varies)
Project memory:       ~500 tokens (max budget, relevance-loaded)
────────────────────────────────────────
Total:                ~1,800 tokens (~2% of 128K context)
```

### Budget Caps
| Component | Max tokens | Priority |
|-----------|-----------|----------|
| Corrections (strength >= 3) | 300 | Highest (loaded first) |
| Resume context (HEAD) | 200 | High |
| AGENTS.md instructions | 500 | Medium |
| Project memories | 500 | Lower |

Corrections always load first. If budget is tight, memories get trimmed.

---

## Error Handling

| Scenario | Handling |
|----------|---------|
| HEAD.json corrupt | Fall back to no-resume (fresh session) |
| Commit file missing | Skip, use parent commit |
| Correction file corrupt | Skip that correction |
| Hash mismatch | Recalculate hash, update HEAD |
| Write fails (disk full) | Log warning, continue without commit |
| Compaction races with commit | writeLock ensures sequential execution |
| Multiple sessions same project | Each session has its own commit chain |

---

## Files to Create

| File | Purpose | Lines (est) |
|------|---------|-------------|
| `src/cyxcode/versioning/index.ts` | Public API: init, corrections, resume, autoCommit, sessionEnd | ~50 |
| `src/cyxcode/versioning/commit.ts` | Commit creation, hashing, HEAD management | ~120 |
| `src/cyxcode/versioning/corrections.ts` | Correction CRUD, strength, detection, promotion | ~150 |
| `src/cyxcode/versioning/resume.ts` | Load HEAD, format for system prompt | ~80 |
| `src/cyxcode/versioning/changelog.ts` | Append-only event log | ~40 |
| `src/cyxcode/versioning/types.ts` | All type definitions | ~50 |

## Files to Modify

| File | Change | Lines (est) |
|------|--------|-------------|
| `src/session/prompt.ts` | Add corrections + resume to system array | ~5 |
| `src/session/prompt.ts` | Add correction detection in outer loop | ~5 |
| `src/cyxcode/index.ts` | Wire StateVersioning.init() | ~3 |
| `src/cyxcode/dream.ts` | Add dreamConsolidate() call | ~5 |
| `.gitignore` | Add .opencode/history/ | ~1 |

**Not modified:** `compaction.ts`, `status.ts`, `plugin/` — we use Bus events, no code changes needed in those files.

---

## Design Decisions

### 1. Direct Calls — No Events, No Hooks

We tried three approaches in order:

1. **Plugin hooks** — Can't block compaction, only customize prompt. Rejected.
2. **Bus events** — `Bus.subscribe()` in `cyxcode/` never receives events from `session/` due to Bun `--conditions=browser` creating separate module instances. Rejected after testing.
3. **Direct calls** — `await import("@/cyxcode/versioning")` from `prompt.ts`. Works reliably. **Accepted.**

```
Compaction runs (tool outputs pruned)
  → Direct call: StateVersioning.autoCommit(sessionID, "compaction")
  → Read messages from DB, save commit

Session loop exits
  → Direct call: StateVersioning.autoCommit(sessionID, "session-end")
  → Read messages from DB, save commit
```

This is the same pattern used for CyxCode's pattern learning, LLM short-circuit, and memory capture. All cross-module integration goes through direct `await import()` from `prompt.ts`.

### 2. Corrections vs Memories — How They Interact

Corrections and memories are **separate systems** with different purposes:

| | Corrections | Memories |
|--|------------|---------|
| **What** | Behavioral rules ("use /commit") | Knowledge ("auth.ts uses bcrypt") |
| **Priority** | High — loaded first in system prompt | Lower — loaded by relevance |
| **Strength** | Increases with reinforcement | Access count only |
| **Promotion** | Auto-promoted to AGENTS.md at strength 3 | Never auto-promoted |
| **Decay** | -1 per 10 sessions without reinforcement | Pruned after 30 days < 3 accesses |
| **Detection** | User corrections ("no, don't do that") | Compaction discoveries, /remember |
| **Storage** | `.opencode/history/corrections/` | `.opencode/memory/` |
| **Budget** | 300 tokens max | 500 tokens max |

**They don't overlap.** A correction tells the AI HOW to behave. A memory tells the AI WHAT it knows. Both load into the system prompt but in different positions:

```
System prompt order:
  1. Environment (fixed)
  2. Skills (fixed)
  3. CORRECTIONS (behavioral rules — highest priority)
  4. RESUME CONTEXT (goal, progress, files)
  5. AGENTS.md (permanent instructions)
  6. MEMORIES (project knowledge — relevance loaded)
```

### 3. Storage: File-based with writeLock (Final Decision)

**Chosen: File-based (Option A)**

Reasons:
- Consistent with `memory.ts`, `learned.ts`, `dream.ts` patterns
- Project-local — lives in `.opencode/history/`
- Human-readable — can inspect commits and corrections manually
- Gitignore-able — private by default
- Portable — copy `.opencode/` to move project context

**Not using Storage service** because:
- Storage service writes to global `~/.opencode/data/` — not project-specific
- History should live WITH the project, not in a global directory
- If user switches machines, project history should travel with the repo (or be gitignored for privacy)

### 4. Session Identification

Each commit needs to know which session it belongs to. But `sessionID` is internal to the database.

**Decision:** Commits reference sessions by timestamp + slug, not raw sessionID. This makes commits human-readable:

```json
{
  "hash": "a7f3b2",
  "session": {
    "slug": "auth-jwt-implementation",
    "timestamp": "2026-03-27T10:00:00Z"
  }
}
```

### 5. Correction Detection Strategy

Phase 1: **Explicit only** — user runs `/correct "rule"`
Phase 2: **Heuristic detection** — scan for correction patterns in user messages

Heuristic signals (Phase 2):
- Message starts with "no", "don't", "stop", "I said", "I told you"
- Message contains "not X, use Y" pattern
- Message repeats an instruction from earlier in the session
- User follows AI action with immediate correction

**Conservative threshold:** Only flag as correction if 2+ signals match. Better to miss than false-flag.

---

## Testing Strategy

Unit tests exist for the existing CyxCode systems (added from other PC):
- Skill system tests
- Memory system tests
- Dream system tests

### Tests to Add for State Versioning

| Test | What it verifies |
|------|-----------------|
| `commit.test.ts` | Commit creation, hashing, HEAD update, parent chain |
| `corrections.test.ts` | CRUD, strength increment, decay, auto-promotion threshold |
| `resume.test.ts` | HEAD loading, system prompt formatting, missing HEAD fallback |
| `changelog.test.ts` | Append-only log, event ordering |
| `integration.test.ts` | Full flow: correction → commit → resume → drift → promotion |

### Test approach
- Mock file system for unit tests (no disk I/O)
- Integration tests use temp directory
- Test correction detection heuristics with sample messages
- Test strength decay across simulated sessions
- Test compaction hook ordering (commit before compaction)

---

## Security & Privacy

| Concern | Mitigation |
|---------|-----------|
| Corrections may contain sensitive info | Store locally only, add to .gitignore |
| Commit history reveals work patterns | Never sent to remote, never included in LLM context as raw data |
| Corrections injected into system prompt | Only the rule text, not the full context of when it was made |
| State files readable by other users on shared machine | Follow OS file permissions (user-only read/write) |
| Large commit history | Auto-archive: keep last 100 commits, summarize older into epoch commits |

---

## Migration Path

For users upgrading from CyxCode without versioning:

1. **No migration needed** — system starts fresh if no `.opencode/history/` exists
2. **Existing memories preserved** — `.opencode/memory/` untouched
3. **Existing learned patterns preserved** — `.opencode/cyxcode-learned.json` untouched
4. **Existing AGENTS.md preserved** — versioning only adds to it, never removes
5. **First session creates first commit** — HEAD.json created on first session end

---

## Strength Decay Mechanics

Corrections shouldn't live forever if they're no longer relevant. Strength decays over time without reinforcement.

```
Decay formula:
  effective_strength = strength - floor((current_session - decayBase) / 10)

  Where:
    strength    = raw reinforcement count
    decayBase   = session count at last reinforcement
    10          = sessions per decay tick

Example:
  Correction "use npm" created at session 5, strength 3
  Session 15: effective = 3 - floor((15-5)/10) = 3 - 1 = 2
  Session 25: effective = 3 - floor((25-5)/10) = 3 - 2 = 1
  Session 35: effective = 3 - floor((35-5)/10) = 3 - 3 = 0 → REMOVED

  But if reinforced at session 20:
    strength = 4, decayBase = 20
  Session 30: effective = 4 - floor((30-20)/10) = 4 - 1 = 3 → still strong
```

**When decay runs:**
- During `Dream.dreamConsolidate()` (startup auto-dream)
- Each correction checked: if effective_strength <= 0, archived to changelog and removed

**Promoted corrections (in AGENTS.md) don't decay.** Once promoted, they're permanent.

---

## Epoch Archival

When commits exceed 100, old commits are summarized into epoch commits:

```
Before archival:
  commits/a1.json (session 1)
  commits/a2.json (session 2)
  ...
  commits/a90.json (session 90)
  commits/a100.json (session 100)  ← HEAD
  commits/a101.json (session 101)  ← NEW → triggers archival

After archival:
  commits/epoch-1-to-50.json      ← summarizes sessions 1-50
  commits/a51.json (session 51)
  ...
  commits/a101.json (session 101)  ← HEAD

Epoch commit structure:
{
  "hash": "epoch-abc123",
  "type": "epoch",
  "range": { "from": "2026-03-01", "to": "2026-03-15" },
  "sessionsCount": 50,
  "corrections": [{ "id": "use-commit", "strength": 5 }],
  "summary": "50 sessions, 3 corrections active, auth system built"
}
```

**Epoch archival runs during Dream consolidation**, not during normal commits.

---

## How Auto-Commit is Triggered

All triggers are **direct calls from `prompt.ts`** — no Bus events, no hooks, no plugins.

```typescript
// prompt.ts — after compaction (line 754):
const { StateVersioning } = await import("@/cyxcode/versioning")
await StateVersioning.autoCommit(sessionID, "compaction")

// prompt.ts — after session loop exits (line 834):
const { StateVersioning } = await import("@/cyxcode/versioning")
await StateVersioning.autoCommit(sessionID, "session-end")
```

**Why not Bus events?** Bun's `--conditions=browser` creates separate module instances. `Bus.subscribe()` in `cyxcode/versioning/` never receives events published from `session/`. This is a known limitation — pattern learning and memory capture also use direct calls for the same reason.

**Why not hooks?** The `experimental.session.compacting` plugin hook can't block compaction and the payload only allows customizing the prompt text.

**No changes needed** to `compaction.ts`, `status.ts`, or `plugin/`.

---

## `/history` Command Design

The `/history` command shows the commit log in a human-readable format:

```markdown
---
description: Show CyxCode state versioning history
---

Read `.opencode/history/changelog.json` and `.opencode/history/HEAD.json`.

Display the last 20 events in reverse chronological order as a table:

| Time | Event | Details |
|------|-------|---------|
| (timestamp) | (type) | (summary) |

Event types:
- commit: "State committed (trigger: compaction/session-end)"
- correction: "Correction added: {rule} (strength: {n})"
- correction-reinforced: "Correction reinforced: {rule} (strength: {n-1} → {n})"
- drift: "Drift detected: {rule} not followed"
- promotion: "Correction promoted to AGENTS.md: {rule}"
- decay: "Correction decayed: {rule} (strength: {n} → {n-1})"
- epoch-archive: "Archived {n} old commits into epoch"

Also show current HEAD:
- Hash: {hash}
- Session: {slug}
- Active corrections: {count} ({list of rules with strengths})
- Last dream: {timestamp}

$ARGUMENTS
```

---

## Cross-Reference: Design Doc vs Architecture Doc

| Topic | STATE-VERSIONING.md | STATE-VERSIONING-ARCHITECTURE.md |
|-------|--------------------|---------------------------------|
| Problem statement | Full narrative | Referenced |
| Git comparison table | Full table | Full table + what we add |
| Risk mitigations | 10 scenarios | 10 scenarios + error handling matrix |
| Commit structure | JSON example | JSON example + TypeScript types |
| Flow diagrams | 4 flows | 5 flows + system overview |
| Integration points | High level | Exact file paths + line numbers |
| Correction lifecycle | Flow diagram | Flow diagram + strength decay formula |
| Epoch archival | Mentioned in risk #1 | Full section with structure |
| Token budget | Savings table | Savings table + allocation breakdown |
| Testing strategy | Not covered | Full test plan |
| Security/privacy | Risk #10 | Full section |
| Migration path | Not covered | Full section |
| Plugin registration | Not covered | Full code example |
| /history command | Listed in commands | Full .md command design |
| Storage decision | Not decided | Decided: file-based with writeLock |
| Corrections vs memories | Not covered | Full comparison table |
| Type definitions | Inline JSON | Full TypeScript types |

---

## CyxCode Dream vs Claude Code AutoDream

Claude Code introduced AutoDream — a memory consolidation feature. Understanding how it works helps us see what we can draw from and where we go further.

### How Claude Code AutoDream Works

```
AutoDream (Claude Code):
  Trigger: Cron (3 AM daily) or hook (every 5 sessions + 24hr gap)
  Agent:   Spawns a subagent with LLM
  Phases:  Orient → Gather Signal → Consolidate → Prune Index
  Cost:    Uses LLM tokens (agent reads/writes memory files)
  Scope:   Memory files only (MEMORY.md, per-project memories)
  Result:  Cleaner MEMORY.md, deduplicated entries, resolved contradictions
```

### How CyxCode Dream Works (Current)

```
CyxCode Dream (current):
  Trigger: Auto on startup (phases 1-4) or manual /dream (phase 5)
  Agent:   Phases 1-4 are CODE-ONLY (no LLM). Phase 5 uses LLM.
  Phases:  Deduplicate → Validate → Persist Stats → (AI Consolidate)
  Cost:    Phases 1-4 = FREE (zero tokens). Phase 5 = tokens.
  Scope:   Memories + learned patterns + router stats
  Result:  Deduped patterns, validated files, persisted stats
```

### Comparison

| | Claude AutoDream | CyxCode Dream | CyxCode Dream + State Versioning |
|--|-----------------|---------------|----------------------------------|
| **Trigger** | Cron / session count | Startup / manual | Startup + compaction + session end |
| **Cost** | Always costs tokens (uses LLM) | Phases 1-4 free, phase 5 costs | Same — phases 1-4 free |
| **Tracks corrections** | No | No (currently) | **Yes — strength scoring** |
| **Tracks drift** | No | No | **Yes — behavioral drift detection** |
| **Persists across sessions** | Memory files only | Stats + patterns | **Full state commits with history** |
| **Resume** | No resume concept | No resume (currently) | **Yes — HEAD commit loaded on start** |
| **Archival** | Prunes old entries | Prunes by age/access | **Epoch commits summarize history** |
| **Multi-agent** | No | No | **TODO: branching per agent** |

### What We Draw From AutoDream

1. **The 4-phase concept is proven** — Orient, Gather, Consolidate, Prune works. We use the same structure.
2. **Session count trigger** — AutoDream triggers after 5 sessions. We should track `sessions` in stats and trigger deeper consolidation at thresholds.
3. **MEMORY.md index under 200 lines** — AutoDream enforces a lean index. We enforce via MAX_ENTRIES (200) and MAX_LOAD_CHARS (2000).

### Where We Go Further

1. **Free by default** — AutoDream always uses LLM tokens. Our phases 1-4 are code-based, zero cost. LLM is optional (phase 5 / `/dream` command).
2. **Correction tracking** — AutoDream doesn't know WHAT the user corrected. It just sees messy memory files. We track corrections with strength, decay, and auto-promotion.
3. **State versioning** — AutoDream has no history. It reads current memory, cleans it, writes it back. We maintain a commit chain — you can see what the AI knew at any point in time.
4. **Resume** — AutoDream doesn't help with session continuity. Our HEAD commit lets the AI pick up exactly where it left off.
5. **Drift detection** — AutoDream can't detect behavioral regression. Our system compares current behavior against committed corrections.
6. **Compaction-safe** — AutoDream runs independently of compaction. We hook into compaction directly — auto-commit before context is pruned, corrections re-injected after.

### How State Versioning Enhances Dream

```
Current Dream flow:
  Startup → Dedup → Validate → Persist Stats → Done

Enhanced Dream flow with State Versioning:
  Startup → Dedup → Validate → Persist Stats
    → Read commit history
    → Check correction strengths (apply decay)
    → Detect behavioral drift (compare last sessions)
    → Auto-promote corrections (strength >= 3 → AGENTS.md)
    → Archive old commits (> 100 → epoch)
    → Report: "Promoted 2 corrections, decayed 1, 3 drifts detected"
```

Dream becomes the **garbage collector + optimizer** for the versioning system:
- **Dream reads commits** to understand what changed over time
- **Dream applies decay** to unused corrections
- **Dream archives** old commits into epochs
- **Dream promotes** high-strength corrections to permanent instructions
- **Dream detects** patterns in drift (same correction drifts every 10 sessions → maybe it needs a different approach)

### Synchronous vs Asynchronous

| | Claude AutoDream | CyxCode Dream |
|--|-----------------|---------------|
| **Execution** | Async — spawns background agent | Sync — runs in process |
| **Blocking** | No — runs at 3 AM or background | Auto-dream blocks startup briefly |
| **LLM dependency** | Required — agent does all work | Optional — code handles 80% |
| **Failure mode** | Agent fails → nothing cleaned | Code phases never fail (try/catch) |
| **Auditability** | Agent writes changes, hard to review | Code changes are deterministic |

**Our approach is more robust because:**
- Synchronous code can't hallucinate (no LLM involved in phases 1-4)
- Deterministic dedup/validation — same input always produces same output
- No background agent that might modify files unexpectedly
- Phase 5 (LLM) is explicit — user triggers `/dream`, sees what changes

**But we could add async capabilities for:**
- Session-count triggered deep consolidation (like AutoDream's 5-session trigger)
- Background epoch archival (non-blocking, runs after startup completes)
- Scheduled correction decay (daily, not just on startup)
