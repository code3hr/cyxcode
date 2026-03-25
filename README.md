# CyxCode

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![CyxCode Terminal UI](packages/web/src/assets/lander/screenshot-cyxcode.png)](https://github.com/code3hr/cyxcode)

---

## What is CyxCode?

CyxCode is a fork of OpenCode that takes a fundamentally different approach to error handling. Instead of sending every error to an LLM (which burns tokens and costs money), CyxCode maintains a library of 136 regex patterns that match known errors and provide instant fixes — for free.

When you run a command in CyxCode and it fails, the system checks the error output against all 136 patterns **before** the AI ever sees it. If a pattern matches, you get an instant fix suggestion with zero LLM token cost. If no pattern matches, it falls through to the AI as usual.

```
Traditional AI coding tools:  Every error -> LLM -> tokens burned -> response
CyxCode:                      Every error -> Pattern check -> match? -> FREE fix
                                                           -> no match? -> LLM fallback
```

### Two Modes: Zero Tokens or Reduced Tokens

**Shell mode (`!` prefix) — Pattern first, zero tokens:**

![CyxCode Shell Mode - Zero Tokens](packages/web/src/assets/lander/screenshot-cyxcode-shell.png)

```
!python3 -c 'import flask'
  -> Command runs directly (no AI involved)
  -> CyxCode pattern matches
  -> Fix displayed instantly
  -> Total tokens: ZERO
```

**Normal mode — AI decides, pattern short-circuits:**
```
python3 -c 'import flask'
  -> AI thinks "let me run this" (LLM Call #1, unavoidable)
  -> Command runs, CyxCode matches
  -> LLM Call #2 SKIPPED (short-circuit)
  -> Tokens saved: ~800-1600 per error
```

Use `!` prefix when you know you're running a command. The AI is bypassed entirely and CyxCode handles errors at zero cost.

### Screenshot: Pattern Matching in Action

The screenshot above shows CyxCode's short-circuit in action. A `python3 -c 'import flask'` command fails with `ModuleNotFoundError`. CyxCode matches the `python-module-not-found` pattern and displays the fix (`pip install flask`, `pip3 install flask`, `pipx install flask`) **directly** — the LLM is completely skipped on the return trip. Notice: no second "Thinking:" block, cost stays at **$0.00**, and the response appears instantly.

### Agents

CyxCode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

### Why Fork OpenCode Instead of Building a Plugin?

A plugin can't do what CyxCode does. Here's why:

1. **The short-circuit requires modifying the core loop.** CyxCode intercepts the prompt loop in `prompt.ts` to skip the LLM call entirely when a pattern matches. OpenCode's plugin system (`Plugin.trigger()`) can modify data flowing through hooks, but it **cannot break the LLM loop**. A plugin would still send the pattern match back to the LLM and burn tokens.

2. **Shell mode integration.** CyxCode adds pattern matching to `SessionPrompt.shell()` — the `!` command path. This is a core session function, not a plugin hook point. There is no plugin event for "shell command completed."

3. **The bash tool needs internal changes.** CyxCode adds `cyxcodeMatched` metadata to tool results and modifies how outputs are constructed. The plugin system can hook into `shell.env` (environment variables) and `experimental.text.complete` (text post-processing), but not tool result metadata.

4. **Initialization timing matters.** CyxCode must initialize its pattern router inside the bash tool's module context (due to Bun's `--conditions=browser` creating separate module instances). This requires `import` statements in core files, not runtime plugin registration.

In short: plugins can decorate behavior, but CyxCode needs to **change control flow**. That requires a fork.

### Supported Error Categories

CyxCode matches errors across **16 categories** in 3 skills:

> **Node** | **Git** | **Python** | **Docker** | **Build** | **System** | **SSL** | **Auth** | **SSH** | **Network** | **Scan** | **Kubernetes** | **Terraform** | **CI/CD** | **Cloud** | **Ansible**

### FAQ

#### How is this different from Claude Code / Cursor?

