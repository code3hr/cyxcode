# CyxCode Init & Directory Structure

*Like `git init` — but for AI state.*

## Status: Design Document (Not Yet Implemented)

This documents the planned `.cyxcode` directory system. Current implementation uses `.opencode/` for backward compatibility with upstream OpenCode. This design is for a future version.

---

## The Idea

Just like `git init` creates `.git/` to track code, `cyxcode init` creates `.cyxcode/` to track AI state.

```bash
cd /projects/webapp
cyxcode init
# Creates .cyxcode/ directory with:
#   history/       — state versioning (commits, corrections, HEAD)
#   memory/        — project memories
#   patterns/      — learned patterns
#   config.json    — project config
```

---

## Three Tiers

| Tier | Location | Scope | What lives here |
|------|----------|-------|-----------------|
| **Project** | `.cyxcode/` in project root | This project only | Project memories, project corrections, state commits, learned patterns |
| **Global** | `~/.cyxcode/` in home dir | All projects on this machine | Global corrections ("always use bun"), global memories, global learned patterns |
| **Community** | Downloaded/synced | All users | Built-in 136 patterns, community-contributed patterns |

### How they layer

```
CyxCode starts in /projects/webapp:

1. Load COMMUNITY patterns (136 built-in)
2. Load GLOBAL state (from ~/.cyxcode/)
   - Global corrections ("always use bun, not npm")
   - Global memories ("this machine uses ~/.bun/bin")
   - Global learned patterns
3. Load PROJECT state (from .cyxcode/)
   - Project corrections ("use tailwind here")
   - Project memories ("auth.ts uses bcrypt")
   - Project learned patterns
   - State versioning (HEAD, commits, changelog)

Priority: Project > Global > Community
```

---

## Directory Structure

### Project Level (`.cyxcode/`)

```
.cyxcode/
├── config.json              # Project config (providers, models, etc.)
├── history/
│   ├── HEAD.json            # Latest commit pointer
│   ├── commits/             # Content-hashed state snapshots
│   │   ├── a7f3b2.json
│   │   └── c4e1d8.json
│   ├── corrections/         # Project-specific behavioral rules
│   │   └── use-tailwind.json
│   └── changelog.json       # Event log
├── memory/
│   ├── index.json           # Memory index with tags
│   └── auth-jwt.md          # Individual memories
├── patterns/
│   └── learned.json         # Learned patterns (pending + approved)
├── stats.json               # Router stats for this project
├── agent/                   # Custom agents
├── command/                 # Custom commands
└── .gitignore               # Ignore history/ (private), keep rest
```

### Global Level (`~/.cyxcode/`)

```
~/.cyxcode/
├── config.json              # Global config (API keys, default model)
├── corrections/             # Global behavioral rules
│   ├── use-bun.json         # "always use bun, not npm"
│   └── concise.json         # "keep responses under 3 lines"
├── memory/
│   ├── index.json
│   └── bun-avx2.md          # "this machine needs baseline bun"
├── patterns/
│   └── learned.json         # Global learned patterns
├── community/               # Community pattern packs
│   ├── bun-errors.json
│   └── rust-cargo.json
└── stats.json               # Aggregate stats across all projects
```

---

## `cyxcode init`

```bash
$ cd /projects/webapp
$ cyxcode init

Initializing CyxCode...
  Created .cyxcode/
  Created .cyxcode/config.json
  Created .cyxcode/history/
  Created .cyxcode/memory/
  Created .cyxcode/patterns/
  Added .cyxcode/history/ to .gitignore

CyxCode initialized. Ready to track AI state.

Tips:
  /correct "rule"     — Save a behavioral correction
  /remember "info"    — Save a project memory
  /dream              — Consolidate memories and patterns
  /resume             — Load previous session context
```

### What `init` does:

1. Creates `.cyxcode/` directory structure
2. Creates `config.json` with defaults
3. Creates empty `history/`, `memory/`, `patterns/` dirs
4. Adds `.cyxcode/history/` to `.gitignore` (private state)
5. Copies global corrections from `~/.cyxcode/corrections/` (inherited)
6. Detects project type (package.json → node, Cargo.toml → rust, etc.)

