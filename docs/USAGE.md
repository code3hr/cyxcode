# CyxCode User Guide

*We automate the AI that automates us.*

---

## Quick Start

```bash
git clone https://github.com/code3hr/cyxcode.git
cd cyxcode
bun install
export ANTHROPIC_API_KEY=sk-ant-...   # or OPENAI_API_KEY
bun run dev
```

For CPUs without AVX2: install [bun baseline build](https://github.com/oven-sh/bun/releases) to `~/.bun/bin/`.

---

## Running Modes

| Mode | Command | Description |
|------|---------|-------------|
| **TUI** (default) | `bun run dev` or `cyxcode` | Full-screen terminal UI |
| **Server** | `cyxcode serve --port 4096` | Headless API server |
| **Web** | `cyxcode web` | Browser-based UI |
| **CLI** | `cyxcode run "fix the bug"` | Non-interactive single message |
| **Attach** | `cyxcode attach http://localhost:4096` | Connect to running server |

---

## Shell Mode (`!` prefix)

Type `!` to enter shell mode, then type a command. The command runs **directly without AI** — zero tokens.

If the command fails, CyxCode checks its 136+ patterns for a match. If matched, the fix is displayed instantly. No AI involved at all.

```
! python3 -c 'import flask'
  -> Runs directly (no AI)
  -> CyxCode pattern matches: python-module-not-found
  -> Fix: pip install flask
  -> Tokens: ZERO
```

---

## Agents

Switch agents with `Tab`:

| Agent | Description |
|-------|-------------|
| **build** | Default, full-access for development work |
| **plan** | Read-only for analysis and exploration |

Use `@general` in messages to invoke the subagent for complex searches.

---

## Commands

Type `/` followed by the command name:

| Command | Description |
|---------|-------------|
| `/dream` | Run dream consolidation — deduplicate, validate, persist stats, update AGENTS.md |
| `/remember <info>` | Save a memory about your project for future sessions |
| `/learn-patterns` | Review and approve learned error patterns |
| `/diagnose` | Quick error diagnosis using a lightweight model |
| `/commit` | Git commit and push |
| `/learn` | Extract session learnings to AGENTS.md |

---

## Pattern Matching

CyxCode intercepts errors **before** the AI processes them. 136 built-in patterns across 16 categories:

| Skill | Categories |
|-------|-----------|
| **Recovery** | Node, Git, Python, Docker, Build, System |
| **Security** | SSL, Auth, SSH, Network, Scan |
| **DevOps** | Kubernetes, Terraform, CI/CD, Cloud, Ansible |

When a command fails:
1. CyxCode checks all patterns against the error output
2. **Match found** → Fix displayed, LLM skipped (`[CyxCode]` label visible)
3. **No match** → AI handles it, CyxCode learns from the interaction

### How to tell
- `[CyxCode]` in output = pattern matched, free fix
- No `[CyxCode]` = AI handled it (costs tokens)

---

## Pattern Learning

When CyxCode misses a pattern, the AI handles it. But CyxCode **captures the interaction**:

1. Error output + AI's fix are saved to `.opencode/cyxcode-learned.json`
2. A regex pattern is auto-generated
3. Run `/learn-patterns` to review and approve
4. Approved patterns are active on next restart
5. **Same error = zero tokens forever**

---

## Project Memory

CyxCode remembers project knowledge across sessions via indexed memory files.

### Save memories
```
/remember auth.ts uses JWT with bcrypt, middleware at line 50
```

### How it works
- Memories stored in `.opencode/memory/` as small .md files (1-5 lines)
- Each memory has tags for keyword matching
- On new sessions, only **relevant** memories load (max ~500 tokens)
- Memories auto-captured from session compaction summaries

### View memories
Check `.opencode/memory/index.json` for all stored entries.

---

## Dream Consolidation

CyxCode accumulates state over time. `/dream` cleans it up — like sleep for AI.

### Auto-dream (runs on startup, free)
- Deduplicates learned patterns
- Merges overlapping memories
- Validates file existence and regex
- Persists router stats

### Manual `/dream` (AI-powered)
- All auto-dream phases plus:
- Smart merging of related memories
- Updates AGENTS.md with new learnings
- Reports stats: matches, misses, hit rate, tokens saved

### Stats
Persisted to `.opencode/cyxcode-stats.json`:
- Pattern matches/misses across sessions
- Hit rate
- Lifetime tokens saved
- Sessions tracked

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CYXCODE_DEBUG` | `false` | Debug output for pattern matching and learning |
| `CYXCODE_SHORT_CIRCUIT` | `true` | Skip LLM on pattern match. `false` to always use AI |
| `ANTHROPIC_API_KEY` | — | Claude API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `CYXCODE_SERVER_PASSWORD` | — | Password for server mode |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `!` | Shell mode (run command directly) |
| `Tab` | Switch agents |
| `Ctrl+T` | Switch model variants |
| `Ctrl+P` | Command palette |
| `PageUp/Down` | Scroll |
| `Home` / `End` | Jump to first/last message |

---

## File Structure

```
.opencode/
  memory/
    index.json              # Memory index (tags, summaries)
    *.md                    # Individual memories (1-5 lines each)
  cyxcode-learned.json      # Learned error patterns (pending + approved)
  cyxcode-stats.json        # Persisted router stats
  cyxcode.jsonc             # Project config
  command/                  # Custom slash commands
  agent/                    # Agent configs
```

---

## Adding Custom Patterns

See [Adding Patterns](ADDING-PATTERNS.md) for a step-by-step guide.

## Contributing

See [Contributing Patterns](CONTRIBUTING-PATTERNS.md) to add patterns for new tools/languages.

## Performance

See [Performance](PERFORMANCE.md) for benchmarks and token savings estimates.
