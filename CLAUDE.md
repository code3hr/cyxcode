# CLAUDE.md - Wiz Project Context

> This file contains essential context for AI assistants working on the Wiz project.

---

## What is Wiz?

Wiz is a **multi-domain AI operations platform** for professionals who use command-line tools. It's being built by forking [OpenCode](https://github.com/anomalyco/opencode) (MIT licensed).

**One-liner:** Speak intent, tools execute with governance, AI explains results - all auditable.

---

## Core Concept

Wiz is NOT just another AI coding assistant. It's a **governed orchestration layer** for domain-specific tools.

```
Human Intent → LLM Translation → Governance Check → Tool Execution → Parsed Results → LLM Explanation
```

**Key differentiator:** Governance engine that enforces scope, requires approvals for dangerous commands, and creates audit trails.

---

## Strategic Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build vs Fork | Fork OpenCode | Get CLI/TUI/multi-LLM for free |
| Plugin vs Platform | Platform (own fork) | Full control, can grow unlimited |
| Language | TypeScript | Inherited from OpenCode |
| First domain | Pentest | Clear user (security consultants), clear tools |
| Target OS | Kali/Parrot Linux | 600+ tools pre-installed, zero friction |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    WIZ PLATFORM                          │
├─────────────────────────────────────────────────────────┤
│  INHERITED (OpenCode):                                  │
│  CLI/TUI │ Multi-LLM │ Sessions │ Tool Exec │ Plugins  │
├─────────────────────────────────────────────────────────┤
│  WIZ CORE (we build):                                   │
│  Governance │ Scope Enforce │ Audit │ Findings │ Reports│
├─────────────────────────────────────────────────────────┤
│  DOMAIN AGENTS:                                         │
│  Pentest (MVP) │ SOC │ DevOps │ NetEng │ Community     │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

- **Language:** TypeScript (inherited from OpenCode)
- **Runtime:** Bun
- **State:** SQLite
- **LLM:** Multi-provider (Claude, GPT, Gemini, etc.)
- **Plugin System:** OpenCode plugins (extended)

---

## Governance Engine (Core Feature)

This is what makes Wiz different from vanilla OpenCode or ChatGPT.

**Before any command executes:**
1. **Scope Check** - Is target in allowed scope?
2. **Policy Check** - Is command auto-approved, needs approval, or blocked?
3. **Approval Flow** - Auto-execute or prompt user
4. **Audit Log** - Record everything regardless of outcome

**Policy example:**
```typescript
{
  domain: "pentest",
  autoApprove: ["nmap *", "nikto *", "ffuf *"],
  requireApproval: ["metasploit *", "sqlmap --os-*"],
  blocked: ["rm -rf *"]
}
```

---

## Target Users

### MVP: Solo Security Consultant
- Does pentests, web app assessments
- Uses 5-15 tools per engagement
- Needs audit trail for reports
- Time = money

### Future Domains:
- **SOC Analyst** - SIEM queries, threat intel, IOC checking
- **DevOps Engineer** - kubectl, terraform, ansible, cloud CLIs
- **Network Engineer** - Cisco/Juniper CLI, network scanners

---

## Build Phases

1. **Fork & Foundation** - Fork OpenCode, understand codebase
2. **Governance Engine** - Implement scope/policy/audit as core
3. **Pentest Agent MVP** - nmap + governance + findings
4. **Multi-Tool Pentest** - nikto, ffuf, nuclei, full workflow
5. **State & Reports** - Session persistence, exports
6. **Platform Polish** - Distribution, docs, community
7. **Multi-Domain** - SOC, DevOps, NetEng agents

---

## Key Files

- `PROJECT.md` - Full project specification and roadmap
- `CLAUDE.md` - This file (AI context)

---

## Distribution Strategy

**Primary target:** Kali Linux / Parrot OS

These distros have 600+ security tools pre-installed. Wiz becomes the intelligent orchestration layer:

```bash
# On Kali, all tools ready
wiz setup
> 47 tools detected. Wiz is ready.

wiz pentest start --scope 10.0.0.0/24
> scan for open ports
[APPROVED] Executing nmap...
```

