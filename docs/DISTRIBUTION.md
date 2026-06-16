# Distribution Channels

This document tracks CyxCode distribution work for Debian-based security distributions and direct package delivery.

## Targets

- Kali Linux official repositories
- Parrot OS official repositories
- GitHub release `.deb` downloads
- Future APT repository
- Future Homebrew tap

## Kali Linux

Official references:

- [Submitting Tools to Kali](https://www.kali.org/docs/tools/submitting-tools/)
- [Intro to Packaging](https://www.kali.org/docs/development/intro-to-packaging-example/)
- [Kali bug tracker](https://bugs.kali.org/)

Status:

| Requirement | Status | Notes |
| --- | --- | --- |
| `debian/` directory | Done | Packaging exists in repo |
| Tagged release | Done | Use the current tagged release when submitting |
| License | Done | MIT |
| Homepage | Done | `https://github.com/code3hr/cyxcode` |
| Documentation | Done | README and docs |
| Dependencies | Done | Listed in `debian/control` |
| Man page | Done | `debian/cyxcode.1` |
| Clean Kali VM install test | Pending | Run before resubmission |
| Reviewer feedback | Pending | Track in the Kali issue |

Submission summary:

```text
Category: New Tool Requests
Severity: Minor
Priority: Normal

Name: cyxcode
Homepage: https://github.com/code3hr/cyxcode
Author: code3hr
License: MIT
Description: AI-powered security operations platform for orchestrating security tools with governance, scope enforcement, audit logging, and structured findings.
```

## Parrot OS

Official references:

- [Community Contributions](https://parrotsec.org/docs/introduction/community-contributions/)
- [Parrot GitLab](https://gitlab.com/parrotsec)

Status:

| Requirement | Status | Notes |
| --- | --- | --- |
| GitLab account | Pending | Required for merge request |
| Debian packaging | Done | `debian/` directory exists |
| Debian standards compliance | Done | Follows Debian policy |
| Email submission | Done | Sent to `team@parrotsec.org` in January 2026 |
| Fork on personal repo | Pending | Awaiting team response |
| Merge request | Pending | Awaiting team response |

## Debian Package Layout

```text
cyxcode/
|-- debian/
|   |-- changelog
|   |-- compat
|   |-- control
|   |-- copyright
|   |-- rules
|   |-- install
|   |-- postinst
|   |-- prerm
|   |-- postrm
|   |-- cyxcode.1
|   `-- source/
|       `-- format
|-- packages/
`-- ...
```

## Direct Release Package

Manual install path for GitHub release artifacts:

```bash
wget https://github.com/code3hr/cyxcode/releases/download/v1.1.0/cyxcode_1.1.0-1_all.deb
sudo dpkg -i cyxcode_1.1.0-1_all.deb
sudo apt-get install -f
```

## Action Items

- Test package installation on a clean Kali VM.
- Test package installation on a clean Parrot VM.
- Respond to Kali reviewer feedback.
- Create or confirm GitLab account for Parrot submission.
- Prepare Parrot fork and merge request after response.
- Keep Debian package metadata in sync with each release.
