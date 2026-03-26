# CyxCode State Versioning System

*Git for AI state — commits, history, corrections, resume.*

---

## The Problem

AI coding tools have amnesia. Every session starts from zero. Every compaction loses nuance. Every correction is temporary.

### What happens today:

```
Hour 1:   "Use /commit skill, not raw git"     -> AI follows
Hour 3:   Context compacted                     -> Instruction lost
Hour 4:   AI uses raw git                       -> User corrects again
Hour 8:   Context compacted again               -> Lost again
Day 2:    New session                           -> No memory at all
Day 3:    Same correction for the 5th time      -> User frustrated
```

**The cost:**
- **User time** — repeating the same corrections
- **Tokens** — AI re-reads files, re-discovers architecture, re-learns preferences
- **Quality** — AI behavior degrades over long sessions and across sessions
- **Trust** — Users stop giving nuanced instructions because "it'll forget anyway"

### Why existing solutions fail:

| Solution | Why it fails |
|----------|-------------|
| AGENTS.md | Manual, one big file, no priority, no history |
| Memory files | Flat, no versioning, equal weight for all entries |
| Compaction summaries | Lossy, corrections lost, generated once then discarded |
| Chat history | Too large to reload, no structure, no prioritization |

---

## The Idea

**Git for AI state.** Not actual git — but the same principles applied to AI knowledge:

| Git Principle | AI Application |
|---------------|---------------|
| **Commits** | Snapshot AI state at key moments (compaction, session end) |
| **Hash** | Content-addressed storage — identical knowledge stored once |
| **Log** | History of what AI learned, when, and from what source |
| **HEAD** | Latest known state — loaded on session start |
| **Diff** | Detect what changed between sessions, what was lost (drift) |
| **Refs** | Strength scores — how many times a correction was reinforced |

### What we DON'T need (yet):
- Remote/fetch (single machine)
- Rebase (linear history is fine for now)

### TODO — Future considerations:
- **Branching** — Multi-agent / subagent workflows (Claude Code supports parallel agents via worktrees). Each agent could have its own branch of state, merged when the task completes.
- **Merging** — When parallel agents finish, merge their discoveries and corrections back into the main state. Dream consolidation could handle conflict resolution.

---

## The Solution

### Architecture

```
.opencode/history/
  HEAD.json                        # Pointer to latest commit
  commits/
    a7f3b2.json                    # State snapshot (content-hashed)
    c4e1d8.json
    f9a2b1.json
  corrections/
    use-commit-skill.md            # strength: 5, auto-promoted
    concise-responses.md           # strength: 3
  changelog.json                   # Linear log of all events
```

### Commit Structure (content-hashed)

```json
{
  "hash": "a7f3b2",
  "parent": "c4e1d8",
  "timestamp": "2026-03-27T10:00:00Z",
  "trigger": "compaction",
  "state": {
    "goal": "Building auth system with JWT",
    "workingFiles": ["src/auth.ts", "src/middleware.ts"],
    "inProgress": "Token refresh endpoint",
    "completed": ["Login endpoint", "Password hashing"],
    "corrections": [
      { "id": "use-commit", "rule": "Use /commit, not raw git", "strength": 5 },
      { "id": "concise", "rule": "Keep responses under 3 lines", "strength": 2 }
    ],
    "discoveries": [
      "auth.ts uses JWT with bcrypt, middleware at line 50",
      "globalThis needed for cross-module state in Bun"
    ],
    "activeMemories": ["auth-jwt", "bun-avx2"],
    "activePatterns": ["python-module-not-found", "learned-npm-404"]
  }
}
```

### How Hashing Saves Space

Same principle as git — content-addressed storage:

```
Commit 1: { goal: "Building auth", corrections: [...], discoveries: [...] }
           hash = sha256(content) -> a7f3b2

Commit 2: Only "inProgress" changed
           hash = sha256(content) -> c4e1d8
           But corrections[] and discoveries[] are identical
           -> Referenced, not duplicated

Commit 3: Same corrections reinforced (strength increased)
           -> Only the changed fields stored in diff format
```

**Storage estimate:**
- Each commit: ~500 bytes (JSON, compressed references)
- 100 commits (months of usage): ~50KB total
- Compare to: chat history for one session = 500KB+

---

## How It Saves Tokens

| Scenario | Without Versioning | With Versioning | Savings |
|----------|-------------------|-----------------|---------|
| New session, resume work | AI reads 50 files (~25K tokens) | Load HEAD commit (~200 tokens) | **99%** |
| After compaction | Corrections lost, user repeats (~500 tokens each) | Corrections re-injected (0 tokens) | **100%** |
| 5th correction of same thing | User types it again (50 tokens x 5) | Auto-promoted, never lost (0 tokens) | **100%** |
| Dream consolidation | Reads all files to understand state (~5K tokens) | Reads structured commit (~200 tokens) | **96%** |

**Over a month (100 sessions):**
- Without: ~2.5M tokens on re-discovery
- With: ~20K tokens on state loading
- **Savings: ~98%**

