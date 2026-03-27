# CyxCode FAQ

Community questions and honest answers.

---

## Table of Contents

- [Problem & Value](#problem--value)
- [Fork vs Plugin](#fork-vs-plugin)
- [Maintenance & Sustainability](#maintenance--sustainability)
- [Testing & Quality](#testing--quality)
- [Technical Approach](#technical-approach)

---

## Problem & Value

### Q: You're solving a problem that doesn't exist. Missing python? You deal with that once on first run.

**A:** You're right that one-time installation errors aren't the main value. Those are setup issues you hit once per machine. The real ROI comes from **recurring errors across projects and context resets**:

- Git conflicts and push rejections (happen constantly)
- TypeScript/ESLint errors with known fixes
- Docker container failures
- Test failures with common solutions
- Build errors that repeat across projects

The pattern library isn't about "missing python" — it's about the errors that keep coming back. Every time Claude's context resets, it forgets how to fix that ESLint rule. CyxCode remembers.

That said, you've identified the bigger problem: **context management**. Repository exploration eating thousands of tokens per task is painful. We're working on this with the memory system (selective loading based on relevance) and dream consolidation (offline processing to avoid runtime bloat). But it's early.

### Q: Biggest issue is having to explore the repository all the time. Memory solutions I've tested fill context with irrelevant tokens.

**A:** Exactly. Most "memory" implementations dump everything into context. That's worse than no memory.

CyxCode's memory system is designed differently:
- **Small indexed files** (1-5 lines each) instead of monolithic memory dumps
- **Tag-based relevance matching** — only loads memories that match current keywords
- **Max 2000 chars loaded** — hard cap to prevent context bloat
- **Access tracking + pruning** — unused memories get removed after 30 days

The dream system processes patterns and memories offline (on startup, no tokens) to keep runtime lean.

Is it solved? No. Code embeddings for automatic relevant context retrieval is the right direction. If you have implementations worth looking at, we'd love to hear about them.

---

## Fork vs Plugin

### Q: Why not a plugin? Will you maintain all OpenCode changes forever?

**A:** The README addresses this directly: **plugins can't do what CyxCode does**.

Four technical blockers:

1. **Short-circuit requires modifying the core loop** — plugins can't break the LLM loop mid-execution
2. **Shell mode (`!`) has no plugin hook** — `SessionPrompt.shell()` is a core function
3. **Tool result metadata** — the `cyxcodeMatched` flag requires bash tool internals
4. **Module initialization timing** — Bun's `--conditions=browser` needs imports in core files

Plugins decorate. CyxCode changes control flow. That requires a fork.

### Q: The fork vs plugin debate is worth taking seriously. Consider implementing as a pre-process wrapper instead.

**A:** Pre-process wrapper is an interesting idea but doesn't solve the core problems:

1. **Short-circuiting** — A wrapper can intercept input, but can't prevent the LLM from being called after a tool returns an error. The short-circuit happens *inside* the bash tool execution flow.

2. **Shell mode** — The `!` prefix triggers direct command execution that completely bypasses the LLM. A wrapper would need to intercept the prompt parser, which is deep in the core.

3. **Pattern learning** — Capturing what the AI does when patterns miss requires hooking into the message flow after LLM responses.

If OpenCode adds plugin hooks for these (tool result interception, shell mode hooks, message flow middleware), we'd happily migrate. Until then, fork is the only path.

### Q: Why not contribute to the main project?

**A:** We'd love to. But CyxCode's approach is opinionated:

- **Pattern-first philosophy** — intercept before LLM, not after
- **Shell mode** — zero-token direct execution
- **Learning system** — auto-generate patterns from AI interactions

These aren't bug fixes or incremental features. They're architectural changes to how the tool processes commands. The OpenCode team may have different priorities or philosophies.

If they're interested in upstreaming any of this, we're open to it. But we're not going to push architectural changes they didn't ask for.

---

## Maintenance & Sustainability

### Q: Do you know how hard it is to maintain an OSS project? You should have a plan for structure and longevity.

**A:** You're right, and this is a fair concern. Here's our approach:

**Upstream sync strategy:**
- Internal directory structure stays `opencode` intentionally (see README "Note on Naming")
- This makes `git pull upstream` possible without merge conflict hell
- We rebranded CLI, TUI, config, and docs — not internal paths

**What we maintain:**
- 5 source files in `src/cyxcode/` (router, skills, memory, dream, learned)
- 5 test files (88 tests, 3 skipped)
- Pattern definitions in skill classes
- Documentation

**What we don't touch:**
- Core OpenCode architecture
- TUI rendering
- Session management
- Tool implementations (except bash hook)

The fork surface is intentionally small. We add, we don't rewrite.

### Q: Many small frameworks die with AI. Big conventional frameworks survive.

**A:** True. We're not trying to be a framework. CyxCode is a thin layer on top of OpenCode that:

1. Intercepts known errors (patterns)
2. Learns new patterns from AI
3. Persists project memory

If OpenCode adds these capabilities natively, CyxCode becomes unnecessary. That's fine — the goal is the capability, not the project.

### Q: What if I run everything in Docker and block the agent from installing on my base machine?

**A:** The pattern system is environment-agnostic. It matches error strings, not execution contexts.

If your Docker-based workflow produces `npm ERR! 404`, CyxCode matches it the same way. The fix suggestion might be `npm install X` — you'd run that inside your container.

The patterns don't know or care where commands execute. They're regex against error output. Your sandbox config controls what actually runs.

---

## Testing & Quality

### Q: Where are the tests?

**A:** CyxCode tests are in `packages/opencode/test/cyxcode/`:

```bash
bun test packages/opencode/test/cyxcode/
```

### Q: How do you make sure features don't break each other?

**A:** Fair question. We have tests now:

```
bun test test/cyxcode/

 88 pass
 3 skip
 0 fail
```

**Test coverage:**

| File | Tests | Coverage |
|------|-------|----------|
| `router.test.ts` | 12 | Skill registration, matching, stats |
| `base-skill.test.ts` | 22 | Pattern matching, capture extraction, fix execution |
| `learned.test.ts` | 20 | Pattern generation, regex escaping, PendingCapture |
| `memory.test.ts` | 18 | Query scoring, keyword matching, edge cases |
| `dream.test.ts` | 18 | Orient, deduplicate, validate, persist stats |

The 3 skipped tests document a known bug in `substituteCaptures` (regex escaping issue).

Is it production-quality? It's moving that direction. The core pattern matching and learning system is tested. Integration with OpenCode's bash tool is tested manually via the debug mode (`CYXCODE_DEBUG=true`).

---

## Technical Approach

### Q: Is your regex smart enough to identify Docker contexts or see rules?

**A:** The patterns match error strings, not execution contexts. They don't know if you're in Docker, a VM, or bare metal.

What you can do:
- Configure patterns to suggest Docker-appropriate fixes
- Add patterns specific to containerized errors
- The learning system will capture Docker-specific errors when they occur

The fix suggestions are text — you control how/where they execute.

### Q: The error interception approach is clever. But the more patterns you add, the more merge conflicts on upstream pulls.

**A:** Patterns are isolated. They live in:
- `src/cyxcode/skills/` (3 skill files with pattern arrays)
- `.opencode/cyxcode-learned.json` (user's learned patterns)

These files don't exist in upstream OpenCode. Zero merge conflicts on pattern additions.

The only merge-sensitive code is:
- `src/cyxcode/router.ts` (skill orchestration)
- `src/session/prompt/index.ts` (short-circuit hook)
- `src/bash/bash.ts` (tool result hook)

That's ~200 lines of integration code across 3 files. Upstream changes to these files require manual review, but it's manageable.

---

## Still Have Questions?

Open an issue at [github.com/code3hr/cyxcode/issues](https://github.com/code3hr/cyxcode/issues) or check the [docs](../docs/).

---

*"Tokens are the new currency. CyxCode makes sure you don't waste them."*
