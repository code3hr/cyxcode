# Wiz

> **AI-Powered Security Operations Platform** - Speak your intent, tools execute with governance, results explained.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-orange)](https://bun.sh)
[![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude-purple)](https://anthropic.com)
[![Platform: Kali](https://img.shields.io/badge/Platform-Kali%20Linux-557C94)](https://kali.org)
[![Platform: Parrot](https://img.shields.io/badge/Platform-Parrot%20OS-00D9FF)](https://parrotsec.org)

---

## Problem Statement

Security professionals spend countless hours on repetitive tasks:

- **Manual Tool Orchestration** - Running nmap, then nikto, then sqlmap, copying outputs between tools
- **Context Switching** - Remembering flags, syntax, and output formats for dozens of tools
- **Documentation Overhead** - Manually logging every command and result for compliance
- **Scope Creep Risk** - Accidentally scanning out-of-scope targets during engagements
- **Knowledge Silos** - Junior team members can't leverage senior expertise embedded in workflows

**The result?** Slower assessments, inconsistent quality, audit gaps, and burned-out professionals.

---

## About

**Wiz** is an AI-powered operations platform that transforms how security professionals work. Built for **Kali Linux** and **Parrot OS**, it leverages the 600+ security tools already installed on these distributions. Instead of memorizing tool syntax and manually orchestrating workflows, you describe what you want to accomplish in natural language - and Wiz handles the rest.

```
$ wiz

> scan 192.168.1.0/24 for web vulnerabilities

[GOVERNANCE] Target within authorized scope. Proceeding.
[EXECUTING] nmap -sV -sC -p 80,443,8080,8443 192.168.1.0/24

Found 5 hosts with web services:
- 192.168.1.10: Apache 2.4.41 (HTTP/80, HTTPS/443)
- 192.168.1.15: nginx 1.18.0 (HTTP/80)
- 192.168.1.20: IIS 10.0 (HTTP/80, HTTPS/443)
...

[FINDING] Apache 2.4.41 on .10 has known CVEs. Recommend deeper scan.

> check .10 for CVE-2021-41773

[EXECUTING] nuclei -t cves/2021/CVE-2021-41773.yaml -u http://192.168.1.10

[CRITICAL] CVE-2021-41773 CONFIRMED - Path traversal vulnerability
           Impact: Remote code execution possible
           Remediation: Upgrade Apache to 2.4.51+

> generate report

[GENERATING] Executive summary with 3 critical, 5 high findings...
```

### Built on OpenCode

Wiz is a purpose-built fork of [OpenCode](https://github.com/sst/opencode) (MIT licensed), inheriting its excellent foundation:

- Multi-LLM support (Claude, GPT-4, Gemini, local models)
- Terminal UI with rich formatting
- Session management and context preservation
- Extensible tool framework

**What Wiz adds:**

- Governance engine with policy-based approval
- Scope enforcement for authorized targets only
- Comprehensive audit logging
- Security-focused tools with output parsers
- Structured findings management
- Professional report generation

---

## Key Features

### Governance Engine
Every action is evaluated against policies before execution. Define what's allowed, what needs approval, and what's blocked.

### Scope Enforcement
Define authorized targets (IPs, domains, ports). Wiz prevents accidental out-of-scope scanning - critical for compliance.

### Audit Trail
Every command, approval, and result is automatically logged. Export audit logs for compliance reporting.

### Security Tools Integration
Leverages 30+ security tools from Kali/Parrot with intelligent output parsing:

| Category | Tools |
|----------|-------|
| **Reconnaissance** | nmap, masscan, amass, subfinder |
| **Web Scanning** | nikto, nuclei, gobuster, ffuf, sqlmap |
| **Network Analysis** | SMB enumeration, SNMP walking, DNS zone transfers |
| **Active Directory** | User/group enumeration, Kerberoasting, AS-REP roasting |
| **API Security** | OpenAPI parsing, JWT analysis, BOLA/IDOR testing |
| **Exploitation** | searchsploit, msfconsole integration |

### Findings Management
Structured storage of all security findings with:
- Severity classification (Critical/High/Medium/Low/Info)
- OWASP/CVE categorization
- Evidence preservation
- Remediation tracking

### Report Generation
Professional reports in multiple formats:
- Executive Summary (PDF/HTML)
- Technical Details (Markdown)
- Raw Data (JSON)

---

## Installation

### Target Platforms

Wiz is designed for security-focused Linux distributions with pre-installed tools:

- **Kali Linux** (recommended) - All tools pre-installed
- **Parrot OS** - All tools pre-installed
- **Any Linux** - Install tools manually via package manager

### Prerequisites

- **Bun** (JavaScript runtime)
- **Security tools** (nmap, nikto, nuclei, etc.) - pre-installed on Kali/Parrot

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# Clone Wiz
git clone https://github.com/code3hr/opencode.git wiz
cd wiz

# Install dependencies
bun install

# Run Wiz
bun run --cwd packages/opencode src/index.ts
```

### Environment Setup

Create a `.env` file with your LLM API key:

```bash
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...
```

---

## Usage

### Starting a Session

```bash
# Start Wiz
bun run --cwd packages/opencode src/index.ts

# Or with alias
alias wiz="bun run --cwd /path/to/wiz/packages/opencode src/index.ts"
wiz
```

### Common Operations

```bash
# Network scanning
> scan 10.0.0.0/24 for open ports
> check 10.0.0.15 for vulnerabilities

# Web application testing
> enumerate subdomains for example.com
> scan https://target.com for OWASP Top 10

# Active Directory assessment
> enumerate users in corp.local domain
> find kerberoastable accounts

# API security testing
> discover APIs at https://api.target.com
> test authentication on the API

# Reporting
> show all critical findings
> generate executive report
```

### Governance Commands

```bash
> show scope           # Display authorized targets
> show audit log       # View recent actions
> show findings        # List all findings
```

---

## Project Structure

```
wiz/
├── README.md                    # This file
├── docs/
│   ├── PROJECT.md               # Platform architecture
│   ├── PENTEST.md               # Pentest module documentation
│   ├── GOVERNANCE.md            # Governance engine details
│   ├── PHASE[3-10].md           # Development phase docs
│   └── TODO.md                  # Roadmap
├── packages/
│   └── opencode/
│       └── src/
│           ├── pentest/         # Security testing modules
│           │   ├── nmap-tool.ts
│           │   ├── sectools.ts
│           │   ├── findings.ts
│           │   ├── webscan/
│           │   ├── apiscan/
│           │   ├── netscan/
│           │   ├── reports/
│           │   └── monitoring/
│           ├── governance/      # Governance engine
│           └── tool/            # Tool framework
└── test/                        # Test suites
```

---

## Current Status

### Completed

- **Core Framework** - Fork setup, build system, basic operations
- **Governance Engine** - Policy evaluation, scope enforcement, audit logging
- **Pentest Module** - Nmap integration, security tools wrapper, findings management
- **Parser Extensions** - Nikto, Nuclei, Gobuster, Ffuf, SSLScan output parsing
- **Report Generation** - Markdown, HTML, JSON report formats
- **Continuous Monitoring** - Scheduled scans with diff detection
- **Web Scanner** - Crawling, vulnerability detection, OWASP categorization
- **API Scanner** - OpenAPI/GraphQL discovery, JWT analysis, injection testing
- **Network Scanner** - AD enumeration, SMB/SNMP/DNS/LDAP testing, credential attacks

### In Progress

- Cloud security scanning (AWS, Azure, GCP)
- Container security (Docker, Kubernetes)
- CI/CD integration

See [docs/TODO.md](docs/TODO.md) for the full roadmap.

---

## Documentation

| Document | Description |
|----------|-------------|
| [PROJECT.md](docs/PROJECT.md) | Platform architecture and vision |
| [COMPARISON.md](docs/COMPARISON.md) | How Wiz compares to other tools |
| [PENTEST.md](docs/PENTEST.md) | Pentest module documentation |
| [GOVERNANCE.md](docs/GOVERNANCE.md) | Governance engine details |
| [DISTRIBUTION.md](docs/DISTRIBUTION.md) | Kali/Parrot distribution strategy |
| [TODO.md](docs/TODO.md) | Development roadmap |

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Security

For security issues, please see [SECURITY.md](SECURITY.md).

---

## License

MIT License - See [LICENSE](LICENSE)

---

## Acknowledgments

- [OpenCode](https://github.com/sst/opencode) - The foundation we built upon
- [Anthropic](https://anthropic.com) - Claude AI
- The security community for tool development

---

**Wiz** - *Security operations, intelligently orchestrated.*