---

## How It Helps the LLM

1. **Better context** — Instead of raw files dumped into prompt, LLM gets structured state:
   - "You were working on X"
   - "User corrected you 3 times about Y"
   - "Files A, B, C are the active ones"

2. **Priority awareness** — Corrections with strength 5 are more important than strength 1. LLM knows what NOT to get wrong.

3. **Continuity** — "Resume" doesn't mean "start over." It means "here's exactly where we left off, including what you've been corrected on."

4. **Less hallucination** — With structured state, LLM doesn't guess about the project. It knows.

5. **Compaction becomes safe** — Compaction currently loses nuance. With auto-commit before compaction, nothing is truly lost. The summary can be lossy because the commit preserves everything.

---

## Why We Think It Works

### 1. Git proved this model works for code
Files change frequently, history matters, space efficiency through hashing. The same applies to AI state.

### 2. Correction reinforcement maps to human learning
Humans remember things they're corrected on repeatedly. AI should too. Strength scoring is essentially spaced repetition for AI.

### 3. Small structured data > large unstructured data
A 200-token structured commit loads faster, costs less, and gives better context than a 25K-token file dump.

### 4. We already have the building blocks
- Memory system (storage + indexing)
- Dream system (consolidation)
- Compaction hooks (trigger points)
- Pattern learning (correction -> pattern pipeline)
- Router stats (usage tracking)

We're connecting existing pieces, not building from scratch.

### 5. Auto-promotion eliminates the maintenance burden
Users don't maintain AGENTS.md. The system observes what keeps getting corrected and promotes it automatically. Zero manual work after the initial correction.

---

## What Changes After Implementation

### For the user:
- **Never repeat a correction more than twice** — auto-promoted after 3x
- **"Resume" actually works** — AI picks up exactly where it left off
- **Compaction is invisible** — corrections survive, context preserved
- **Dream is smarter** — uses correction history for better consolidation
- **Trust improves** — AI behavior is consistent across sessions

### For the AI:
- **Structured context on startup** — knows goal, files, corrections, progress
- **Priority-weighted instructions** — strength 5 corrections loaded first
- **Drift self-correction** — detects when it stops following a learned behavior
- **Less re-reading** — state loaded from commit, not from re-scanning files

### For token costs:
- **~98% reduction in re-discovery tokens** across sessions
- **Zero tokens wasted on repeated corrections** after auto-promotion
- **Compaction no longer costly** — pre-commit preserves everything
- **Dream consolidation cheaper** — reads structured commits, not raw files

---

## Integration with Existing CyxCode Systems

```
                    CyxCode State Versioning
                           |
        +------------------+------------------+
        |                  |                  |
    Corrections       Auto-Commit          Resume
    (strength)      (compaction hook)    (session start)
        |                  |                  |
        v                  v                  v
  +-----------+      +-----------+      +-----------+
  |  Memory   |      |   Dream   |      |  Prompt   |
  | (indexed) |      | (consol.) |      | (system)  |
  +-----------+      +-----------+      +-----------+
        |                  |                  |
  Memories get       Dream reads          HEAD commit
  strength field     commit history       injected into
  from corrections   for smarter          system prompt
                     consolidation        on session start
```

---

## Correction Lifecycle

```
User corrects AI: "Use /commit skill, not raw git"
                |
                v
  Correction saved, strength: 1
  Stored in .opencode/history/corrections/
                |
                v
  AI drifts, user corrects again
  strength: 2
                |
                v
  Third correction -> strength: 3
  AUTO-PROMOTED to system prompt (high priority)
                |
                v
  /dream detects 3x correction
  Adds to AGENTS.md permanently
  strength: permanent
                |
                v
  AI never forgets this again
```

---

## Auto-Commit Triggers

| Trigger | When | What's saved |
|---------|------|-------------|
| **Compaction** | Context window fills up | Full state before compaction (nothing lost) |
| **Session end** | User closes TUI | Goal, progress, corrections, working files |
| **Manual** | User runs `/commit-state` | Current state snapshot |
| **Correction** | User corrects AI behavior | Correction + reinforcement |

---

## Commands

| Command | Description |
|---------|-------------|
| `/resume` | Load HEAD commit, restore context |
| `/history` | Show commit log (what AI learned, when) |
| `/correct <rule>` | Explicitly save a behavioral correction |
| `/dream` | Consolidate + promote high-strength corrections |

---

## Implementation Phases

| Phase | Description | Depends on |
|-------|-------------|------------|
| 1 | Commit/HEAD/changelog storage layer | — |
| 2 | Auto-commit on compaction hook | Phase 1 |
| 3 | Correction tracking with strength | Phase 1 |
| 4 | Resume: load HEAD into system prompt | Phase 1 |
| 5 | Drift detection | Phase 3 |
| 6 | Auto-promotion to AGENTS.md | Phase 3, 5 |
| 7 | Dream integration | Phase 1, 3 |
