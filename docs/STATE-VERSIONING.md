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

## Why Not Just Use Git?

Git already tracks your files. Why do we need another versioning system?

**Git tracks your code. State versioning tracks what the AI knows.**

Git commits your changes to `auth.ts`. State versioning commits "user corrected me to use /commit skill, not raw git."

Git gives you history of code. State versioning gives you history of corrections, discoveries, and preferences.

You resume work by checking out code. AI resumes by loading what it learned.

**What git can't tell the AI:**

- "User corrected you 3x about using raw git instead of /commit"
- "You were working on the auth feature, halfway done"
- "User prefers concise responses"
- "You discovered globalThis is needed for cross-module state in Bun"
- "Files src/auth.ts and src/middleware.ts were the active context"

**Example scenario:**

You `git checkout` your code from yesterday. Perfect — code is restored.

But the AI starts fresh. It doesn't know you corrected it yesterday. It doesn't know what it was working on. It re-reads all files to understand the project. It makes the same mistakes you already corrected.

State versioning is git for the AI's brain, not your codebase.

### How It Differs from Dream

CyxCode already has Dream. Why do we need state versioning?

**Dream (what we have now):**
- Runs on startup, offline — no token cost
- Consolidates patterns and memories
- Deduplicates, prunes old entries
- Processes what's already stored

**What Dream doesn't do:**
- Track corrections or their strength
- Know what you were working on
- Remember decisions made
- Detect when AI drifts from corrections
- Provide structured resume

Dream is a processor. But it needs structured data to process. Right now it consolidates patterns and memories, but it doesn't know which corrections keep coming back, what the user was frustrated about, or what decisions were made.

**State versioning feeds Dream:**

```
Session ends
    ↓
Auto-commit (state snapshot)
    ↓
Next startup: Dream runs
    ↓
Dream reads commit history
    ↓
Sees: "User corrected AI 3x about /commit skill"
    ↓
Promotes to AGENTS.md permanently
    ↓
AI never forgets again
```

State versioning captures the data. Dream processes it. Together they close the loop.

### Claude Code's Auto Dream (March 2026)

Claude Code released Auto Dream — a background memory consolidation feature. Here's how it works:

**Four-phase cycle:** orient → gather signal → consolidate → prune

**What it does:**
- Runs between sessions as a background sub-agent
- Converts relative dates to absolute ("yesterday" → "2026-03-15")
- Deletes contradicted facts (switched from Express to Fastify → removes old entry)
- Merges overlapping entries (3 sessions noted same thing → consolidate to one)
- Triggers after 24 hours + 5 sessions

**Memory architecture:**
1. CLAUDE.md — instructions you write
2. Auto Memory — notes Claude writes per session
3. Session Memory — conversation continuity
4. Auto Dream — periodic consolidation

**What Auto Dream doesn't track:**
- Correction strength (how many times you repeated something)
- Structured project state (what you were working on)
- Decision history (why choices were made)
- Drift detection (when AI stops following corrections)
- Resume context (files, progress, blockers)

Auto Dream consolidates memories. State versioning tracks behavioral corrections and project context with strength scoring.

Claude Code has the processor (Auto Dream). State versioning provides the structured input it needs.

### What State Versioning Tracks

**Project State Awareness**

Without state versioning, if you ask "what's the current state of CyxCode?" I have to read dozens of files, scan git history, and piece it together — burning thousands of tokens.

With state versioning, HEAD commit tells me: "Implementing state versioning. Storage layer done. Working on correction tracking. Blocked by typecheck errors in dashboard/."

**Architectural Discoveries**

Things I learn about your project that aren't in any single file:
- "This project uses Bun, not Node"
- "Tests are in packages/opencode/test/, not src/"
- "globalThis is needed for cross-module state"
- "Pre-push hook runs typecheck, can block push"

Without versioning, I rediscover these every session.

**User Preferences**

How you like to work:
- "User prefers concise responses"
- "User wants commits with specific format and Co-Authored-By"
- "User uses /commit skill, not raw git"
- "User doesn't want emoji unless asked"

**Active Context**

What files matter right now:
- "We were editing src/cyxcode/memory.ts and docs/STATE-VERSIONING.md"
- "Ignore the dashboard/ folder — it's a separate project"
- "Focus on packages/opencode/, that's the core"

**Decisions Made**

Choices that shouldn't be revisited:
- "We decided to use SHA-256 for hashing"
- "Storage goes in .opencode/history/, not .claude/"
- "Corrections auto-promote after 3x, not 5x"

**What's Been Tried**

Failed approaches to avoid repeating:
- "Tried storing corrections in memory.ts, caused circular dependency"
- "Compaction hook fires too late, need to use 'compacting' not 'compacted'"

**Blockers and Issues**

Current problems I should know about:
- "Typecheck failing — dashboard has SolidJS type errors"
- "Can't push until typecheck passes (pre-push hook)"
- "Memory.ts line 381 has sessionID property access bug"

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

## Implementation Plan: State Versioning + Dream Upgrade

State versioning and dream upgrade should be built together. Dream needs commit history to do smart consolidation. State versioning needs dream to process corrections and promote them.

### Integrated Flow

