# Cyxwiz - AI Operations Platform

> A multi-domain AI operations platform for professionals who use command-line tools. Speak intent, tools execute with governance, AI explains results - all auditable.

---

## Vision

Cyxwiz is not a tool. **Cyxwiz is a platform.**

Starting with security (pentest), expanding to SOC, DevOps, Network Engineering, and beyond. One platform, many domains, governed AI orchestration for all.

---

## Strategic Foundation

### Fork, Don't Build From Scratch

Cyxwiz is built by forking [OpenCode](https://github.com/anomalyco/opencode) (MIT licensed).

**What OpenCode gives us:**
- CLI/TUI framework (Bubble Tea)
- Multi-LLM support (Claude, GPT, Gemini, etc.)
- Session management
- Tool execution framework
- Plugin system
- SDK for integrations
- 70k+ stars of validation

**What we add:**
- Governance engine (core, not plugin)
- Scope enforcement (core)
- Audit logging (core)
- Domain-specific agents
- Domain-specific tools with parsers
- Findings/state management
- Report generation
- Our own plugin ecosystem

### Why Fork vs Plugin

| As Plugin | As Fork (Platform) |
|-----------|-------------------|
| Limited by OpenCode's roadmap | Full control |
| Can't modify core UX | Customize everything |
| "Cyxwiz for OpenCode" | "Cyxwiz" |
| Tenant | Owner |
| Single product ceiling | Platform potential |

---

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       CYXWIZ PLATFORM                            │
│                  (Forked from OpenCode, MIT)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CORE FRAMEWORK (inherited from OpenCode):                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ CLI/TUI │ Multi-LLM │ Sessions │ Tool Exec │ Plugin System │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  CYXWIZ CORE (our additions - NOT plugins):                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │  Governance  │  │    Scope     │  │    Audit     │    │ │
│  │  │    Engine    │  │  Enforcement │  │   Logging    │    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  │                                                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │   Findings   │  │    Report    │  │    Domain    │    │ │
│  │  │    Store     │  │  Generation  │  │   Registry   │    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  DOMAIN AGENTS (pluggable, extensible):                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │ │
│  │  │ Pentest │ │   SOC   │ │ DevOps  │ │ NetEng  │  ...   │ │
│  │  │  Agent  │ │  Agent  │ │  Agent  │ │  Agent  │        │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │ │
│  │       │           │           │           │              │ │
│  │       ▼           ▼           ▼           ▼              │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │ │
│  │  │  Tools  │ │  Tools  │ │  Tools  │ │  Tools  │        │ │
│  │  │ nmap,   │ │ splunk, │ │ kubectl │ │ cisco,  │        │ │
│  │  │ nikto   │ │ elastic │ │ ansible │ │ juniper │        │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  COMMUNITY PLUGINS (our ecosystem):                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Third-party agents │ Custom tools │ Integrations │ ...   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Language: TypeScript

OpenCode is TypeScript. We stay TypeScript.

| Component | Technology | Source |
|-----------|------------|--------|
| Language | TypeScript | Inherited |
| Runtime | Bun | Inherited |
| CLI Framework | Cobra-style | Inherited |
| TUI | Bubble Tea (via JS bindings) | Inherited |
| Multi-LLM | OpenCode providers | Inherited |
| State | SQLite | Inherited + Extended |
| Plugin System | OpenCode plugins | Inherited + Extended |
| Tool Execution | Subprocess | Inherited |

### What We Modify/Add

| Component | Change |
|-----------|--------|
| Governance Engine | New - core feature |
| Scope Enforcement | New - core feature |
| Audit System | New - core feature |
| Findings Store | New - extended SQLite schema |
| Domain Registry | New - agent/tool management |
| Report Generator | New - export system |

---

## Governance Engine (Core Feature)

This is what differentiates Cyxwiz from vanilla OpenCode.

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│                   COMMAND LIFECYCLE                      │
│                                                          │
│   User Intent                                           │
│        ↓                                                │
│   LLM Translation → "nmap -sV 10.0.0.15"               │
│        ↓                                                │
│   ┌─────────────────────────────────────┐              │
│   │       GOVERNANCE CHECK              │              │
│   │                                     │              │
│   │  1. Scope Check                     │              │
│   │     Is 10.0.0.15 in allowed scope?  │              │
│   │                                     │              │
│   │  2. Policy Check                    │              │
│   │     Is nmap auto-approved?          │              │
│   │     Any dangerous flags?            │              │
│   │                                     │              │
│   │  3. Approval Flow                   │              │
│   │     Auto-approve OR prompt user     │              │
│   │                                     │              │
│   └─────────────────────────────────────┘              │
│        ↓                                                │
│   Execute (if approved)                                 │
│        ↓                                                │
│   Audit Log (always)                                    │
│        ↓                                                │
│   Parse Output → Findings Store                         │
│        ↓                                                │
│   LLM Explanation                                       │
└─────────────────────────────────────────────────────────┘
```

### Policy Configuration (Per Domain)

```typescript
// Example: Pentest domain policy
{
  domain: "pentest",
  autoApprove: [
    "nmap *",
    "nikto *",
    "ffuf *",
    "nuclei *",
    "whois *",
    "dig *",
    "curl *"
  ],
  requireApproval: [
    "metasploit *",
    "sqlmap --os-*",
    "* --exploit *",
    "* --exec *"
  ],
  blocked: [
    "rm -rf *",
    "* > /dev/*"
  ]
}
```

---

## Domain Agents

### MVP: Pentest Agent

**Target User:** Solo security consultant

**Tools:**
| Tool | Purpose | Parser |
|------|---------|--------|
| nmap | Port scanning | XML parser |
| nikto | Web vuln scanning | Text parser |
| ffuf | Fuzzing | JSON parser |
| nuclei | Template scanning | JSON parser |
| whois | Domain recon | Text parser |
| dig | DNS queries | Text parser |
| metasploit | Exploitation | RPC parser |

**Workflow:**
```
cyxwiz pentest start --scope 10.0.0.0/24 --exclude 10.0.0.1

> "scan for open ports"
[nmap executes, findings stored]

> "check web services for vulnerabilities"
[nikto + nuclei on discovered web ports]

> "generate report"
[markdown/PDF export]
```

### Future: SOC Agent

**Target User:** Security analyst

**Tools:**
- Splunk queries
- Elastic search
- SIEM integrations
- Threat intel lookups
- IOC checking

### Future: DevOps Agent

**Target User:** DevOps engineer

**Tools:**
- kubectl
- terraform
- ansible
- docker
- cloud CLIs (aws, gcloud, az)

### Future: NetEng Agent

**Target User:** Network engineer

**Tools:**
- cisco IOS commands
- juniper CLI
- network scanners
- config parsers

---

## Build Phases

### Phase 1: Fork & Foundation
- [ ] Fork OpenCode repository
- [ ] Set up development environment
- [ ] Understand codebase structure
- [ ] Identify modification points for governance
- [ ] Create Cyxwiz branding/naming

**Deliverable:** Building Cyxwiz from source, understanding the codebase.

### Phase 2: Governance Engine
- [ ] Implement `tool.execute.before` hook for governance
- [ ] Build scope definition system
- [ ] Build policy configuration system
- [ ] Implement approval flow (auto/prompt/block)
- [ ] Implement audit logging

**Deliverable:** Any command goes through governance check before execution.

### Phase 3: Pentest Agent MVP
- [ ] Create pentest agent configuration
- [ ] Implement nmap tool with XML parser
- [ ] Implement scope enforcement for targets
- [ ] Basic findings storage
- [ ] LLM explanation of results

**Deliverable:** Can run "scan ports on X" with governance and get explained results.

### Phase 4: Multi-Tool Pentest
- [ ] Add nikto, ffuf, nuclei tools
- [ ] Add parsers for each
- [ ] Findings accumulation
- [ ] Cross-tool context (LLM knows all findings)

**Deliverable:** Full recon workflow with multiple tools.

### Phase 5: State & Reports
- [ ] Session persistence (resume engagements)
- [ ] Findings export (markdown, JSON)
- [ ] Report generation
- [ ] Engagement history

**Deliverable:** Professional pentest workflow with deliverables.

### Phase 6: Platform Polish
- [ ] Domain registry system
- [ ] Plugin system for community agents
- [ ] Documentation
- [ ] Distribution (npm, binary, docker)

**Deliverable:** Cyxwiz v1.0 - platform ready for public use.

### Phase 7+: Multi-Domain Expansion
- [ ] SOC agent
- [ ] DevOps agent
- [ ] NetEng agent
- [ ] Community contributions

---

## UI Evolution

Inherited from OpenCode, enhanced for Cyxwiz:

### CLI (Default)
```
$ cyxwiz pentest start --scope 10.0.0.0/24
Starting engagement: external-pentest
Scope: 10.0.0.0/24
Audit log: ~/.cyxwiz/audits/2024-01-15-001.log

> scan for open ports on the entire scope
[Governance: APPROVED - nmap is auto-approved]
[Executing: nmap -sV -sC -oX /tmp/scan.xml 10.0.0.0/24]

Found 12 hosts with open ports...
```

### TUI (Inherited from OpenCode)
```
┌─────────────────────────────────────────────────────────┐
│ Cyxwiz Pentest │ Scope: 10.0.0.0/24 │ Findings: 23        │
├─────────────┬───────────────────┬───────────────────────┤
│ TARGETS     │ FINDINGS          │ AUDIT LOG             │
│             │                   │                       │
│ ● 10.0.0.15 │ ⚠ SSH outdated    │ [14:23] nmap started │
│ ● 10.0.0.20 │ ⚠ HTTP exposed    │ [14:25] 12 hosts up  │
│ ○ 10.0.0.25 │ ✗ Default creds   │ [14:30] nikto done   │
├─────────────┴───────────────────┴───────────────────────┤
│ > check .15 for web vulnerabilities                     │
└─────────────────────────────────────────────────────────┘
```

### Web UI (Future)
- FastAPI backend
- HTMX → Svelte frontend
- Same core, different interface

---

## What Success Looks Like

### Phase 3 (MVP):
```
$ cyxwiz pentest start --scope scanme.nmap.org

> scan for open ports
[APPROVED] Executing nmap...

Found 4 open ports on scanme.nmap.org:
- 22/tcp: OpenSSH 6.6.1 (protocol 2.0)
- 80/tcp: Apache httpd 2.4.7
- 9929/tcp: Nping echo
- 31337/tcp: Elite backdoor (likely test)

Recommendation: Investigate port 80 for web vulnerabilities.

> ok do that
[APPROVED] Executing nikto...
```

### Phase 6 (v1.0):
```
$ cyxwiz

Available domains:
  pentest  - Security testing and assessment
  soc      - Security operations and monitoring (coming soon)
  devops   - Infrastructure and deployment (coming soon)

$ cyxwiz pentest
$ cyxwiz soc
$ cyxwiz devops
```

---

## Market Evolution

### Phase 1-5: Niche Tool
- Target: Solo security consultants
- Revenue: $5K-$20K/month
- Model: Open source + paid features

### Phase 6+: Platform Play
- Target: Security teams, DevOps teams, IT departments
- Revenue: Platform potential
- Model: Open source core + enterprise features + marketplace

### Long-term Moat
1. **Governance engine** - Differentiator from generic AI tools
2. **Domain expertise** - Deep integration with professional tools
3. **Audit compliance** - Enterprise requirement
4. **Community ecosystem** - Network effects from plugins

---

## Distribution Strategy

### The Kali/Parrot Advantage

Security-focused Linux distributions like Kali and Parrot OS come with 600+ pre-installed security tools. Cyxwiz becomes the intelligent orchestration layer on top.

```
┌─────────────────────────────────────────────────────────┐
│              KALI/PARROT + CYXWIZ                         │
│                                                          │
│  Pre-installed (600+ tools):                            │
│  ├─ nmap, nikto, metasploit, sqlmap, ffuf, nuclei      │
│  ├─ burpsuite, wireshark, john, hashcat, hydra         │
│  ├─ gobuster, dirb, wfuzz, amass, subfinder            │
│  └─ ... hundreds more                                   │
│                                                          │
│  What's missing:                                        │
│  └─ Intelligent orchestration ← CYXWIZ fills this gap  │
│                                                          │
│  Result:                                                │
│  └─ Junior analyst can use pro tools safely            │
│  └─ Senior analyst works 10x faster                    │
│  └─ Everything audited and governed                    │
└─────────────────────────────────────────────────────────┘
```

### Integration Levels

**Level 1: Manual Install (Day 1)**
```bash
# Works on any Kali/Parrot box
curl -fsSL https://cyxwiz.dev/install | bash
cyxwiz setup  # Auto-detects available tools
```

**Level 2: Package Repository (Phase 6)**
```bash
# Submit to Kali repos
sudo apt update
sudo apt install cyxwiz
```

**Level 3: Pre-installed (Long-term Goal)**
- Partner with Offensive Security (Kali maintainers)
- Get Cyxwiz included in default installation
- Every Kali download = potential Cyxwiz user

### Auto-Detection System

Cyxwiz adapts to available tools:

```typescript
// On first run or `cyxwiz setup`
const detectTools = async () => {
  const detected = [];

  for (const tool of SUPPORTED_TOOLS) {
    if (await commandExists(tool.binary)) {
      detected.push({
        name: tool.name,
        version: await getVersion(tool.binary),
        parser: tool.parser,
        status: 'available'
      });
    }
  }

  // Cyxwiz works with whatever is installed
  // Full power on Kali, limited on vanilla Ubuntu
  return detected;
};
```

**Output example:**
```
$ cyxwiz setup

Detecting available tools...

RECONNAISSANCE
  ✓ nmap 7.94      Port scanning
  ✓ amass 3.19     Subdomain enumeration
  ✓ subfinder 2.5  Subdomain discovery
  ✗ masscan        Fast port scanning (not installed)

WEB ANALYSIS
  ✓ nikto 2.5      Web vulnerability scanner
  ✓ ffuf 2.0       Web fuzzer
  ✓ nuclei 2.9     Template-based scanner
  ✓ sqlmap 1.7     SQL injection

EXPLOITATION
  ✓ metasploit 6.3 Exploitation framework
  ✓ hydra 9.4      Password cracking

47 tools available. Cyxwiz is ready.
```

### Distribution Channels

| Platform | Method | Friction | Timeline |
|----------|--------|----------|----------|
| Any Linux | curl script | Low | Phase 3 |
| Kali/Parrot | apt package | Very low | Phase 6 |
| Kali/Parrot | Pre-installed | Zero | Phase 7+ |
| Docker | `docker run cyxwiz` | Low | Phase 5 |
| macOS | `brew install cyxwiz` | Low | Phase 6 |
| Windows/WSL | curl script | Medium | Phase 6 |

### Why Kali/Parrot Teams Would Accept Cyxwiz

| Their Priority | How Cyxwiz Helps |
|----------------|---------------|
| Beginner accessibility | Natural language interface |
| Tool discoverability | Cyxwiz suggests relevant tools |
| Professional use | Governance + audit trails |
| Community value | Open source (MIT) |
| Distro differentiation | No competitor has this |

### The Pitch (When Ready)

> "Cyxwiz is the missing brain for Kali Linux. Your 600+ tools, now accessible through natural language. Junior analysts work safely with built-in governance. Senior analysts work faster with intelligent orchestration. Every action audited for compliance. The AI layer your toolkit has been waiting for."

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| OpenCode changes license | Already forked, MIT is irrevocable |
| OpenCode dies | We own our fork, continue independently |
| Can't keep up with OpenCode updates | Cherry-pick relevant updates only |
| TypeScript learning curve | OpenCode codebase is well-structured |
| Governance adds latency | Optimize hot paths, cache policy decisions |
| Multi-domain dilutes focus | Nail pentest first before expanding |

---

## Open Questions

- [ ] Cyxwiz branding (name, logo, domain)
- [ ] Open source model (MIT? Apache? AGPL for enterprise?)
- [ ] Community building strategy
- [ ] When to diverge significantly from OpenCode upstream
- [ ] Enterprise features for monetization

---

## Next Step

1. Fork OpenCode
2. Build locally
3. Explore codebase
4. Identify where to inject governance engine

Start with understanding. Then modify.