CyxCode is built on [OpenCode](https://opencode.ai), which is similar to Claude Code in capability. Key differences:

- 100% open source
- Not coupled to any provider — works with Claude, OpenAI, Google, or local models
- **136 error patterns that skip the LLM entirely** — no other tool does this
- Out-of-the-box LSP support
- TUI-first design
- Client/server architecture for remote access

---

## How Token Savings Work

### The Problem

Every time an AI coding tool encounters an error, it sends the full error output to an LLM for analysis. A typical error handling cycle looks like this:

1. **Input tokens**: The error output (~100-500 tokens), system prompt (~500 tokens), conversation context (~200 tokens)
2. **Output tokens**: The LLM's diagnosis and suggestion (~200-400 tokens)
3. **Total cost per error**: ~800-1600 tokens

For common errors like "module not found" or "port already in use", the LLM is doing the same work over and over — analyzing a known error pattern and giving the same suggestion every time.

### CyxCode's Solution

CyxCode intercepts errors **before** they reach the LLM. Here's what happens inside:

1. A bash command fails (non-zero exit code)
2. The `SkillRouter` in `src/cyxcode/router.ts` receives the error output
3. It runs the output against all 136 regex patterns across 3 skills
4. **If a pattern matches**: The fix is appended to the output with a `[CyxCode]` label. The AI sees the pre-diagnosed fix and doesn't need to spend tokens analyzing the error — it can just relay the suggestion
5. **If no pattern matches**: The error passes through to the LLM normally

### Token Estimation

The `BaseSkill` class (`src/cyxcode/base-skill.ts`) estimates tokens saved per match:

```
Tokens saved = (error output length / 4) + 500 (context) + 200 (response)
```

This is a conservative estimate. In practice, the LLM often needs multiple turns to diagnose and fix an error, multiplying the token cost.

### Expected Savings

| Scenario | Without CyxCode | With CyxCode | Savings |
|----------|-----------------|--------------|---------|
| npm module not found | ~700 tokens | 0 tokens | **100%** |
| git push rejected | ~500 tokens | 0 tokens | **100%** |
| Docker daemon error | ~600 tokens | 0 tokens | **100%** |
| SSL cert expired | ~800 tokens | 0 tokens | **100%** |
| Terraform state lock | ~900 tokens | 0 tokens | **100%** |
| Kubernetes pod crash | ~1000 tokens | 0 tokens | **100%** |

**136 patterns = 136 common errors that never need LLM tokens.**

---

## How to Tell Pattern Match vs AI

When a command fails in CyxCode, look for the `[CyxCode]` prefix in the response. This means a pattern matched and the **LLM was completely skipped** — zero tokens burned on the return trip.

### Pattern matched (free, LLM skipped):

```
$ python3 -c 'import flask'
ModuleNotFoundError: No module named 'flask'

[CyxCode] Pattern matched: python-module-not-found (recovery)
[CyxCode] Python module not found
[CyxCode] Suggested fixes:
1. Install with pip
  pip install flask
2. Install with pip3
  pip3 install flask
3. Install with pipx (for CLI tools)
  pipx install flask
[CyxCode] Tokens saved by pattern match (no LLM needed for diagnosis)
```

No "Thinking:" block on the response. No AI analysis. Cost: **$0.00**.

### No pattern match (AI handles it, costs tokens):

```
$ some-obscure-command --with-unusual-flags
Error: unexpected configuration in /etc/something.conf

(no [CyxCode] lines — the AI analyzes this and responds normally)
```

**Rule of thumb**: `[CyxCode]` visible = free fix, LLM skipped. No `[CyxCode]` = AI handled it.

---

## What Happens Behind the Scenes

Here's the full lifecycle of an error in CyxCode:

```
1. User types a command (e.g. python3 -c 'import flask')
                |
                v
2. LLM CALL #1 (unavoidable)
   AI thinks: "Let me run this command for them"
   AI calls the bash tool
   (This is the "Thinking:" you see in the screenshot)
                |
                v
3. Bash tool executes the command
   (src/tool/bash.ts)
                |
                v
4. Command exits with non-zero code?
   - No  -> return output normally to LLM
   - Yes -> continue to step 5
                |
                v
5. CYXCODE INTERCEPTS (before AI sees the error)
   SkillRouter.findMatching(output) called
   (src/cyxcode/router.ts)
                |
                v
6. Router checks all 136 patterns across 3 skills:
   - Recovery (51 patterns: node, git, build, docker, python, system)
   - Security (39 patterns: ssl, auth, ssh, network, scan)
   - DevOps   (46 patterns: kubernetes, terraform, cicd, cloud, ansible)
                |
                v
7. Pattern matched?
                |
       +--------+--------+
       |                  |
      YES                 NO
       |                  |
       v                  v
8a. SHORT-CIRCUIT       8b. FALL THROUGH
    - Append [CyxCode]     - Output passes to LLM
      fix to output         - LLM CALL #2 happens
    - Set cyxcodeMatched    - AI analyzes the error
      = true                - AI burns tokens
    - prompt.ts detects     - Normal response
      the flag
    - Inject fix text
      directly as response
    - SKIP LLM CALL #2
    - Zero tokens burned
    - $0.00 cost
```

**Key insight**: The first "Thinking:" you see in the screenshot is LLM Call #1 (the AI deciding to run the command). This is unavoidable. What CyxCode eliminates is **LLM Call #2** — where the AI would normally read the error output, think about it, and generate a diagnosis. For matched patterns, that second call never happens.

### Architecture

```
                        CYXCODE
    +--------------------------------------------------+
    |                  Skill Router                     |
    |   (src/cyxcode/router.ts)                        |
    |   Match error -> Find patterns -> Suggest fix    |
    +--------------------------------------------------+
                           |
        +------------------+------------------+
        v                  v                  v
  +-----------+      +-----------+      +-----------+
  |  Recovery |      | Security  |      |  DevOps   |
  |  51 ptns  |      |  39 ptns  |      |  46 ptns  |
  +-----------+      +-----------+      +-----------+
       |                  |                  |
  node, git,         ssl, auth,         k8s, tf,
  build, docker,     ssh, network,      cicd, cloud,
  python, system     scan               ansible
```

### Key Source Files

| File | Purpose |
|------|---------|
| `src/cyxcode/router.ts` | Singleton SkillRouter — routes errors to matching skills |
| `src/cyxcode/base-skill.ts` | BaseSkill class — pattern matching, fix execution, token estimation |
| `src/cyxcode/types.ts` | TypeScript types: Pattern, Fix, PatternMatch, SkillContext, SkillResult |
| `src/cyxcode/index.ts` | Initializes and registers all 3 skills |
| `src/tool/bash.ts` | Bash tool integration — calls SkillRouter on command failure, initializes CyxCode |
| `src/flag/flag.ts` | Feature flags including `CYXCODE_DEBUG` for debug output |
| `src/cyxcode/skills/recovery/` | Recovery skill patterns (node, git, build, docker, python, system) |
| `src/cyxcode/skills/security/` | Security skill patterns (ssl, auth, ssh, network, scan) |
| `src/cyxcode/skills/devops/` | DevOps skill patterns (kubernetes, terraform, cicd, cloud, ansible) |

---

## Skills (3 Deep, Not 700 Wide)

### Recovery Skill — 51 patterns

Handles known build, runtime, and development environment errors. Zero LLM tokens for common developer mistakes.

| Category | Patterns | What it catches |
|----------|----------|-----------------|
| Node/npm | 9 | `Cannot find module`, `EACCES`, peer dep conflicts, `ENOENT package.json`, registry errors, TypeScript module errors, corrupted `node_modules`, port in use |
| Git | 9 | Merge conflicts, push rejected (non-fast-forward), uncommitted changes, not a git repo, auth failed, branch not found, detached HEAD, diverged branches, untracked overwrite |
| Build | 8 | CMake not found, linker errors (`undefined reference`), compiler not found, make failures, `pkg-config` missing, out of memory during build, configure failures |
| Docker | 8 | Daemon not running, port already allocated, image not found, build failures, volume mount errors, network conflicts, permission denied, disk space |
| Python | 8 | `ModuleNotFoundError`, venv activation, pip permission errors, version conflicts, encoding errors (`UnicodeDecodeError`), `ImportError`, syntax errors, missing `__init__.py` |
| System | 9 | Permission denied, disk full, OOM killer, command not found, too many open files, connection refused, DNS resolution, segfault, zombie processes |

### Security Skill — 39 patterns

Catches SSL, authentication, SSH, network, and vulnerability scan output.

| Category | Patterns | What it catches |
|----------|----------|-----------------|
| SSL/TLS | 7 | Certificate expired, self-signed cert, untrusted CA, handshake failure, protocol version mismatch, certificate revoked, hostname mismatch |
| Auth | 8 | HTTP 401/403, OAuth token expired, CORS errors, rate limiting (429), invalid API key, JWT expired, session timeout, CSRF token mismatch |
| SSH | 7 | `Permission denied (publickey)`, host key verification failed, SSH agent not running, connection timeout, key format errors, `known_hosts` conflict, port 22 refused |
| Network | 8 | Firewall blocking, VPN tunnel down, CSP violations, HSTS errors, DNS-over-HTTPS failures, proxy auth required, MTU issues, connection reset |
| Scans | 9 | SQL injection detected, XSS found, vulnerable dependency (CVE), exposed secrets/API keys, insecure config, outdated/EOL software, weak crypto (MD5/SHA1), directory traversal, SSRF |

### DevOps Skill — 46 patterns

Handles Kubernetes, Terraform, CI/CD, cloud provider, and Ansible errors.

| Category | Patterns | What it catches |
|----------|----------|-----------------|
| Kubernetes | 10 | Context not found, connection refused, pod not found, `ImagePullBackOff`, `CrashLoopBackOff`, OOMKilled, RBAC forbidden, pod pending/unschedulable, invalid YAML, service no endpoints |
| Terraform | 9 | State lock, dependency cycles, backend init errors, provider not found, import conflicts, plan/apply drift, variable validation, resource already exists, state corruption |
| CI/CD | 9 | GitHub Actions syntax errors, runner offline, cache miss, artifact upload failure, secret not found, workflow timeout, matrix strategy errors, permissions errors, checkout failures |
| Cloud | 10 | AWS credential errors, GCP auth failures, Azure login expired, S3 bucket permissions, EC2 instance limits, Lambda timeout, quota exceeded, region not enabled, IAM policy errors, billing alerts |
| Ansible | 8 | Host unreachable, vault password wrong, undefined variable, module not found, SSH connection failed, become/sudo errors, syntax errors, handler not found |

---

## Pattern Anatomy

Every pattern in CyxCode follows this structure:

```typescript
{
  id: "node-module-not-found",           // Unique identifier
  regex: /Cannot find module '([@\w\/-]+)'/,  // Regex to match error output
  category: "node",                       // Grouping category
  description: "Node.js module not found", // Human-readable description
  extractors: { module: 0 },             // Map capture groups to names
  fixes: [                               // Ordered list of fixes
    {
      id: "npm-install",
      command: "npm install $1",          // $1 = first regex capture
      description: "Install missing module with npm",
      priority: 1                         // Lower = try first
    },
    {
      id: "yarn-add",
      command: "yarn add $1",
      description: "Install missing module with yarn",
      priority: 2
    }
  ]
}
```

Key concepts:
- **`regex`**: The pattern that matches against error output. Uses JavaScript regex with capture groups
- **`extractors`**: Maps capture group indices to named variables for logging/debugging
- **`$1`, `$2`**: In fix commands, these are replaced with regex capture groups. So `npm install $1` becomes `npm install express` if the error was `Cannot find module 'express'`
- **`priority`**: Fixes are sorted by success rate (if tracked) then priority. Lower numbers tried first
- **`command` vs `instructions`**: Fixes with `command` can be auto-executed. Fixes with `instructions` are manual guidance

---

## Installation

### Prerequisites

- [Bun](https://bun.sh/) v1.3+ (for older CPUs without AVX2, use the [baseline build](https://github.com/oven-sh/bun/releases) — download `bun-linux-x64-baseline.zip`)
- An API key for Claude or GPT-4

### Setup

```bash
# Clone the repository
git clone https://github.com/code3hr/cyxcode.git
cd cyxcode

# Install dependencies
bun install

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...    # Claude (recommended)
# or
export OPENAI_API_KEY=sk-...           # GPT-4

# Run CyxCode
bun run dev
```

---

## Debug Mode

CyxCode includes a debug mode that shows the internal state of the pattern matching engine. This is useful for verifying that skills are loaded and patterns are being checked.

```bash
# Enable debug output
CYXCODE_DEBUG=1 bun run dev

# Or export it
export CYXCODE_DEBUG=true
bun run dev
```

When enabled, you'll see messages like:

```
[CYXCODE] Router skills count: 3 globalThis set: true
```

This confirms:
- **Router skills count: 3** — All 3 skills (Recovery, Security, DevOps) are loaded with 136 patterns
- **globalThis set: true** — The router is properly initialized across module boundaries

Debug output is off by default. Set `CYXCODE_DEBUG=1` or `CYXCODE_DEBUG=true` to enable.

---

## Running CyxCode

CyxCode has multiple modes of operation depending on your needs.

### 1. TUI Mode (Default)

The terminal user interface — a full-screen interactive AI agent in your terminal.

```bash
bun run dev
# or after building:
cyxcode
```

This starts the TUI with the CyxCode logo, prompt input, and all pattern matching active. Use keyboard shortcuts to navigate (see below).

### 2. Headless Server Mode

Run CyxCode as a background API server without any UI. Useful for integrations, CI/CD, or remote access.

```bash
cyxcode serve
cyxcode serve --port 4096
cyxcode serve --hostname 0.0.0.0 --port 4096    # Listen on all interfaces
cyxcode serve --mdns                              # Enable mDNS discovery
```

The server exposes a full REST API at `http://localhost:<port>` with endpoints for sessions, messages, tools, and the pentest dashboard.

To secure the server, set a password:

```bash
export CYXCODE_SERVER_PASSWORD=your-secret-password
cyxcode serve --port 4096
```

### 3. Web Interface Mode

Starts the server and opens the web UI in your browser automatically.

```bash
cyxcode web
cyxcode web --port 4096
cyxcode web --hostname 0.0.0.0    # Accessible from other machines on your network
```

Output:

```
  Local access:       http://localhost:4096
  Network access:     http://192.168.1.100:4096
```

The web interface provides a browser-based REPL where you can interact with CyxCode the same way you would in the TUI — send prompts, run commands, view tool output, and see `[CyxCode]` pattern matches.

### 4. CLI Run Mode (Non-Interactive)

Send a single message and get a response without entering the TUI. Great for scripting and automation.

```bash
# Send a message
cyxcode run "fix the login bug in auth.ts"

# Continue the last session
cyxcode run -c "now add tests for it"

# Attach a file
cyxcode run -f config.json "what's wrong with this config?"

# Use a specific model
cyxcode run -m anthropic/claude-sonnet-4-20250514 "explain this code"

# Output as JSON (for piping)
cyxcode run --format json "list all TODO comments"

# Attach to a running server
cyxcode run --attach http://localhost:4096 "check for vulnerabilities"
```

### 5. Attach Mode

Connect a TUI to an already running CyxCode server (started with `serve` or `web`).

```bash
# Start server in one terminal
cyxcode serve --port 4096

# Attach from another terminal (or another machine)
cyxcode attach http://localhost:4096
```

---

## Security Dashboard & Reports

CyxCode includes a built-in security dashboard for viewing pentest findings, scan results, and compliance reports.

### Accessing the Dashboard

The dashboard is served as part of the web interface:

```bash
cyxcode web --port 4096
# Dashboard available at http://localhost:4096/dashboard
```

### Dashboard Features

The dashboard (`src/dashboard/`) is a SolidJS web app that shows:

- **Security Overview**: Total findings, critical/high open issues, scans in last 24h, mitigations in last 7 days
- **Severity Distribution**: Pie chart of findings by severity (critical, high, medium, low, info)
- **Finding Status**: Bar chart showing open, confirmed, mitigated, and false positive counts
- **Trend Charts**: 30-day trend of findings created vs mitigated
- **Active Monitors**: Number of active security monitors running
- **Quick Actions**: Links to open findings, compliance assessments, and report generation

### Generating Reports

Reports can be generated through the dashboard UI or via the API.

#### Via the Dashboard UI

Navigate to the Reports page in the dashboard:

1. Select report type: **Executive Summary**, **Technical Report**, or **Compliance Report**
2. Optionally filter by severity (critical, high, medium, low, info) and status (open, confirmed, mitigated, false_positive)
3. For compliance reports, select a framework: **PCI-DSS**, **HIPAA**, or **SOC2**
4. Click "Generate Report"
5. Download as JSON

#### Via the API

```bash
# Generate an executive summary
curl -X POST http://localhost:4096/dashboard/pentest/reports \
  -H "Content-Type: application/json" \
  -d '{"type": "executive"}'

# Generate a technical report filtered by severity
curl -X POST http://localhost:4096/dashboard/pentest/reports \
  -H "Content-Type: application/json" \
  -d '{"type": "technical", "filters": {"severity": ["critical", "high"]}}'

# Generate a PCI-DSS compliance report
curl -X POST http://localhost:4096/dashboard/pentest/reports \
  -H "Content-Type: application/json" \
  -d '{"type": "compliance", "framework": "pci-dss"}'

# Retrieve a generated report
curl http://localhost:4096/dashboard/pentest/reports/<report-id>
```

#### Report Types

| Type | Purpose | Contents |
|------|---------|----------|
| **Executive** | High-level overview for stakeholders | Risk score, severity breakdown, top targets, recommendations |
| **Technical** | Detailed findings for security teams | Full findings grouped by target, with evidence, CVEs, remediation steps |
| **Compliance** | Framework-specific assessment | Compliance percentage, passed/failed controls, gaps, remediation priorities |

### Dashboard API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dashboard/pentest/findings` | GET | List findings with filters (severity, status, target) |
| `/dashboard/pentest/findings/:id` | GET | Get a single finding |
| `/dashboard/pentest/findings/:id` | PATCH | Update finding status/notes |
| `/dashboard/pentest/findings/:id` | DELETE | Delete a finding |
| `/dashboard/pentest/scans` | GET | List scans |
| `/dashboard/pentest/scans/:id` | GET | Get scan details |
| `/dashboard/pentest/stats/overview` | GET | Dashboard overview statistics |
| `/dashboard/pentest/stats/severity` | GET | Severity distribution |
| `/dashboard/pentest/stats/trends?days=30` | GET | Finding trends over time |
| `/dashboard/pentest/monitors` | GET | List active monitors |
| `/dashboard/pentest/monitors/:id/run` | POST | Trigger immediate monitor run |
| `/dashboard/pentest/monitors/:id/runs` | GET | Monitor run history |
| `/dashboard/pentest/reports` | POST | Generate a report |
| `/dashboard/pentest/reports/:id` | GET | Retrieve a generated report |
| `/dashboard/pentest/compliance/frameworks` | GET | List compliance frameworks |
| `/dashboard/pentest/compliance/:framework` | GET | Get framework controls |
| `/dashboard/pentest/compliance/:framework/assess` | POST | Run compliance assessment |

---

### AVX2 Note

If you get an "Illegal instruction" crash, your CPU doesn't support AVX2 (common on pre-2013 Intel CPUs). Install the Bun baseline build:

```bash
# Download and install baseline Bun (no AVX2 required)
curl -fsSL -o /tmp/bun-baseline.zip \
  "https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64-baseline.zip"
unzip -o /tmp/bun-baseline.zip -d /tmp
mkdir -p ~/.bun/bin
cp /tmp/bun-linux-x64-baseline/bun ~/.bun/bin/bun
chmod +x ~/.bun/bin/bun
export PATH="$HOME/.bun/bin:$PATH"
```

---

## Keyboard Shortcuts

### Navigation

| Key | Action |
|-----|--------|
| `PageUp` | Scroll up (half page) |
| `PageDown` | Scroll down (half page) |
| `Ctrl+Alt+U` | Scroll up (quarter page) |
| `Ctrl+Alt+D` | Scroll down (quarter page) |
| `Home` / `Ctrl+G` | Jump to first message |
| `End` / `Ctrl+Alt+G` | Jump to last message |

### General

| Key | Action |
|-----|--------|
| `Ctrl+T` | Switch model variants |
| `Tab` | Switch agents |
| `Ctrl+P` | Open command palette |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CYXCODE_DEBUG` | `false` | Show CyxCode debug output (router state, pattern matching) |
| `CYXCODE_SHORT_CIRCUIT` | `true` | Skip LLM when pattern matches. Set to `false` to always send to AI |
| `ANTHROPIC_API_KEY` | — | Claude API key (recommended) |
| `OPENAI_API_KEY` | — | OpenAI API key (alternative) |

---

## Adding Custom Patterns

CyxCode's pattern system is extensible. Add your own error patterns to catch project-specific errors:

```typescript
{
  id: "my-custom-error",
  regex: /specific error message: (.+)/i,
  category: "node",
  description: "What went wrong",
  fixes: [
    { id: "fix-1", command: "npm run fix $1", description: "Run the fix", priority: 1 },
  ],
}
```

Full guide with examples, tips, and file locations: **[Adding Patterns](docs/ADDING-PATTERNS.md)**

---

## Contributing Patterns

The more patterns CyxCode has, the more errors it catches for free. We especially want patterns for:

> **Bun** | **Rust/Cargo** | **Go** | **Ruby/Rails** | **Java/Gradle** | **Swift/Xcode** | **.NET/NuGet**

See the full contributing guide: **[Contributing Patterns](docs/CONTRIBUTING-PATTERNS.md)**

---

## Before/After: CyxCode vs Standard AI

The same `ModuleNotFoundError` handled three ways:

| Mode | LLM Calls | Tokens | Time | Cost |
|------|-----------|--------|------|------|
| Standard AI (no CyxCode) | 2 | ~1,200 | ~5-6s | ~$0.002 |
| CyxCode Normal Mode | 1 (short-circuit) | ~600 | ~3-4s | ~$0.001 |
| CyxCode Shell Mode (`!`) | **0** | **0** | **instant** | **$0.00** |

Full side-by-side comparison with Git, Docker, and Python examples: **[Before/After](docs/BEFORE-AFTER.md)**

---

## Performance

| Mode | Error diagnosed by | Response time | Token cost |
|------|-------------------|---------------|------------|
| Shell (`!`) + pattern match | CyxCode | **Instant** (~50ms) | **$0.00** |
| Normal + pattern match | CyxCode (short-circuit) | ~3-5s (LLM Call #1 only) | **~50% less** |
| Normal + no match | AI | ~5-8s (LLM Call #1 + #2) | Full cost |
| Shell (`!`) + no match | None (raw output) | **Instant** | **$0.00** |

Detailed benchmarks and session savings estimates: **[Performance](docs/PERFORMANCE.md)**

---

## Comparison

### vs OpenClaw

| | OpenClaw | CyxCode |
|--|----------|---------|
| Skills | 700+ thin | 3 deep |
| Patterns | 0 | 136 |
| Error handling | LLM always decides | Patterns first, LLM fallback |
| Token cost | High (every error costs) | **~80% lower** (136 errors are free) |
| Error visibility | AI response only | `[CyxCode]` labels show pattern matches |

### vs Claude Code / Cursor

| | Claude Code / Cursor | CyxCode |
|--|----------------------|---------|
| Error handling | LLM every time | Pattern library handles known errors |
| Built-in domain knowledge | None | 136 patterns across 16 categories |
| Token savings | None | **136 common errors handled for free** |
| Error diagnosis speed | Depends on LLM latency | Instant for pattern matches |

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Skill interface + router | **Done** |
| 2 | Recovery skill (51 patterns) | **Done** |
| 3 | Security skill (39 patterns) | **Done** |
| 4 | DevOps skill (46 patterns) | **Done** |
| 5 | Bash tool integration | **Done** |
| 6 | Visible `[CyxCode]` pattern indicators | **Done** |
| 7 | Debug mode (`CYXCODE_DEBUG=1`) | **Done** |
| 8 | LLM short-circuit on pattern match | **Done** |
| 9 | Shell mode (`!`) zero-token matching | **Done** |
| 10 | Capture substitution (`$1` -> actual values) | **Done** |
| 11 | Track token savings | Next |
| 12 | Community patterns (Bun, Rust, Go, Ruby) | Planned |
| 13 | Auto-execute fixes (with approval) | Planned |

---

## License

MIT License — See [LICENSE](LICENSE)

---

**Tokens are the new currency. CyxCode makes sure you don't waste them.**

**CyxCode** — *We automate the AI that automates us.*

*136 patterns. Zero tokens. Depth over breadth.*
