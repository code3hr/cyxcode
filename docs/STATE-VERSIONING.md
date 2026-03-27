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

---

## How Git Works vs How We Work

| Git | CyxCode State Versioning | Difference |
|-----|-------------------------|------------|
| `git add` + `git commit` | Auto-commit on compaction/session end | No manual staging — state captured automatically |
| `git log` | `changelog.json` — linear event log | Simpler — no branching graph (yet) |
| `git checkout` | `/resume` — load HEAD into system prompt | Loads knowledge, not files |
| `git diff` | Compare HEAD vs current behavior | Detects *behavioral* drift, not file changes |
| `git stash` | Pre-compaction save | Automatic — user never runs this |
| `git hash-object` | `sha256(JSON.stringify(state))` | Same concept — content-addressed |
| `HEAD` pointer | `HEAD.json` → latest commit hash | Same concept |
| `parent` chain | Commit has `parent` field linking to previous | Same concept — linked list of states |
| `.gitignore` | Ephemeral data (current tool outputs) not committed | Only persistent knowledge saved |
| `git branch` | TODO: per-agent state branches | Future — for multi-agent workflows |
| `git merge` | TODO: merge agent discoveries back to main | Future — dream handles conflict resolution |
| `git tag` | Milestone markers ("finished auth feature") | Future — optional |

### What git does that we DON'T do:
- **Staging area** — unnecessary, we auto-capture everything relevant
- **Remote/push/pull** — single machine, no collaboration on AI state
- **Rebase/cherry-pick** — linear history is sufficient
- **Conflict markers** — dream consolidation resolves conflicts automatically

### What we do that git DOESN'T:
- **Strength scoring** — corrections get stronger with repetition
- **Auto-promotion** — high-strength corrections become permanent instructions
- **Drift detection** — compare behavior against committed state
- **Relevance loading** — only load what matches current context
- **Decay/pruning** — old unused state automatically cleaned up

---

## What Could Go Wrong

### 1. Commit bloat
**Risk**: Too many commits accumulate, slow to read index.
**Mitigation**: Cap at 100 commits. Old commits garbage-collected by dream. Only HEAD + last 10 commits kept, older ones summarized into a single "epoch" commit.

### 2. False correction detection
**Risk**: System thinks user is correcting AI when they're just giving new instructions.
**Mitigation**: Only track explicit corrections via `/correct` command initially. Phase 2 adds heuristic detection (user says "no", "don't", "stop", "I said" → likely correction). Conservative threshold — better to miss a correction than false-flag one.

### 3. Stale corrections blocking good behavior
**Risk**: AI was corrected to "use npm" but project switched to bun. Old correction now harmful.
**Mitigation**: Corrections have timestamps. Dream checks if correction conflicts with recent behavior (used bun successfully in last 5 sessions → correction is stale). Strength decays if not reinforced (strength -1 per 10 sessions without reinforcement).

### 4. Resume loads wrong context
**Risk**: User starts working on something completely different, but HEAD commit has old project context.
**Mitigation**: `/resume` is explicit — user chooses to load. On new sessions, only high-strength corrections auto-load (behavioral rules like "use /commit"), not project-specific context (like "working on auth.ts"). Memory system handles project-specific relevance loading separately.

### 5. Concurrent writes from multiple agents
**Risk**: Two subagents try to commit state simultaneously.
**Mitigation**: Same `writeLock` promise chain pattern used everywhere in CyxCode (learned.ts, memory.ts, dream.ts). Future branching (TODO) will give each agent its own branch.

### 6. Compaction fires before auto-commit completes
**Risk**: Compaction deletes context before we save it.
**Mitigation**: Hook into `experimental.session.compacting` (fires BEFORE compaction, not after). Auto-commit runs synchronously in the hook, blocking compaction until state is saved.

### 7. System prompt bloat from too many corrections
**Risk**: 50 corrections loaded = too many tokens in system prompt.
**Mitigation**: Budget cap — max 500 tokens of corrections loaded. Sorted by strength (highest first). Low-strength corrections only loaded if budget remains. Auto-promoted corrections (strength: permanent) move to AGENTS.md and stop counting against the budget.

### 8. Hash collisions
**Risk**: Two different states produce same hash.
**Mitigation**: Using SHA-256 — collision probability is negligible (1 in 2^128). For extra safety, store full content alongside hash (we're not doing tree compression like git).

### 9. File corruption
**Risk**: Partial write to HEAD.json or commits/ leaves inconsistent state.
**Mitigation**: Atomic writes — write to temp file, then rename (same pattern as git). On read, validate JSON parse. If corrupt, fall back to previous commit (parent chain). Dream auto-repairs on next startup.

### 10. Privacy — corrections may contain sensitive info
**Risk**: User corrects AI with API keys or passwords in the rule text.
**Mitigation**: Corrections stored locally in `.opencode/history/` (gitignored). Never sent to LLM as raw text — only the rule/instruction portion. Add `.opencode/history/` to default `.gitignore`.

---

## Flow Diagrams

### Auto-Commit Flow (Compaction Trigger)

```
Context window filling up
         |
         v
experimental.session.compacting hook fires
         |
         v
State Versioning captures current state:
  - Read active corrections from memory
  - Read current goal/progress from recent messages
  - Read working files from tool call history
  - Compute hash of state
         |
         v
Is hash same as HEAD? ──Yes──> Skip (no changes)
         |
         No
         |
         v
Write commit to .opencode/history/commits/{hash}.json
Update HEAD.json to point to new commit
Append to changelog.json
         |
         v
Compaction proceeds normally
         |
         v
After compaction: corrections re-injected from commit
```

### Correction Flow

```
User message detected as correction
(explicit /correct or heuristic detection)
         |
         v
Parse correction rule from message
Generate ID from content hash
         |
         v
Correction exists? ──Yes──> Increment strength
         |                   Update timestamp
         No                  Write to corrections/
         |
         v
Create new correction
  strength: 1
  created: now
  source: "user correction"
Write to .opencode/history/corrections/{id}.md
         |
         v
Strength >= 3? ──No──> Done (loaded on next session)
         |
         Yes
         |
         v
AUTO-PROMOTE:
  Add to system prompt with high priority
  Next /dream: migrate to AGENTS.md
```

### Resume Flow

```
New session starts (or user types /resume)
         |
         v
Read HEAD.json -> get latest commit hash
         |
         v
HEAD exists? ──No──> Normal startup (no resume)
         |
         Yes
         |
         v
Read commit from .opencode/history/commits/{hash}.json
         |
         v
Inject into system prompt:
  1. Corrections (sorted by strength, max 500 tokens)
  2. Context summary: "You were working on: {goal}"
  3. Working files: "Active files: {list}"
  4. Progress: "Completed: {list}, In progress: {item}"
         |
         v
AI starts with full context
No re-reading files needed
```

### Drift Detection Flow

```
Session ends or /dream runs
         |
         v
Compare current session behavior vs committed corrections:
  For each correction in HEAD:
    Was it followed in this session?
    (Check: did AI use /commit? did AI keep responses short?)
         |
         v
Correction followed? ──Yes──> No action (behavior consistent)
         |
         No (drift detected)
         |
         v
Increment correction strength +1
Log drift event in changelog
         |
         v
Strength >= 3 and drifting?
  -> Force-inject into system prompt next session
  -> Flag in /dream report
```
