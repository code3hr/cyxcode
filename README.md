# Wiz (cyxwiz)

> **Your AI Security Partner** - Just describe what you need. No commands to memorize. No syntax to learn.

[![Release](https://img.shields.io/github/v/release/code3hr/opencode?label=Download&color=green)](https://github.com/code3hr/opencode/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux-FCC624)](https://www.linux.org/)
[![Platform: macOS](https://img.shields.io/badge/Platform-macOS-000000)](https://www.apple.com/macos/)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6)](https://www.microsoft.com/windows)

---

## Why Wiz Exists

Security testing shouldn't require memorizing hundreds of tool flags and command syntaxes.

Think about it: **nmap** has 130+ options. **Nuclei** has dozens of flags. **SQLMap** has over 100 parameters. Now multiply that by the 30+ tools a typical assessment requires. That's not security work - that's a memorization exercise.

**Wiz takes a different approach.** Instead of learning tool syntax, you simply describe what you want to accomplish. The AI understands your intent and figures out which tools to use, how to chain them, and how to interpret the results.

```
You: "check if this server is vulnerable to log4j"

Wiz: Checking 192.168.1.10 for Log4Shell vulnerability...
     [Running nuclei with CVE-2021-44228 templates]

     Found: CRITICAL - Log4Shell (CVE-2021-44228) confirmed
     The server is vulnerable to remote code execution via JNDI injection.

     Recommendation: Upgrade log4j to 2.17.1+ or apply mitigations immediately.
```

No flags to remember. No syntax to look up. Just describe what you need.

---

## What Wiz Does

Wiz is an AI-powered security operations assistant. You talk to it in plain English, and it:

1. **Understands your intent** - Whether you say "scan for open ports" or "what services are running" - same result
2. **Selects the right tools** - Picks nmap, nuclei, nikto, or whatever fits the task
3. **Chains operations intelligently** - Finds a web server? Automatically suggests vulnerability checks
4. **Explains results clearly** - No raw output dumps, just actionable insights
5. **Tracks everything** - Every finding, every command, ready for your report

### Talk, Don't Type Commands

Here's how a real conversation with Wiz looks:

```
You: "I need to test this web application at https://target.com"

Wiz: I'll start with reconnaissance. Let me:
     1. Check what technologies it's running
     2. Look for common vulnerabilities
     3. Test the authentication mechanisms

     Starting now...

     [After scanning]

     Here's what I found:
     - Running WordPress 5.8.1 (outdated - current is 6.4)
     - 3 plugins with known vulnerabilities
     - Admin login page exposed at /wp-admin
     - No rate limiting on login attempts

     Want me to dig deeper into any of these?

You: "yes, check those plugin vulnerabilities"

Wiz: Looking at the vulnerable plugins...

     CRITICAL: Contact Form 7 < 5.3.2 - Unrestricted file upload
     HIGH: Elementor < 3.1.2 - Authenticated XSS
     MEDIUM: WooCommerce < 5.2.0 - Information disclosure

     The file upload vulnerability is serious. With a valid form submission,
     an attacker could upload malicious PHP files.

     Should I generate a detailed report with remediation steps?
```

### What You Can Ask

Just describe what you need in your own words:

- *"find all the web servers on this network"*
- *"is this site vulnerable to SQL injection?"*
- *"check the SSL configuration on our servers"*
- *"what users exist in this Active Directory domain?"*
- *"test if this API has authentication issues"*
- *"show me everything you've found so far"*
- *"write up a report for the client"*

Wiz understands context too. After scanning a network, you can say *"check that Apache server for vulnerabilities"* - it knows which one you mean.

---

## Why Wiz? Why Not Claude CLI or Other LLM Tools?

Yes, Claude CLI, Cursor, and other LLM tools can run commands too. So what makes Wiz different?

### The Foundation: OpenCode Agent

Wiz is built on [OpenCode](https://github.com/sst/opencode), which provides a superior agent architecture compared to generic LLM CLIs:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Generic LLM CLI vs Wiz (OpenCode-based)                   │
├─────────────────────────────────┬───────────────────────────────────────────┤
│       Generic LLM CLI           │              Wiz                           │
├─────────────────────────────────┼───────────────────────────────────────────┤
│ General-purpose agent           │ Security-focused agent                    │
│ Raw command output              │ Parsed, structured findings               │
│ No domain knowledge             │ Security tool expertise built-in          │
│ Basic bash execution            │ Specialized tool integrations             │
│ Chat history only               │ Findings database + audit trail           │
│ No scope awareness              │ Governance & scope enforcement            │
│ Export chat transcript          │ Professional pentest reports              │
└─────────────────────────────────┴───────────────────────────────────────────┘
```

### What OpenCode Gives Us (That Others Don't)

1. **Better Agent Control** - OpenCode's architecture gives finer control over LLM behavior, tool execution, and context management than Claude CLI's generic approach

2. **Extensible Tool Framework** - Not just "run bash commands" but structured tool definitions with typed inputs/outputs

3. **Session Persistence** - Real session management, not just chat history

4. **Multi-LLM Support** - Claude, GPT-4, Gemini, local models - your choice

### What Wiz Adds on Top

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Wiz Security Layer                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Security   │  │   Output     │  │   Findings   │  │   Report     │    │
│  │    Tools     │  │   Parsers    │  │   Database   │  │   Engine     │    │
│  │              │  │              │  │              │  │              │    │
│  │ nmap, nikto  │  │ Extract CVEs │  │ Severity     │  │ Executive    │    │
│  │ nuclei, etc  │  │ Parse JSON   │  │ OWASP cats   │  │ Technical    │    │
│  │ 30+ tools    │  │ Structure    │  │ Evidence     │  │ HTML/PDF/MD  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │  Governance  │  │    Scope     │  │    Audit     │                      │
│  │   Engine     │  │ Enforcement  │  │    Trail     │                      │
│  │              │  │              │  │              │                      │
│  │ Policy-based │  │ Authorized   │  │ Compliance   │                      │
│  │ approval     │  │ targets only │  │ logging      │                      │
│  └──────────────┘  └──────────────┘  └──────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Real Example: The Difference

**Claude CLI:**
```
You: "scan 192.168.1.10 for vulnerabilities"

Claude: *runs nmap*
        Here's the raw output:
        PORT   STATE SERVICE VERSION
        80/tcp open  http    Apache 2.4.41
        443/tcp open  ssl/http Apache 2.4.41
        ...

You: "what vulnerabilities does it have?"

Claude: *runs nikto*
        Here's what nikto found:
        + Server: Apache/2.4.41
        + /: The anti-clickjacking X-Frame-Options header is not present
        ...

        [You manually track these, decide severity, write report]
```

**Wiz:**
```
You: "scan 192.168.1.10 for vulnerabilities"

Wiz: [Runs nmap → parses services]
     [Runs nikto → extracts findings]
     [Runs nuclei → matches CVEs]
     [Classifies by severity]
     [Stores in findings database]

     Scan complete. Found:

     CRITICAL (1):
     - CVE-2021-41773: Apache path traversal → RCE possible

     HIGH (2):
     - Missing security headers (X-Frame-Options, CSP)
     - SSL certificate expires in 7 days

     MEDIUM (3):
     - Directory listing enabled on /uploads
     - Server version disclosed
     - Outdated Apache version

     All 6 findings saved with evidence.

You: "generate report"

Wiz: [Creates executive summary]
     [Includes technical details]
     [Adds remediation steps]
     [Exports to HTML]

     Report ready: http://localhost:4096/reports/192.168.1.10-assessment.html
```

### Summary

| Feature | Claude CLI | Wiz |
|---------|------------|-----|
| **Agent Architecture** | Generic | OpenCode (superior control) |
| **Tool Integration** | Bash only | 30+ security tools with parsers |
| **Output Handling** | Raw text | Structured findings |
| **Severity Classification** | Manual | Automatic (Critical→Info) |
| **CVE Matching** | Manual lookup | Automatic detection |
| **Scope Control** | None | Governance engine |
| **Audit Trail** | Chat history | Compliance-ready logs |
| **Reports** | Copy-paste chat | Professional HTML/PDF |

**Wiz = OpenCode's superior agent + Security expertise + Findings management + Governance + Reporting**

---

## What Wiz Is NOT

Let's be clear about boundaries:

### Not a Replacement for Your Judgment

Wiz is a tool, not a security expert replacement. It doesn't:
- Make risk decisions for your organization
- Determine what's in scope for your engagement
- Replace the need to understand what you're doing
- Guarantee finding every vulnerability

**You** are the security professional. Wiz handles the tedious parts so you can focus on analysis and decisions.

### Not for Malicious Use

Wiz is built for:
- Authorized penetration testing
- Security assessments with written permission
- CTF competitions and security research
- Learning and education

It is NOT for:
- Unauthorized access to systems
- Attacking systems you don't own or have permission to test
- Any illegal activity

**The tools Wiz uses are powerful. Use them responsibly and legally.**

### Not a Magic Button

Wiz won't:
- Automatically hack anything
- Replace proper methodology
- Skip the need for authorization
- Make you compliant just by running it

It's an assistant that makes security work more efficient - not a shortcut around doing things properly.

---

## Installation

### Download Pre-built Binaries

The easiest way to get started. Download for your platform:

| Platform | Download |
|----------|----------|
| Linux (x64) | [cyxwiz-linux-x64.tar.gz](https://github.com/code3hr/opencode/releases/latest/download/cyxwiz-linux-x64.tar.gz) |
| Linux (ARM64) | [cyxwiz-linux-arm64.tar.gz](https://github.com/code3hr/opencode/releases/latest/download/cyxwiz-linux-arm64.tar.gz) |
| macOS (Intel) | [cyxwiz-darwin-x64.tar.gz](https://github.com/code3hr/opencode/releases/latest/download/cyxwiz-darwin-x64.tar.gz) |
| macOS (Apple Silicon) | [cyxwiz-darwin-arm64.tar.gz](https://github.com/code3hr/opencode/releases/latest/download/cyxwiz-darwin-arm64.tar.gz) |
| Windows (x64) | [cyxwiz-windows-x64.zip](https://github.com/code3hr/opencode/releases/latest/download/cyxwiz-windows-x64.zip) |

```bash
# Linux/macOS
tar -xzf cyxwiz-*.tar.gz
chmod +x cyxwiz
./cyxwiz

# Windows
# Extract the zip and run cyxwiz.exe
```

### Build from Source

```bash
# Install Bun (JavaScript runtime)
curl -fsSL https://bun.sh/install | bash

# Clone and build
git clone https://github.com/code3hr/opencode.git wiz
cd wiz
bun install
bun run --cwd packages/opencode src/index.ts
```

### Required: API Key

Wiz needs an AI provider to work. Set one of these:

```bash
export ANTHROPIC_API_KEY=sk-ant-...    # Claude (recommended)
# or
export OPENAI_API_KEY=sk-...           # GPT-4
```

### Recommended: Security Tools

For full functionality, have these tools installed (pre-installed on Kali/Parrot):

- **nmap** - Network scanning
- **nuclei** - Vulnerability scanning
- **nikto** - Web server scanning
- **gobuster** - Directory enumeration
- **sqlmap** - SQL injection testing

Don't have them? Wiz will tell you when it needs something.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YOU (Security Professional)                     │
│                                                                              │
│   "scan this network"    "check for vulnerabilities"    "generate report"   │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 WIZ                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         AI Engine (Claude/GPT)                       │    │
│  │                                                                      │    │
│  │   • Understands natural language intent                              │    │
│  │   • Plans tool sequences                                             │    │
│  │   • Interprets results                                               │    │
│  │   • Explains findings                                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                   │                                          │
│                                   ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Tool Orchestration                            │    │
│  │                                                                      │    │
│  │   Network    Web        API        AD          Reporting             │    │
│  │   Scanner    Scanner    Scanner    Scanner     Engine                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                   │                                          │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Security Tools (Kali/Parrot)                         │
│                                                                              │
│   nmap    nuclei    nikto    gobuster    sqlmap    smbclient    ldapsearch  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TARGET SYSTEMS                                  │
│                         (With your authorization)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Intent  │ ──▶ │   Plan   │ ──▶ │ Execute  │ ──▶ │ Findings │
│          │     │          │     │          │     │          │
│ "scan    │     │ 1. nmap  │     │ Run each │     │ Store &  │
│  for web │     │ 2. nikto │     │ tool in  │     │ classify │
│  vulns"  │     │ 3. nuclei│     │ sequence │     │ results  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                        │
                                                        ▼
                                                  ┌──────────┐
                                                  │  Report  │
                                                  │          │
                                                  │ Generate │
                                                  │ HTML/PDF │
                                                  └──────────┘
```

---

## Running Modes

Wiz offers multiple interfaces to fit your workflow:

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERFACES                               │
├─────────────────┬───────────────────┬───────────────────────────┤
│    Terminal     │   Web Server      │      Dashboard            │
│    (Default)    │   (--server)      │      (Development)        │
├─────────────────┼───────────────────┼───────────────────────────┤
│  ./cyxwiz       │  ./cyxwiz --server│  bun run dashboard        │
│                 │                   │                           │
│  Interactive    │  http://localhost │  http://localhost:5173    │
│  CLI prompt     │  :4096            │  (proxies to :4096)       │
│                 │                   │                           │
│  Best for:      │  Best for:        │  Best for:                │
│  Quick tasks,   │  Team access,     │  Development,             │
│  scripting      │  remote work      │  customization            │
└─────────────────┴───────────────────┴───────────────────────────┘
```

### Terminal (Default)

```bash
./cyxwiz
```

Interactive command-line interface. Type naturally and see results directly.

### Web Server (Port 4096)

```bash
./cyxwiz --server
```

Opens a web interface at **http://localhost:4096**. Features:
- Same AI assistant in a browser
- Real-time scan progress
- Interactive findings table
- Report viewing and export

### Dashboard (Port 5173 - Development)

```bash
cd packages/opencode/src/dashboard
bun run dev
```

Development dashboard at **http://localhost:5173**. For contributors extending Wiz.

### Web Reports

Reports are served through the web interface:

```
You: "generate a report"

Wiz: Report generated!
     View at: http://localhost:4096/reports/assessment-2024-01-15.html
```

Features:
- Interactive severity charts
- Sortable findings table
- Evidence screenshots
- Export to PDF/HTML/Markdown

---

## How It Works

### 1. You Describe, Wiz Executes

```
You: "find subdomains for example.com"

Wiz: I'll enumerate subdomains using multiple methods...

     Found 47 subdomains:
     - api.example.com (192.168.1.10)
     - mail.example.com (192.168.1.11)
     - dev.example.com (192.168.1.12)
     - staging.example.com (192.168.1.13)
     [... and 43 more]

     Notable: dev and staging are exposed to the internet.
     Want me to scan these for vulnerabilities?
```

### 2. Wiz Remembers Context

```
You: "scan the staging server"

Wiz: Scanning staging.example.com (192.168.1.13)...

     [Wiz remembers this from the previous subdomain scan]
```

### 3. Findings Are Tracked

```
You: "what have we found so far?"

Wiz: Current findings for example.com assessment:

     CRITICAL (2):
     - SQL injection on api.example.com/users
     - Exposed admin panel on staging.example.com

     HIGH (5):
     - Outdated TLS on mail.example.com
     - Missing security headers (4 instances)

     MEDIUM (8):
     [...]

     Total: 2 critical, 5 high, 8 medium, 12 low findings
```

### 4. Reports When You're Ready

```
You: "generate a report for the client"

Wiz: Generating executive report...

     Created: example-com-assessment-2024-01-15.html

     Includes:
     - Executive summary
     - Risk ratings
     - All findings with evidence
     - Remediation recommendations
     - Technical appendix
```

---

## Capabilities

### Network Security
- Port scanning and service detection
- Network mapping and host discovery
- Protocol-specific testing (SMB, SNMP, DNS, LDAP)
- Credential testing and password auditing

### Web Application Security
- Vulnerability scanning (OWASP Top 10)
- Directory and file enumeration
- SSL/TLS configuration analysis
- CMS vulnerability detection (WordPress, Drupal, etc.)

### API Security
- OpenAPI/Swagger discovery and parsing
- Authentication bypass testing
- Injection testing (SQL, NoSQL, Command)
- JWT analysis and manipulation

### Active Directory
- User and group enumeration
- Kerberoasting and AS-REP roasting
- Trust relationship mapping
- Privilege escalation path finding

### Reporting
- Executive summaries (HTML/PDF)
- Technical reports (Markdown)
- Raw data export (JSON)
- Evidence preservation

---

## Platform Support

| Distribution | Status | Notes |
|--------------|--------|-------|
| **Kali Linux** | Fully Supported | All tools pre-installed |
| **Parrot OS** | Fully Supported | All tools pre-installed |
| **Ubuntu/Debian** | Supported | Install tools via apt |
| **Arch Linux** | Supported | Install tools via pacman |
| **macOS** | Supported | Install tools via homebrew |
| **Windows** | Supported | Install tools via chocolatey/manual |

---

## Project Status

Wiz is under active development. Current capabilities:

| Module | Status | Description |
|--------|--------|-------------|
| Core Framework | Complete | AI interaction, session management |
| Network Scanning | Complete | Nmap integration, service detection |
| Web Scanning | Complete | Nikto, Nuclei, Gobuster, SQLMap |
| API Security | Complete | OpenAPI, GraphQL, JWT analysis |
| Active Directory | Complete | User enum, Kerberoasting |
| Reporting | Complete | Multiple formats, evidence |
| Cloud Security | In Progress | AWS, Azure, GCP scanning |
| CI/CD Security | In Progress | Pipeline security analysis |
| Container Security | Planned | Docker, Kubernetes |

---

## Documentation

### Core Docs
| Document | Description |
|----------|-------------|
| [PROJECT.md](docs/PROJECT.md) | Platform architecture and vision |
| [PENTEST.md](docs/PENTEST.md) | Pentest module overview |
| [GOVERNANCE.md](docs/GOVERNANCE.md) | Policy and scope enforcement |
| [TODO.md](docs/TODO.md) | Development roadmap |
| [COMPARISON.md](docs/COMPARISON.md) | How Wiz compares to other tools |

### Module Documentation (Phases)
| Phase | Module | Description |
|-------|--------|-------------|
| [03](docs/PHASE03-pentest-agent-mvp.md) | Pentest Agent MVP | Core scanning foundation |
| [04](docs/PHASE04-multi-tool-parsers.md) | Multi-Tool Parsers | Nikto, Nuclei, Gobuster parsers |
| [05](docs/PHASE05-report-generation.md) | Report Generation | HTML, PDF, Markdown reports |
| [06](docs/PHASE06-continuous-monitoring.md) | Continuous Monitoring | Scheduled scans, diff detection |
| [07](docs/PHASE07-exploit-framework.md) | Exploit Framework | Metasploit, Searchsploit integration |
| [08](docs/PHASE08-web-app-scanner.md) | Web App Scanner | OWASP Top 10, crawling |
| [09](docs/PHASE09-api-security-scanner.md) | API Security | OpenAPI, GraphQL, JWT testing |
| [10](docs/PHASE10-network-infrastructure.md) | Network Infrastructure | SMB, SNMP, DNS, LDAP |
| [11](docs/PHASE11-cloud-security.md) | Cloud Security | AWS, Azure, GCP scanning |
| [12](docs/PHASE12-container-security.md) | Container Security | Docker, Kubernetes, CVE lookup |
| [13](docs/PHASE13-mobile-app-scanner.md) | Mobile App Scanner | Android/iOS analysis |
| [14](docs/PHASE14-wireless-scanner.md) | Wireless Scanner | WiFi security testing |
| [15](docs/PHASE15-social-engineering.md) | Social Engineering | Phishing, pretexting toolkit |
| [16](docs/PHASE16-post-exploitation.md) | Post-Exploitation | Privilege escalation, persistence |
| [17](docs/PHASE17-reporting-dashboard.md) | Reporting Dashboard | Web UI for findings |
| [18](docs/PHASE18-cicd-security.md) | CI/CD Security | Pipeline security analysis |

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Security

Found a security issue? See [SECURITY.md](SECURITY.md).

---

## License

MIT License - See [LICENSE](LICENSE)

---

## Acknowledgments

- [OpenCode](https://github.com/sst/opencode) - The foundation we built upon
- [Anthropic](https://anthropic.com) - Claude AI
- The security community for the amazing open-source tools

---

**Wiz** - *Security testing should be about security, not syntax.*
