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

The older short answer was:

1. **Short-circuit requires modifying the core loop** — plugins can't break the LLM loop mid-execution
2. **Shell mode (`!`) has no plugin hook** — `SessionPrompt.shell()` is a core function
3. **Tool result metadata** — the `cyxcodeMatched` flag requires bash tool internals
4. **Module initialization timing** — Bun's `--conditions=browser` needs imports in core files

OpenCode's plugin model is useful and we should be precise about that. Plugins
can subscribe to events such as `tool.execute.before`, `tool.execute.after`,
`permission.asked`, `permission.replied`, `shell.env`, file events, message
events, session events, and compaction hooks. They can also add custom tools.
That is a strong extension model for workflow automation, notifications, custom
tools, and project-specific behavior.

The reason CyxCode remains a fork is that CyxCode is a downstream product, not
one feature. Some parts are security boundaries. Some parts are memory/state
systems. Some parts are product UX and domain workflows.

1. **Short-circuiting needs control-flow ownership** - CyxCode can stop a known
   error before it burns another LLM call. The pattern router needs to change
   what the session does next.
2. **Shell mode is core behavior** - the `!` path is direct command execution,
   not a normal model turn. Zero-token shell recovery needs to live where shell
   execution and prompt parsing are handled.
3. **Pattern learning needs message and tool internals** - CyxCode captures
   missed errors, the AI's fix, the source command, match metadata, and review
   state so future repeats can be handled without another model call.
4. **Recall, memory, and dream are persistent state systems** - CyxCode has local
   memory, semantic recall, learned patterns, dream consolidation, and indexed
   project knowledge. Those features need to participate in session startup,
   compaction, prompt assembly, pruning, and local storage.
5. **Behavior versioning changes how agent state survives** - corrections,
   drift detection, auto-promotion, and AI-state snapshots are not just plugin
   notifications. They change how the agent resumes, remembers, and is governed
   across sessions.
6. **CyxWatch needs lower-level enforcement** - the security layer must sit near
   shared process, filesystem, network, and memory wrappers so direct library
   calls cannot bypass policy.
7. **Memory firewall rules must apply before context leaves the machine** -
   classification, redaction, minimization, approval, and audit logging need to
   run before context is sent to a model.
8. **Governance and domain tooling are core product surfaces** - CyxCode is
   adding security workflows, pentest/SOC/DevOps style tooling, report
   generation, findings/state management, and policy enforcement. Those are
   platform features, not only optional extension hooks.
9. **Dashboard, branding, and product UX are first-class** - CyxCode has its own
   web UI, security pages, memory controls, token views, graph/wiki/recall
   surfaces, and governance model.
10. **Runtime metadata belongs in core result paths** - pattern matches,
   governance decisions, risk flags, prompt IDs, and session correlation need to
   travel through the application reliably.

Short version:

> Plugins extend OpenCode. CyxCode changes the runtime, memory, governance, and
> product boundary.

We still want the fork surface to stay small. When a feature can be a plugin, it
should be a plugin. When a feature must enforce policy before execution,
short-circuit the LLM loop, or control what memory reaches a model, it belongs
in core.

Reference: OpenCode plugin events are documented at
https://opencode.ai/docs/plugins/#events.

### Q: The fork vs plugin debate is worth taking seriously. Consider implementing as a pre-process wrapper instead.

**A:** Pre-process wrapper is an interesting idea but doesn't solve the core problems:

1. **Short-circuiting** — A wrapper can intercept input, but can't prevent the LLM from being called after a tool returns an error. The short-circuit happens *inside* the bash tool execution flow.

2. **Shell mode** — The `!` prefix triggers direct command execution that completely bypasses the LLM. A wrapper would need to intercept the prompt parser, which is deep in the core.

3. **Pattern learning** — Capturing what the AI does when patterns miss requires hooking into the message flow after LLM responses.

Two more boundaries matter now:

4. **Runtime security** - a wrapper around the CLI does not see every internal
   filesystem, network, memory, or process operation. CyxWatch needs enforcement
   near the actual shared wrappers.

5. **Memory access control** - a wrapper sees the user's prompt, but it does not
   reliably control recall, compaction, embeddings, memory files, or context
   assembled inside the application before a model call.

If OpenCode adds stable core hooks for these boundaries - tool result
interception, shell mode hooks, message flow middleware, shared network/process
guards, and pre-model context policy - we would happily move more behavior into
plugins. Until then, the fork is the practical path.

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