```
Session running
    ↓
User corrects AI → Correction saved (strength: 1)
    ↓
Session ends / Compaction triggers
    ↓
AUTO-COMMIT: snapshot state to .opencode/history/
    - corrections with strength
    - project context (goal, files, progress)
    - discoveries
    ↓
Next startup (app starts immediately, not blocked)
    ↓
BACKGROUND DREAM (triggers: 24h + 5 sessions)
    ↓
Dream reads commit history
    ↓
Phase 1: Orient (existing)
Phase 2: Deduplicate (existing)
Phase 3: Validate (existing)
Phase 4: Persist stats (existing)
Phase 5: Process corrections ← NEW
    - Find corrections with strength >= 3
    - Promote to AGENTS.md
    - Detect drift patterns
Phase 6: Consolidate commits ← NEW
    - Merge old commits into epoch summaries
    - Cap at 100 commits
    ↓
Resume: Load HEAD into system prompt
```

### Implementation Phases

| Phase | What | Depends on | Files |
|-------|------|------------|-------|
| **1** | State versioning storage (commits, HEAD, changelog) | — | `src/cyxcode/state.ts` (new) |
| **2** | Auto-commit hooks (compaction, session end) | Phase 1 | `src/session/`, `state.ts` |
| **3** | Correction tracking with strength | Phase 1 | `state.ts` |
| **4** | Dream: background execution + triggers | — | `src/cyxcode/dream.ts` |
| **5** | Dream: read commit history | Phase 1, 4 | `dream.ts` |
| **6** | Dream: auto-promote corrections to AGENTS.md | Phase 3, 5 | `dream.ts` |
| **7** | Resume: load HEAD into system prompt | Phase 1 | `src/session/prompt/` |
| **8** | Drift detection | Phase 3, 7 | `state.ts`, `dream.ts` |

### Phase 1: State Storage

Create `src/cyxcode/state.ts`:

```typescript
// Storage structure
.opencode/history/
  HEAD.json              // { hash: "a7f3b2", timestamp: "..." }
  commits/
    a7f3b2.json          // State snapshot
    c4e1d8.json
  corrections/
    use-commit-skill.json  // { strength: 3, rule: "...", created: "..." }
  changelog.json         // Linear event log

// Core functions
State.commit(state)      // Create new commit, update HEAD
State.loadHEAD()         // Read latest commit
State.addCorrection(rule) // Add or increment correction strength
State.getCorrections()   // Get all corrections sorted by strength
```

### Phase 2-3: Auto-Commit + Corrections

Hook into existing events:

```typescript
// On compaction (before context is lost)
experimental.session.compacting → State.commit(currentState)

// On session end
session.close → State.commit(currentState)

// On user correction detected
message.contains("don't", "stop", "I said") → State.addCorrection(rule)
```

### Phase 4: Dream Background Execution

Upgrade `dream.ts`:

```typescript
// Current (blocking)
App starts → Dream.run() → blocks → App ready

// Upgraded (background with triggers)
App starts → App ready immediately
          ↓
Check: shouldDream()
  - 24h since lastDream?
  - 5+ sessions since lastDream?
          ↓
Yes → setImmediate(() => Dream.run())
          ↓
Dream runs in background, doesn't block user
```

### Phase 5-6: Dream Reads Commits

Add to `dream.ts`:

```typescript
// Phase 5: Process corrections
async function processCorrections() {
  const corrections = await State.getCorrections()
  for (const c of corrections) {
    if (c.strength >= 3 && !c.promoted) {
      await appendToAgentsMd(c.rule)
      c.promoted = true
    }
  }
}

// Phase 6: Consolidate commits
async function consolidateCommits() {
  const commits = await State.getAllCommits()
  if (commits.length > 100) {
    // Merge oldest 50 into epoch summary
    const epoch = summarizeCommits(commits.slice(0, 50))
    await State.replaceWithEpoch(epoch)
  }
}
```

### Phase 7: Resume

Load HEAD into system prompt on session start:

```typescript
// In session/prompt/index.ts
const head = await State.loadHEAD()
if (head) {
  systemPrompt += `
## Previous Session Context
Goal: ${head.state.goal}
Working files: ${head.state.workingFiles.join(", ")}
In progress: ${head.state.inProgress}

## Corrections (follow these)
${head.state.corrections.map(c => `- ${c.rule} (strength: ${c.strength})`).join("\n")}
`
}
```

### Phase 8: Drift Detection

Compare behavior against corrections:

```typescript
// After session ends
for (const correction of corrections) {
  const followed = checkIfFollowed(correction, sessionMessages)
  if (!followed) {
    correction.driftCount++
    if (correction.driftCount >= 2) {
      // Force-inject next session
      correction.forceInject = true
    }
  }
}
```

### Order of Implementation

1. **Start with Phase 1 + 4** — storage layer + background dream (independent)
2. **Then Phase 2 + 3** — hooks + corrections (needs Phase 1)
3. **Then Phase 5 + 6** — dream reads commits (needs Phase 1 + 4)
4. **Then Phase 7** — resume (needs Phase 1)
5. **Finally Phase 8** — drift detection (needs everything)

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
