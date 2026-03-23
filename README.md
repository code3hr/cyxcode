# CyxCode

**Deep skills, not 700 shallow ones.** Pattern-first AI agent for developers.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux-FCC624)](https://www.linux.org/)
[![Platform: macOS](https://img.shields.io/badge/Platform-macOS-000000)](https://www.apple.com/macos/)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6)](https://www.microsoft.com/windows)

---

## Why CyxCode?

OpenClaw has 700+ skills. We have 3-5. **Thats the point.**

OpenClaw:  700+ thin skills, LLM decides everything, burns tokens
CyxCode:   Few deep skills, patterns handle 80%, LLM handles 20%

Most developer errors are **known patterns**. Why ask an LLM to figure out "module not found" for the 10,000th time?

```
You: "my build is failing"

CyxCode: [Recovery Skill]
         Pattern matched: "Cannot find module express"
         Category: Node/npm (1 of 104 patterns)
         Fix: npm install express

         [No LLM tokens burned]
         Apply fix? [Y/n]
```

---

## The Philosophy

### OpenClaw vs CyxCode

| | OpenClaw | CyxCode |
|--|----------|---------|
| **Skills** | 700+ (Gmail, Spotify, smart home...) | 3-5 (Recovery, Security, DevOps) |
| **Depth** | Thin wrappers | Deep domain expertise |
| **Decision** | LLM for everything | Patterns first, LLM fallback |
| **Audience** | General consumers | Developers |
| **Cost** | Token-heavy | Token-efficient |

### Why Patterns First?

Developer errors breakdown:
- 80% Known patterns (CMake errors, npm issues, git conflicts) -> CyxCode: FREE
- 20% Novel problems -> CyxCode: LLM fallback

**Result:** Same capability, fraction of the cost.

---

## Core Architecture

```
                        CYXCODE CORE
    +-------------------------------------------------------+
    |                    Skill Router                        |
    |  1. Detect intent from natural language                |
    |  2. Route to skill with matching patterns              |
    |  3. Pattern match BEFORE calling LLM                   |
    +-------------------------------------------------------+
                            |
        +-------------------+-------------------+
        v                   v                   v
  +-----------+       +-----------+       +-----------+
  |  SKILL:   |       |  SKILL:   |       |  SKILL:   |
  | Recovery  |       | Security  |       |  DevOps   |
  |           |       |           |       |           |
  | 104 error |       | 30+ tools |       | k8s, tf,  |
  | patterns  |       | parsers   |       | cloud     |
  | 10 pkgmgr |       | findings  |       |           |
  +-----------+       +-----------+       +-----------+
      DEEP                DEEP                DEEP
```

---

## Skills (Deep, Not Wide)

### Recovery Skill - MVP

**104 patterns** from CyxMake. Zero LLM tokens for known errors.

| Category | Patterns | Examples |
|----------|----------|----------|
| **Build** | 12 | CMake package not found, linker errors |
| **Git** | 9 | Merge conflicts, push rejected, auth failures |
| **Docker** | 8 | Daemon not running, port conflicts |
| **Node/npm** | 9 | Module not found, peer deps, EACCES |
| **Python/pip** | 8 | Import errors, venv issues |
| **System** | 9 | Permissions, disk space, OOM |
| **CI** | 6 | Workflow failures, secrets |

**10 package managers:** apt, brew, npm, pip, cargo, vcpkg, winget, choco, pacman, dnf

### Security Skill - Planned

Deep security expertise, not shallow wrappers:
- 30+ tools with **structured parsers** (not raw output)
- Findings database with severity classification
- Report generation (HTML, PDF, Markdown)
- Scope enforcement and audit trail

### DevOps Skill - Future

- Kubernetes (kubectl, helm)
- Infrastructure (terraform, pulumi)
- Cloud CLIs (aws, az, gcloud)

### Community Skills

We build the interface. Community builds domain skills.

---

## How It Works

```
Error occurs
     |
     v
+------------------+
| Pattern Match    |---- Match found ----> Apply fix (FREE)
| (104 patterns)   |                              |
+--------+---------+                              |
         |                                        |
    No match                                      |
         |                                        |
         v                                        |
+------------------+                              |
| LLM Fallback     |---- Novel solution ----------+
| (costs tokens)   |                              |
+------------------+                              |
                                                  v
                                           +----------+
                                           |  Retry   |
                                           +----------+
```

---

## Installation

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Clone and run
git clone https://github.com/code3hr/cyxcode.git
cd cyxcode
bun install
bun run dev
```

### Required: API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-...    # Claude (recommended)
# or
export OPENAI_API_KEY=sk-...           # GPT-4
```

---

## Usage

```bash
# Start CyxCode
bun run dev

# Talk naturally
> fix my build errors
> why is npm install failing
> scan this for vulnerabilities
```

### Commands

| Command | Description |
|---------|-------------|
| /skills | List available skills |
| /patterns | Show pattern match stats |
| /fix | Analyze last error |

---

## Skill Interface

```typescript
interface Skill {
  name: string
  description: string
  triggers: string[]

  // Pattern matching (FREE)
  patterns: Pattern[]
  match(error: string): PatternMatch | null

  // LLM fallback (costs tokens)
  analyze(context: Context): Promise<Analysis>

  // Execution
  execute(fix: Fix): Promise<Result>
}

interface Pattern {
  id: string
  regex: RegExp
  category: string
  fixes: Fix[]          // Prioritized fixes
  successRate?: number  // Learned from history
}
```

---

## Comparison

### vs OpenClaw

| | OpenClaw | CyxCode |
|--|----------|---------|
| Skills | 700+ | 3-5 deep |
| Focus | Everything | Developers |
| Decision | LLM always | Patterns first |
| Token cost | High | Low |

### vs Claude Code / Cursor

| | Claude Code | CyxCode |
|--|-------------|---------|
| Architecture | General agent | Skill-based |
| Error handling | LLM every time | Pattern library |
| Domain knowledge | None built-in | 104+ patterns |
| Extensibility | Plugins | Skills |

---

## Project Lineage

| Project | Role |
|---------|------|
| **OpenCode** | Upstream - AI agent infrastructure |
| **CyxMake** | Pattern source - 104 error patterns (C) |
| **CyxCode** | This - pattern-first skill agent |

---

## Development

```bash
bun install
bun run dev
```

### Adding a Skill

1. Create packages/opencode/src/skills/<name>/
2. Implement Skill interface
3. Add patterns (the deep knowledge)
4. Register in router

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Skill interface + router | Planned |
| 2 | Recovery skill (104 patterns) | Planned |
| 3 | Validate token savings | - |
| 4 | Security skill | - |
| 5 | Community skill format | - |

---

## License

MIT License - See [LICENSE](LICENSE)

---

## Credits

- **OpenCode** - Agent infrastructure
- **CyxMake** - Error patterns
- **OpenClaw** - Inspiration (we went the other way)

---

**CyxCode** - *Depth over breadth. Patterns over tokens.*
