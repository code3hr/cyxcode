# CyxCode Documentation

This directory contains project documentation that should help users, operators, and contributors work with CyxCode. Local planning notes, cleanup ledgers, vulnerability scan scratchpads, and marketing drafts are ignored by Git under `docs/local/` or by exact ignore rules in `.gitignore`.

## User Docs

| Document | Purpose |
|----------|---------|
| [USAGE.md](USAGE.md) | Full user guide for modes, commands, memory, pattern learning, and reports. |
| [FAQ.md](FAQ.md) | Product questions, fork rationale, compatibility, and maintenance notes. |
| [PERFORMANCE.md](PERFORMANCE.md) | Performance notes, token savings, and hardware caveats. |
| [DISTRIBUTION.md](DISTRIBUTION.md) | Install and distribution channels. |
| [RELEASE.md](RELEASE.md) | Release smoke checks and release workflow notes. |

## Contributor Docs

| Document | Purpose |
|----------|---------|
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Development setup, project structure, and pull request expectations. |
| [TEST.md](TEST.md) | Test commands and validation guidance. |
| [ADDING-PATTERNS.md](ADDING-PATTERNS.md) | Add deterministic error patterns. |
| [CONTRIBUTING-PATTERNS.md](CONTRIBUTING-PATTERNS.md) | Contribute reusable pattern fixes. |
| [PROJECT.md](PROJECT.md) | Project boundaries, compatibility stance, and cleanup principles. |

## Feature Docs

| Document | Purpose |
|----------|---------|
| [AUDIT-SYSTEM.md](AUDIT-SYSTEM.md) | Audit journal and reporting behavior. |
| [CYXCODE-INIT.md](CYXCODE-INIT.md) | Project initialization behavior. |
| [GOVERNANCE.md](GOVERNANCE.md) | Scope, policy, and governance concepts. |
| [PENTEST.md](PENTEST.md) | Security dashboard and pentest API reference. |
| [PENTEST_CAPABILITIES.md](PENTEST_CAPABILITIES.md) | Supported security testing capabilities. |
| [RECALL.md](RECALL.md) | Local semantic recall design and behavior. |
| [STATE-VERSIONING.md](STATE-VERSIONING.md) | State versioning design. |
| [TOOLS_QUICK_REFERENCE.md](TOOLS_QUICK_REFERENCE.md) | Security tool quick reference. |
| [WIKI.md](WIKI.md) | Wiki and memory notes. |

## Repo Layout

| Path | Purpose |
|------|---------|
| `packages/opencode` | Core CLI, server, TUI, agents, providers, and CyxCode runtime features. |
| `packages/app` | Shared browser UI used by the web and desktop surfaces. |
| `packages/ui` | Shared UI component package. |
| `packages/web` | Public website and maintained web documentation. |
| `packages/console` | Console app, backend services, and email templates. |
| `packages/desktop` | Tauri desktop app. |
| `packages/desktop-electron` | Electron desktop app. |
| `packages/sdk` | OpenAPI artifact and generated SDKs. |
| `github` | CyxCode GitHub Action. |
| `sdks/vscode` | VS Code extension. |
