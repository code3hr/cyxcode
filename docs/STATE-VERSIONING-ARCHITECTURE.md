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
    index.ts          # Public API: StateVersioning namespace
    commit.ts         # Commit creation, hashing, storage
    corrections.ts    # Correction tracking, strength, detection
    resume.ts         # HEAD loading, system prompt injection
    changelog.ts      # Linear event log
    types.ts          # All type definitions

  memory.ts           # (existing) Indexed project memory
  learned.ts          # (existing) Pattern learning
  dream.ts            # (existing) Dream consolidation — enhanced
  router.ts           # (existing) Skill router — enhanced
  index.ts            # (existing) Init — wire versioning
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
2. Hook: "experimental.session.compacting" fires (line 169)
        │
        ▼
3. StateVersioning.autoCommit(sessionID, messages):
   ├── Extract goal from recent user messages
   ├── Extract working files from tool calls (read/edit)
   ├── Extract progress (completed/in-progress)
   ├── Collect active corrections with strengths
   ├── Collect active memories
   ├── Collect active learned patterns
   ├── Hash the state: sha256(JSON.stringify(state))
   ├── If hash === HEAD.hash → skip (no changes)
   └── Write commit, update HEAD, append changelog
        │
        ▼
4. Compaction proceeds (existing behavior)
   Summary generated, old messages pruned
        │
        ▼
5. After compaction:
   Corrections re-injected via system prompt
   (they were committed, so they survive compaction)
```

### Flow 4: Session End (Final Commit)

```
1. SessionStatus.Event.Idle fires (or user closes TUI)
        │
        ▼
2. StateVersioning.sessionEnd(sessionID):
   ├── Same commit logic as autoCommit
   ├── Additionally: persist dream stats
   └── Run drift detection (compare behavior vs corrections)
        │
        ▼
3. Drift detected?
   ├── No → done
   └── Yes → increment correction strength
             Log drift event in changelog
```

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

### 1. System Prompt Injection
**File:** `packages/opencode/src/session/prompt.ts` line 680

```typescript
// BEFORE (current):
const system = [
  ...(await SystemPrompt.environment(model)),
  ...(skills ? [skills] : []),
  ...(await InstructionPrompt.system()),
  ...(await Memory.relevant(msgs)),
]

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

### 2. Compaction Hook (Auto-Commit)
**File:** `packages/opencode/src/session/compaction.ts` line 169

```typescript
// BEFORE (current):
const compacting = await Plugin.trigger(
  "experimental.session.compacting",
  { sessionID: input.sessionID },
  { context: [], prompt: undefined },
)

// Our hook subscribes to this event in versioning/index.ts:
// Plugin system calls our hook BEFORE compaction runs
// We commit state inside the hook
```

### 3. Session End Hook
**File:** `packages/opencode/src/session/prompt.ts` line 735-776

```typescript
// After processor.process() returns and session is complete:
// Hook into the "stop" path at line 735:
if (result === "stop") {
  // NEW: auto-commit on session end
  await StateVersioning.sessionEnd(sessionID, msgs)
  break
}
```

### 4. Correction Detection
**File:** `packages/opencode/src/session/prompt.ts` line 304

```typescript
// In the outer loop, after user message is received:
let msgs = await MessageV2.filterCompacted(MessageV2.stream(sessionID))
// NEW: scan latest user message for corrections
await StateVersioning.detectCorrection(msgs)
```

### 5. Dream Enhancement
**File:** `packages/opencode/src/cyxcode/dream.ts`

```typescript
// In Dream.run(), add after existing phases:
// Phase 5: Correction consolidation
await StateVersioning.dreamConsolidate()
```

### 6. Init Wiring
**File:** `packages/opencode/src/cyxcode/index.ts`

```typescript
// In initCyxCode(), add:
import("./versioning").then(({ StateVersioning }) => {
  StateVersioning.init()
}).catch(() => {})
```

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
| `src/session/prompt.ts` | Add auto-commit on session stop | ~3 |
| `src/cyxcode/index.ts` | Wire StateVersioning.init() | ~3 |
| `src/cyxcode/dream.ts` | Add dreamConsolidate() call | ~5 |
| `.gitignore` | Add .opencode/history/ | ~1 |
