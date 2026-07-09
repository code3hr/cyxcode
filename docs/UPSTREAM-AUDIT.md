# Upstream Audit

This file tracks selective upstream opencode updates for CyxCode. Use it to avoid broad merges that overwrite CyxCode-specific branding, commands, update flow, TUI behavior, skills, or security tooling.

## Current Baseline

- Audit date: 2026-07-09
- CyxCode branch: `sync/mcp-oauth-upstream-2026-06-28`
- CyxCode head after latest backport: `b1b02b09ae7a61d62eb485fa6456770e6e5d8b06`
- Latest upstream release checked: `anomalyco/opencode v1.17.16`
- Upstream release date: 2026-07-09
- Upstream `dev` checked: `e357c9021234763da54753d69cbc28908e071f8b`

## Audit Policy

Classify upstream changes as one of:

- `take`: small bug fix or provider/model compatibility change that maps cleanly to CyxCode.
- `manual adaptation`: useful upstream behavior, but direct cherry-pick would conflict with CyxCode architecture, package versions, branding, commands, or UI.
- `skip for now`: broad churn, product UI work, stats/data redesign, package bump, or feature work with no current CyxCode need.

Prefer the smallest backport that preserves CyxCode behavior. Do not wholesale merge upstream TUI, CLI, desktop, app, or package churn without a specific bug being fixed.

## Already Backported

- Codex/OpenAI model updates from upstream `v1.17.14`.
- GPT-5.5 allowlist and limit handling.
- Future `gpt-5.x` allowlist parsing fix.
- Azure GPT-5.5 provider transform behavior.
- CyxCode update/install identity fixes so `/update` and installer paths target `code3hr/cyxcode`, not upstream opencode.
- Z.ai context overflow classification from upstream `v1.17.15`.
- Missing config directory handling from upstream `v1.17.15`, adapted to CyxCode's config behavior.
- xAI/Grok cache hit rate improvement from upstream `ccb6b7c3ea`, adapted to CyxCode's `@ai-sdk/xai@2.0.51` patch.
- Grok reasoning variants from upstream `1db5c2402c`, adapted to CyxCode's existing OpenRouter variant gate.
- Settings theme selection behavior from upstream `ae259d87f0`, adapted to CyxCode's single settings UI.
- Upstream `v1.17.16` scoped release audit completed; no additional CyxCode-safe provider/core fixes remained after the xAI cache-key and Grok reasoning backports.
- Desktop review pane sizing from upstream `dd25d143c5`, adapted to CyxCode session layout.
- Terminal shortcut priority from upstream `65fd2e5c91`, adapted to CyxCode command palette and shortcut settings visibility.

## Take Next

None currently marked as direct `take`.

## Manual Adaptation Candidates

### xAI Cache Hit Rate - Done

- Upstream commit: `ccb6b7c3ea fix: improve xai cache hit rate (#35970)`
- Completed: 2026-07-09
- Adaptation: kept CyxCode on `@ai-sdk/xai@2.0.51` and extended the existing local patch instead of taking upstream's `@ai-sdk/xai@3.0.102` package bump.
- Tests added:
  - `packages/opencode/test/provider/transform.test.ts`
  - `packages/opencode/test/provider/xai-responses.test.ts`

### Desktop/App Bug Fixes

Potentially useful only if CyxCode actively ships or tests the desktop app surface:

- Unread state on tabs with pending questions.
- Session tab titles persist during reload/loading.
- macOS titlebar and traffic light layout fixes.
- Hidden review pane unmounting.
- Review state persistence per session.
- Legacy drafts route to session page.
- Capped review patch loading.

Reason this is manual: these touch `packages/app` layout/session state and can conflict with CyxCode UI assumptions.

## Skip For Now

These are intentionally not backported unless a concrete CyxCode bug or release requirement appears:

- Full upstream TUI rewrite or structural CLI churn.
- Desktop/app visual refreshes that do not fix a CyxCode-shipped bug.
- Stats/model comparison redesigns.
- Model efficiency and model peers data redesigns.
- Broad command palette visual refresh.
- Inline file browser tabs.
- Composer add menu and draft-preserving app commands.
- Desktop provider connection tips and reveal-projects-in-file-manager behavior.
- i18n translation churn.
- Broad package/version churn not tied to a security, provider, build, or release fix.
- Generated file churn with no runtime behavior change.
- Nix node_modules hash churn.
- Upstream release version sync commits.
- Upstream `v1.17.16` package manifest version sync.
- Any change that replaces CyxCode-specific commands, branding, update flow, installer identity, skills, security tooling, or TUI behavior.

## Re-Audit Checklist

1. Fetch upstream branches and tags:

```powershell
git fetch upstream dev --tags
```

If tag conflicts appear because CyxCode and opencode share tag names, verify the needed upstream tag with:

```powershell
git ls-remote --tags --refs upstream vX.Y.Z
```

2. Check latest upstream release:

```powershell
gh release list --repo anomalyco/opencode --limit 10
```

3. Compare latest released opencode delta:

```powershell
git log --oneline <previous-upstream-tag>..<latest-upstream-tag> -- packages/opencode packages/llm packages/app packages/desktop packages/stats packages/tui
git diff --name-status <previous-upstream-tag>..<latest-upstream-tag> -- packages/opencode packages/llm packages/app packages/desktop packages/stats packages/tui
```

4. Compare unreleased upstream `dev` after latest release:

```powershell
git log --oneline <latest-upstream-tag>..upstream/dev -- packages/opencode packages/llm packages/app packages/desktop packages/stats packages/tui
git diff --name-status <latest-upstream-tag>..upstream/dev -- packages/opencode packages/llm packages/app packages/desktop packages/stats packages/tui
```

5. For each candidate, classify as `take`, `manual adaptation`, or `skip for now` before editing code.

6. For any `take` or `manual adaptation`, add focused tests in `packages/opencode` and run package-local tests/typecheck only from package directories.