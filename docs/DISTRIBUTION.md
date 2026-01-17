# Distribution Channels: Kali Linux & Parrot OS

This document outlines the strategy for distributing Wiz through the official Kali Linux and Parrot OS repositories.

---

## Overview

Both Kali Linux and Parrot OS use Debian-based packaging (.deb). To get Wiz included in their official repositories, we need to:

1. Create a proper Debian package
2. Meet their tool criteria
3. Submit through their official channels

---

## Kali Linux Distribution

### Official Documentation
- [Submitting Tools to Kali](https://www.kali.org/docs/tools/submitting-tools/)
- [Intro to Packaging](https://www.kali.org/docs/development/intro-to-packaging-example/)
- [Bug Tracker](https://bugs.kali.org/)

### Requirements Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| `debian/` directory | DONE | Complete packaging created |
| Tagged release | DONE | v1.1.0 released |
| Clear license | DONE | MIT License |
| Homepage | DONE | GitHub repo |
| Documentation | DONE | README, docs/ |
| Dependencies listed | DONE | In debian/control |
| Installation instructions | DONE | In README |
| Usage examples | DONE | In README |
| Active development | DONE | Regular commits |
| Not duplicate of existing tool | DONE | Unique AI orchestration approach |
| Man page | DONE | debian/wiz.1 |

### Submission Information

When submitting to Kali's bug tracker, we need:

```
Category: New Tool Requests
Severity: Minor
Priority: Normal

Name: wiz
Version: 1.0.0 (use tagged release)
Homepage: https://github.com/code3hr/opencode
Author: code3hr
License: MIT

Description:
AI-powered security operations platform. Orchestrates 30+ security tools
through natural language. Features governance engine, scope enforcement,
audit logging, and structured findings management.

Dependencies:
- bun (JavaScript runtime)
- nmap, nikto, nuclei, etc. (security tools - already in Kali)

Similar Tools:
- None directly comparable (unique AI orchestration approach)
- Partially overlaps with: metasploit (automation), faraday (findings)

Installation:
bun install && bun run build

Usage:
$ wiz
> scan 192.168.1.0/24 for vulnerabilities
```

### Kali Metapackage Target

Wiz should be included in:
- `kali-tools-top10` - Core tools
- `kali-tools-automation` - Automation category

---

## Parrot OS Distribution

### Official Documentation
- [Community Contributions](https://parrotsec.org/docs/introduction/community-contributions/)
- [GitLab Repository](https://gitlab.com/parrotsec)
- Contact: team@parrotsec.org

### Requirements Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| GitLab account | TODO | Create account |
| Debian packaging | DONE | debian/ directory created |
| Debian standards compliance | DONE | Follows Debian policy |
| Email submission | DONE | Sent to team@parrotsec.org |
| Fork on personal repo | PENDING | Awaiting team response |
| Merge request | PENDING | Awaiting team response |

### Submission Process

1. **Email team@parrotsec.org** with:
   - Project name: Wiz
   - Description: AI-powered security operations platform
   - Sub-project: Security tools
   - Contribution type: New tool package

2. **Create GitLab fork** and prepare Debian package

3. **Submit merge request** for review

---

## Debian Packaging Requirements

Both distributions require proper Debian packaging. Here's what we need:

### Directory Structure (Implemented)

```
wiz/
├── debian/
│   ├── changelog          # Version history (1.0.0-1)
│   ├── compat             # Debhelper compatibility (13)
│   ├── control            # Package metadata
│   ├── copyright          # MIT license information
│   ├── rules              # Build instructions
│   ├── install            # File installation paths
│   ├── postinst           # Post-install script (Bun setup)
│   ├── prerm              # Pre-removal script
│   ├── postrm             # Post-removal script
│   ├── wiz.1              # Man page
│   └── source/
│       └── format         # Source format (3.0 native)
├── packages/
└── ...
```

### debian/control

```
Source: wiz
Section: utils
Priority: optional
Maintainer: code3hr <code3hr@users.noreply.github.com>
Build-Depends: debhelper (>= 11)
Standards-Version: 4.5.0
Homepage: https://github.com/code3hr/opencode

Package: wiz
Architecture: all
Depends: ${misc:Depends}, bun
Recommends: nmap, nikto, nuclei, gobuster, ffuf, sqlmap,
            smbclient, ldap-utils, snmp, dnsutils
Description: AI-powered security operations platform
 Wiz is an AI-powered operations platform for security professionals.
 It orchestrates 30+ security tools through natural language commands,
 with governance, scope enforcement, and audit logging.
 .
 Features:
  - Natural language tool orchestration
  - Governance engine with policy-based approval
  - Scope enforcement for authorized targets
  - Comprehensive audit logging
  - Structured findings management
  - Professional report generation
```

### debian/rules

```makefile
#!/usr/bin/make -f

%:
	dh $@

override_dh_auto_build:
	bun install
	bun run build

override_dh_auto_install:
	mkdir -p debian/wiz/usr/lib/wiz
	cp -r dist/* debian/wiz/usr/lib/wiz/
	mkdir -p debian/wiz/usr/bin
	ln -s /usr/lib/wiz/wiz debian/wiz/usr/bin/wiz
```

---

## Action Items

### Phase 1: Prepare Package (Priority: High)

- [x] Create `debian/` directory with all required files
- [x] Write man page for wiz
- [x] Create tagged release (v1.1.0)
- [x] Test package build locally
- [ ] Test installation on clean Kali VM
- [ ] Test installation on clean Parrot VM

### Phase 2: Submit to Kali (Priority: High)

- [x] Create account on bugs.kali.org
- [x] Submit new tool request (January 2026)
- [ ] Respond to reviewer feedback
- [ ] Iterate on packaging if needed

### Phase 3: Submit to Parrot (Priority: High)

- [ ] Create GitLab account
- [x] Email team@parrotsec.org (January 2026)
- [ ] Fork and prepare package
- [ ] Submit merge request
- [ ] Respond to reviewer feedback

### Phase 4: Ongoing Maintenance

- [ ] Monitor for security updates
- [ ] Update packages with new releases
- [ ] Respond to user issues
- [ ] Engage with community

---

## Alternative Distribution Methods

While working on official inclusion, we can also distribute via:

### 1. Direct .deb Download

Host .deb packages on GitHub releases for manual installation:

```bash
wget https://github.com/code3hr/opencode/releases/download/v1.1.0/wiz_1.1.0-1_all.deb
sudo dpkg -i wiz_1.1.0-1_all.deb
sudo apt-get install -f  # Install dependencies
```

### 2. APT Repository

Host our own APT repository:

```bash
# Add repository
echo "deb https://apt.wiz.security stable main" | sudo tee /etc/apt/sources.list.d/wiz.list
wget -qO - https://apt.wiz.security/key.gpg | sudo apt-key add -

# Install
sudo apt update
sudo apt install wiz
```

### 3. Installation Script

One-liner installation (current method):

```bash
curl -fsSL https://wiz.security/install.sh | bash
```

### 4. Homebrew (for macOS users)

```bash
brew tap code3hr/wiz
brew install wiz
```

---

## Timeline Estimate

| Phase | Status |
|-------|--------|
| Debian packaging | COMPLETE |
| Kali submission | SUBMITTED (Jan 2026) |
| Kali review process | PENDING (2-4 weeks) |
| Parrot submission | SUBMITTED (Jan 2026) |
| Parrot review | PENDING (2-4 weeks) |
| Official inclusion | 1-3 months total |

---

## Resources

- [Debian Policy Manual](https://www.debian.org/doc/debian-policy/)
- [Debian New Maintainers' Guide](https://www.debian.org/doc/manuals/maint-guide/)
- [Kali Public Packaging](https://www.kali.org/docs/development/public-packaging/)
- [Lintian - Debian Package Checker](https://lintian.debian.org/)

---

## Sources

- [Kali Linux - Submitting Tools](https://www.kali.org/docs/tools/submitting-tools/)
- [Parrot OS - Community Contributions](https://parrotsec.org/docs/introduction/community-contributions/)
- [Kali Linux Bug Tracker](https://bugs.kali.org/)
- [Parrot GitLab](https://gitlab.com/parrotsec)
