# Upstream Audit

This file tracks selective upstream opencode updates for CyxCode. Use it to avoid broad merges that overwrite CyxCode-specific branding, commands, update flow, TUI behavior, skills, or security tooling.

## Current Pickup (2026-09-28)

- CyxCode branch: `sync/mcp-oauth-upstream-2026-06-28` at `42676876b6` before this pickup.
- Latest published upstream release: [`v1.18.32`](https://github.com/anomalyco/opencode/releases/tag/v1.18.32), published 2026-09-21, commit `545f51d26c`.
- Upstream `dev` snapshot: `b471c2b4495747353af768fbf2e0790c9d820ce2` (2026-09-26).
- The release delta since `v1.17.16` spans 195 commits touching `packages/opencode` and 743 files across the audited package paths. This pickup reviews selected core fixes; it is not a full release-by-release audit.
- Local upstream release tag alias: `upstream-v1.18.32`. Fetch upstream tags under distinct names because CyxCode owns some of the same tag names.

### Backported in this batch

- `c10134729d` (`take`, adapted): Bedrock tool images stay in tool results for Claude, Nova, and Llama 4; other Bedrock images move to a user message. CyxCode's existing message conversion also preserves PDF handling. No SDK or package bump.
- `9b0dd36cda` (`take`, adapted): malformed model price fields count as zero instead of breaking session cost calculation. Existing CyxCode token accounting is preserved.
- `3a35b45db8` (`take`, adapted from unreleased `dev`): allow `gpt-6-sol` and `gpt-6-luna` in CyxCode's existing Codex OAuth allowlist. CyxCode's model names, authorization flow, and other allowlist rules remain in place.
- `82d4c89031` (`take`, adapted from unreleased `dev`): redact credentials in `cyxcode debug config` output without changing the resolved config used by providers.
- Validation: package-local session, Codex, and debug-config tests pass; `bun typecheck` passes. The debug-config test covers the redaction function; a CLI process test has not been run.

### Review next

- `ac1758c0e6` (`manual adaptation`): preserve Bedrock DeepSeek and ARN model IDs. The CyxCode provider has its own region-prefix path; add focused provider tests before changing it.
- `95daf90670` (`manual adaptation`): ACP session options and reasoning boundaries. Upstream changes several ACP modules and tests, so compare with CyxCode's ACP behavior first.
- `610df0b566` (`manual adaptation`, unreleased): Gemini thinking defaults. Compare with CyxCode's provider transforms and SDK versions.
- `69c172e8a7` (`manual adaptation`): SSE reader cancellation. Upstream changes `packages/core` and provider code; check whether CyxCode's versions have the same failure path.
- `b471c2b449` (`skip for now`, unreleased): MCP browser launcher exit handling depends on `packages/opencode/src/mcp/browser.ts`, which this fork does not have.
- Broad app v2, TUI, release version, generated file, and dependency churn remains excluded by the audit policy below.

## Previous Baseline (2026-07-09)

- Audit date: 2026-07-09
- CyxCode branch: `sync/mcp-oauth-upstream-2026-06-28`
- CyxCode head after latest backport: `92fc9667f0`
- Latest upstream release checked: `anomalyco/opencode v1.17.16`
- Upstream release date: 2026-07-09
- Upstream `dev` checked: `6b41ae910c51e72d3d70a4b7e7a75283c74c41db`
- Latest upstream `dev` snapshot: `518772c2ba7d52f7d1e79bca2837ce96241a282d`

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
- Review state persistence per session from upstream `aa52d30d7f`, adapted to CyxCode session/review state.
- Terminal shortcut priority from upstream `65fd2e5c91`, adapted to CyxCode command palette and shortcut settings visibility.
- Show unread session state for pending questions from upstream `c5fe32fbb1`, adapted to CyxCode session list row state.

## Take Next

- None currently marked as direct `take`; post-`v1.17.16` upstream changes in this repo are primarily app/UI v2 refactors.

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


- [done] Session tab titles persist during reload/loading.
- [done] macOS titlebar and traffic light layout fixes.
- [done] Hidden review pane unmounting.

- [done] Legacy drafts route to session page (app compatibility `/new-session` compatibility route).
- [done] `ae7d63272c` descender clipping in model list (partial): added `leading-5` to model item text in `packages/app/src/components/dialog-select-model.tsx`.
- [blocked] Capped review patch loading (upstream depends on `@opencode-ai/ui` v2 `session-review` and `/vcs/diff` API).
- [done] `5c860d4142` model variant display row: added `leading-5` to variant select value class in `packages/app/src/components/prompt-input.tsx`.
- [done] `5cc3a51357` free model selector behavior already active: existing unpaid-model fallback opens `DialogSelectModelUnpaid`; v2-only upstream variant path intentionally skipped.

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
- Latest upstream `dev` delta after `v1.17.16`:
  - `4f9207daac feat(app): restyle revert dock for v2`
  - `3b18c64782 chore: generate` (generated drawer shim)
  - `c6c599b872 feat(app): refactor help button and add tabs info popup persistence` (help button redesign + `@corvu/drawer` dependency bump)
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