**Goal:** Get Wiz pre-installed in Kali/Parrot eventually.

---

## What Wiz Is NOT

- Not building security tools (orchestrates existing ones)
- Not autonomous (human-in-the-loop always)
- Not a general AI assistant (domain-specific)
- Not a plugin on someone else's platform (we own it)

---

## Code Style & Principles

When contributing to Wiz:

1. **Governance is core** - Never bypass scope/policy checks
2. **Audit everything** - Every command attempt gets logged
3. **Parsers over LLM** - Use structured parsers for tool output, not LLM
4. **Human decides** - LLM suggests, human approves dangerous actions
5. **Domain-specific** - Each agent deeply understands its tools

---

## Common Commands (When Built)

```bash
# Start pentest engagement
wiz pentest start --scope 10.0.0.0/24 --exclude 10.0.0.1

# Natural language interaction
> scan for open ports
> check web services for vulnerabilities
> generate report

# View findings
wiz findings list
wiz findings export --format markdown

# Check audit log
wiz audit show
```

---

## OpenCode References

Since Wiz forks OpenCode, understand these:

- [OpenCode GitHub](https://github.com/anomalyco/opencode)
- [OpenCode Docs](https://opencode.ai/docs/)
- [Agents](https://opencode.ai/docs/agents/)
- [Plugins](https://opencode.ai/docs/plugins/)
- [Custom Tools](https://opencode.ai/docs/custom-tools/)

Key OpenCode concepts:
- **Agents** - Specialized AI assistants (we add domain agents)
- **Plugins** - Hook system with `tool.execute.before/after`
- **Tools** - TypeScript functions LLM can invoke
- **MCP** - Model Context Protocol for external integrations

---

## Current Status

**Phase:** Phase 1 - Fork & Foundation (in progress)

**Completed:**
- [x] Fork OpenCode repository (github.com/code3hr/opencode)
- [x] Clone to /home/mrcj/Desktop/wiz
- [x] Explore codebase structure
- [x] Identify modification points for governance engine

**Next steps:**
1. Set up development environment (bun install)
2. Build and run OpenCode locally
3. Create governance engine module
4. Implement tool.execute.before hook

---

## Codebase Structure (Key Findings)

```
/home/mrcj/Desktop/wiz/
├── packages/
│   ├── opencode/src/          # Core CLI/TUI
│   │   ├── tool/              # Tool definitions
│   │   │   ├── tool.ts        # Base tool definition
│   │   │   ├── bash.ts        # Bash execution
│   │   │   ├── registry.ts    # Tool registry
│   │   │   └── ...
│   │   ├── plugin/            # Plugin loader
│   │   ├── permission/        # Permission system
│   │   ├── agent/             # Agent definitions
│   │   ├── session/           # Session management
│   │   └── config/            # Configuration
│   ├── plugin/                # Plugin SDK
│   │   └── src/index.ts       # Hook definitions
│   └── sdk/                   # Client SDK
├── CLAUDE.md                  # This file
├── PROJECT.md                 # Full specification
└── README.md                  # OpenCode readme (to be replaced)
```

## Governance Injection Points

**Primary hook (packages/plugin/src/index.ts lines 176-187):**

```typescript
"tool.execute.before"?: (
  input: { tool: string; sessionID: string; callID: string },
  output: { args: any },
) => Promise<void>

"tool.execute.after"?: (
  input: { tool: string; sessionID: string; callID: string },
  output: { title: string; output: string; metadata: any },
) => Promise<void>
```

**Strategy:**
1. `tool.execute.before` → Check scope, check policy, require approval
2. `tool.execute.after` → Audit log, parse output, store findings

---

## Mentor Mode

The user has requested a "ruthless mentor" approach:
- Don't sugarcoat feedback
- Stress test all ideas before building
- Call out weak thinking directly
- Validate that we're solving real problems
- No vanity features - ship what matters

---

## Questions to Ask Before Building Features

1. Does this go through governance? (It should)
2. Is this audited? (It should be)
3. Does this serve the target user's workflow?
4. Is this the simplest solution?
5. Are we building platform or just tool?
