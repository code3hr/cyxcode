# Cyxwiz - Usage Guide

Quick reference for development and running the project.

---

## Prerequisites

- **Bun** (v1.3.6+)
- **Git**
- **GitHub CLI** (gh)

---

## Initial Setup (Already Done)

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# Clone the fork
gh repo clone code3hr/opencode /home/mrcj/Desktop/wiz

# Install dependencies
cd /home/mrcj/Desktop/wiz
bun install

# Build
cd packages/opencode
bun run build
```

---

## Running OpenCode (Dev Mode)

```bash
# Always set PATH first
export PATH="$HOME/.bun/bin:$PATH"

# Navigate to project
cd /home/mrcj/Desktop/wiz

# Run TUI
bun run --cwd packages/opencode src/index.ts

# Run with a specific command
bun run --cwd packages/opencode src/index.ts --help
bun run --cwd packages/opencode src/index.ts --version

# Run with a message (non-interactive)
bun run --cwd packages/opencode src/index.ts run "your message here"

# Start headless server
bun run --cwd packages/opencode src/index.ts serve

# Start web interface
bun run --cwd packages/opencode src/index.ts web
```

---

## Project Structure

```
/home/mrcj/Desktop/wiz/
├── packages/
│   ├── opencode/          # Core CLI/TUI (main focus)
│   │   ├── src/
│   │   │   ├── tool/      # Tool definitions
│   │   │   ├── plugin/    # Plugin system
│   │   │   ├── agent/     # Agent definitions
│   │   │   ├── session/   # Session management
│   │   │   └── ...
│   │   └── bin/
│   ├── plugin/            # Plugin SDK (@opencode-ai/plugin)
│   ├── sdk/               # Client SDK (@opencode-ai/sdk)
│   ├── console/           # Console app
│   ├── desktop/           # Desktop app
│   └── web/               # Web interface
├── PROJECT.md             # Full specification
├── CLAUDE.md              # AI context file
├── USAGE.md               # This file
└── README.md              # OpenCode readme
```

---

## Key Files for Cyxwiz Development

| File | Purpose |
|------|---------|
| `packages/opencode/src/tool/tool.ts` | Base tool definition |
| `packages/opencode/src/tool/bash.ts` | Bash command execution |
| `packages/opencode/src/plugin/index.ts` | Plugin loader |
| `packages/plugin/src/index.ts` | Hook definitions (lines 176-187) |
| `packages/opencode/src/agent/` | Agent configurations |
| `packages/opencode/src/config/` | Configuration system |

---

## Git Workflow

```bash
# Always use bun in PATH for hooks
export PATH="$HOME/.bun/bin:$PATH"

# Check status
cd /home/mrcj/Desktop/wiz
git status

# Commit changes
git add .
git commit -m "Your message"

# Push to your fork
git push origin dev

# Pull latest from upstream (original OpenCode)
git fetch upstream
git merge upstream/dev
```

---

## Development Commands

```bash
# From project root
cd /home/mrcj/Desktop/wiz

# Install dependencies
bun install

# Type check all packages
bun run typecheck

# Build opencode package
cd packages/opencode
bun run build

# Run tests (in opencode package)
bun test

# Run dev mode
bun run dev
```

---

## Adding Governance (Phase 2)

Location for new governance module:
```
packages/opencode/src/governance/
├── index.ts           # Main exports
├── scope.ts           # Scope checking
├── policy.ts          # Policy enforcement
├── audit.ts           # Audit logging
└── types.ts           # TypeScript types
```

Hook integration point:
```typescript
// packages/plugin/src/index.ts (lines 176-187)

"tool.execute.before"?: (
  input: { tool: string; sessionID: string; callID: string },
  output: { args: any },
) => Promise<void>

"tool.execute.after"?: (
  input: { tool: string; sessionID: string; callID: string },
  output: { title: string; output: string; metadata: any },
) => Promise<void>
```

---

## Troubleshooting

### "bun: command not found"
```bash
export PATH="$HOME/.bun/bin:$PATH"
```

### Pre-push hook fails
```bash
# Run with bun in PATH
export PATH="$HOME/.bun/bin:$PATH"
git push origin dev
```

### Permission denied
```bash
# If needed, fix permissions
chmod +x packages/opencode/bin/opencode
```

---

## Quick Reference

```bash
# One-liner to start dev
export PATH="$HOME/.bun/bin:$PATH" && cd /home/mrcj/Desktop/wiz && bun run --cwd packages/opencode src/index.ts
```

---

## Links

- **Fork:** https://github.com/code3hr/opencode
- **Upstream:** https://github.com/anomalyco/opencode
- **OpenCode Docs:** https://opencode.ai/docs/
