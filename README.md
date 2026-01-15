# Wiz

> The AI operations platform for security professionals. Speak intent, tools execute with governance, results explained.

**Forked from [OpenCode](https://github.com/anomalyco/opencode) (MIT)**

---

## What is Wiz?

Wiz is an intelligent orchestration layer for command-line tools. Built for security professionals, expanding to DevOps, SOC, and beyond.

```
$ wiz pentest start --scope 10.0.0.0/24

> scan for open ports
[APPROVED] Executing nmap...

Found 12 hosts with open ports:
- 10.0.0.15: SSH (22), HTTP (80), HTTPS (443)
- 10.0.0.20: SSH (22), MySQL (3306)
...

Recommendation: HTTP on .15 is running outdated Apache. Investigate for web vulnerabilities.

> do that
[APPROVED] Executing nikto...
```

---

## Key Features

- **Governance Engine** - Policy-based approval before execution
- **Scope Enforcement** - Stay within authorized targets
- **Audit Logging** - Everything recorded automatically
- **Multi-LLM Support** - Claude, GPT, Gemini, local models
- **Domain Agents** - Pentest, SOC, DevOps, NetEng

---

## Quick Start

```bash
# Prerequisites: Bun
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# Clone and install
git clone https://github.com/code3hr/opencode.git wiz
cd wiz
bun install

# Run
bun run --cwd packages/opencode src/index.ts
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [PROJECT.md](docs/PROJECT.md) | Full platform specification |
| [CLAUDE.md](docs/CLAUDE.md) | AI context and progress |
| [USAGE.md](docs/USAGE.md) | Development guide |

---

## Project Structure

```
wiz/
├── README.md              # This file
├── docs/
│   ├── PROJECT.md         # Platform specification
│   ├── CLAUDE.md          # AI context file
│   └── USAGE.md           # Development guide
├── packages/
│   ├── opencode/          # Core CLI/TUI
│   ├── plugin/            # Plugin SDK
│   ├── sdk/               # Client SDK
│   └── ...
└── [OpenCode files]
```

---

## Current Status

**Phase 1: Fork & Foundation** - COMPLETE

- [x] Fork OpenCode
- [x] Set up development environment
- [x] Build and verify

**Phase 2: Governance Engine** - NEXT

---

## Links

- **Fork:** https://github.com/code3hr/opencode
- **Upstream:** https://github.com/anomalyco/opencode
- **OpenCode Docs:** https://opencode.ai/docs/

---

## License

MIT License - See [LICENSE](LICENSE)
