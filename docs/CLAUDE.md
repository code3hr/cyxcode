# CLAUDE.md - CyxCode Project Context

> Essential context for AI assistants working on CyxCode.

---

## What is CyxCode?

**CyxCode** is a pattern-first, skill-based AI agent for developers.

**Tagline:** Deep skills, not 700 shallow ones. Patterns over tokens.

---

## The Key Insight

OpenClaw has 700+ skills and burns LLM tokens for every decision.

CyxCode has 3-5 deep skills and uses **pattern matching first**:
- 80% of developer errors are known patterns -> FREE (no LLM)
- 20% novel problems -> LLM fallback

**Same capability. Fraction of the cost.**

---

## Positioning

| | OpenClaw | CyxCode |
|--|----------|---------|
| Skills | 700+ thin | 3-5 deep |
| Audience | General | Developers |
| Decision | LLM always | Patterns first |
| Token cost | High | Low |

---

## Architecture

```
                        CYXCODE CORE
    +-------------------------------------------------------+
    |                    Skill Router                        |
    |  1. Detect intent                                      |
    |  2. Route to skill                                     |
    |  3. Pattern match BEFORE LLM                           |
    +-------------------------------------------------------+
                            |
        +-------------------+-------------------+
        v                   v                   v
  +-----------+       +-----------+       +-----------+
  | Recovery  |       | Security  |       |  DevOps   |
  | 104 patns |       | 30+ tools |       | k8s, tf   |
  +-----------+       +-----------+       +-----------+
```

---

## Skills

### Recovery Skill (MVP)
- **104 patterns** from CyxMake
- **10 package managers**
- Categories: Build, Git, Docker, Node, Python, System, CI

### Security Skill (Planned)
- 30+ tools with parsers
- Findings database
- Reports

### DevOps Skill (Future)
- k8s, terraform, cloud CLIs

---

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Bun
- **Base:** OpenCode fork
- **Patterns:** From CyxMake (C)

---

## Key Files

| File | Purpose |
|------|---------|
| README.md | Project overview |
| docs/CLAUDE.md | This file |
| packages/opencode/src/skills/ | Skill system (to build) |

---

## Pattern Source

CyxMake (../cyxmake) has the patterns in C:
- src/recovery/error_patterns.c - 104 patterns
- src/tools/ - Package manager integration

Port these to TypeScript.

---

## Development

```bash
bun install
bun run dev
```

---

## Roadmap

1. Skill interface + router
2. Recovery skill (port 104 patterns)
3. Validate token savings
4. Security skill
5. Community skill format

---

## Principles

1. **Patterns first** - Match before calling LLM
2. **Deep not wide** - Few skills, deep expertise
3. **Developer focused** - Not general purpose
4. **Token efficient** - Save money on known problems

---

## Questions Before Building

1. Can this be pattern-matched? (prefer yes)
2. Does this fit the skill model?
3. Is it developer-focused?
4. Is it the simplest solution?