### Without `init`:

CyxCode still works without `init` — state saves to `.opencode/` (current behavior). `init` is for users who want the full `.cyxcode` experience with proper structure.

---

## Commands with `--global` Flag

```bash
# Project-local (default)
/correct "use tailwind for styling"
/remember "auth.ts uses bcrypt at line 50"
/learn-patterns

# Global (applies to ALL projects)
/correct --global "always use bun, not npm"
/remember --global "this machine uses ~/.bun/bin baseline"
/learn-patterns --global
```

### How global corrections work:

```
User runs: /correct --global "always use bun"
  → Saved to ~/.cyxcode/corrections/always-use-bun.json
  → Loaded in EVERY project on this machine
  → Higher priority than project corrections? No — project overrides global

User runs: /correct "use npm for this legacy project"
  → Saved to .cyxcode/corrections/use-npm.json
  → Only in THIS project
  → Overrides the global "use bun" for this project only
```

---

## Community Patterns

```
~/.cyxcode/community/
  bun-errors.json          # Bun-specific error patterns
  rust-cargo.json          # Rust/Cargo error patterns
  python-poetry.json       # Poetry-specific patterns
```

### Installing community patterns:

```bash
# Future: package manager for patterns
cyxcode patterns add bun-errors
cyxcode patterns add rust-cargo

# Or manual:
curl -o ~/.cyxcode/community/bun-errors.json \
  https://raw.githubusercontent.com/code3hr/cyxcode-patterns/main/bun-errors.json
```

### Community pattern format:

```json
{
  "name": "bun-errors",
  "version": "1.0.0",
  "author": "community",
  "patterns": [
    {
      "id": "bun-registry-404",
      "regex": "error: GET https://registry\\.npmjs\\.org/\\S+ - 404",
      "category": "bun",
      "description": "Package not found in npm registry",
      "fixes": [
        { "id": "check-name", "description": "Check package name for typos", "priority": 1 }
      ]
    }
  ]
}
```

---

## Migration from Current System

```
Current (.opencode/):           Future (.cyxcode/):
.opencode/memory/         →    .cyxcode/memory/
.opencode/history/        →    .cyxcode/history/
.opencode/cyxcode-learned.json → .cyxcode/patterns/learned.json
.opencode/cyxcode-stats.json   → .cyxcode/stats.json
.opencode/command/        →    .cyxcode/command/
.opencode/agent/          →    .cyxcode/agent/
```

Migration would be automatic — `cyxcode init` detects `.opencode/` and moves CyxCode-specific files to `.cyxcode/`, leaving OpenCode files in `.opencode/`.

---

## Loading Order at Startup

```
1. Built-in patterns (136, from source code)
2. Community patterns (from ~/.cyxcode/community/)
3. Global learned patterns (from ~/.cyxcode/patterns/learned.json)
4. Global corrections (from ~/.cyxcode/corrections/)
5. Global memories (from ~/.cyxcode/memory/)
6. Project learned patterns (from .cyxcode/patterns/learned.json)
7. Project corrections (from .cyxcode/corrections/)
8. Project memories (from .cyxcode/memory/)
9. Project HEAD commit (from .cyxcode/history/HEAD.json)

System prompt order:
  [environment] → [skills] → [global corrections] → [project corrections]
  → [resume context] → [AGENTS.md] → [global memories] → [project memories]
```

---

## Why Not Now

This is a future feature because:

1. **Upstream sync** — Renaming `.opencode/` to `.cyxcode/` everywhere breaks upstream pulls
2. **Current system works** — `.opencode/` with walk-up path resolution works for single projects
3. **Global tier needs design** — `~/.cyxcode/` needs init, config, and loading infrastructure
4. **Community patterns need a registry** — Package manager or URL-based distribution
5. **Migration path** — Need to handle users with existing `.opencode/` data

### What we can do now:
- Keep building state versioning in `.opencode/history/`
- Keep the `--global` flag concept in mind for commands
- Document this design for when we're ready to implement

### When to implement:
- After state versioning phases 5-7 are done and stable
- When we have multiple users needing cross-project state
- When community patterns are ready for distribution
