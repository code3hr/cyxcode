# Upstream Audit

This file tracks selective upstream opencode updates for CyxCode. Use it to avoid broad merges that overwrite CyxCode-specific branding, commands, update flow, TUI behavior, skills, or security tooling.

## Current Pickup (2026-09-28)

- CyxCode branch: `sync/mcp-oauth-upstream-2026-06-28` at `42676876b6` before this pickup.
- Latest published upstream release: [`v1.18.32`](https://github.com/anomalyco/opencode/releases/tag/v1.18.32), published 2026-09-21, commit `545f51d26c`.
- Upstream `dev` snapshot: `b471c2b4495747353af768fbf2e0790c9d820ce2` (2026-09-26).
- The release delta since `v1.17.16` spans 195 commits touching `packages/opencode` and 743 files across the audited package paths. This pickup reviews selected core fixes; it is not a full release-by-release audit.
- Local upstream release tag alias: `upstream-v1.18.32`. Fetch upstream tags under distinct names because CyxCode owns some of the same tag names.

### Backported in this batch

- Committed as `e731b14d03` and pushed to `origin/sync/mcp-oauth-upstream-2026-06-28`.
- `c10134729d` (`take`, adapted): Bedrock tool images stay in tool results for Claude, Nova, and Llama 4; other Bedrock images move to a user message. CyxCode's existing message conversion also preserves PDF handling. No SDK or package bump.
- `9b0dd36cda` (`take`, adapted): malformed model price fields count as zero instead of breaking session cost calculation. Existing CyxCode token accounting is preserved.
- `3a35b45db8` (`take`, adapted from unreleased `dev`): allow `gpt-6-sol` and `gpt-6-luna` in CyxCode's existing Codex OAuth allowlist. CyxCode's model names, authorization flow, and other allowlist rules remain in place.
- `82d4c89031` (`take`, adapted from unreleased `dev`): redact credentials in `cyxcode debug config` output without changing the resolved config used by providers.
- Validation: package-local session, Codex, and debug-config tests pass; `bun typecheck` passes. The debug-config test covers the redaction function; a CLI process test has not been run.

### Provider, MCP, and ACP follow-up

- Status: backported in the 2026-09-28 follow-up batch on this branch.
- `ac1758c0e6` (`take`, adapted): preserve ARN model IDs and restrict automatic DeepSeek US prefixes to R1. Tests construct the actual bundled SDK through CyxCode's provider loader, covering aliases, existing prefixes, GovCloud, Claude, Nova, and Cohere.
- `69c172e8a7` (`take`, adapted): handle a rejected SSE reader cancellation while preserving the original timeout error. The regression exercises the existing fetch wrapper and bundled SDK. CyxWatch network-boundary coverage also passes.
- `3a4c253969` (`take`, adapted): inject default GPT-5 text verbosity only for supporting SDKs. Keep CyxCode's existing Azure exclusion and verify custom provider IDs and OpenAI-compatible SDKs.
- `b471c2b449` (`manual adaptation`, unreleased): inspect an already-completed browser launcher's exit code inside CyxCode's existing MCP OAuth path. Keep callback registration, the authorization-URL callback, and `BrowserOpenFailed` event behavior. No upstream browser module or Effect refactor is imported.
- Validation: 34 Bedrock/SSE tests, 140 provider-transform tests, 6 OAuth browser tests, and the existing CyxWatch provider boundary test pass (181 total). Package-local type checking and formatting checks pass. New regression cases reproduced the bugs before the fixes.

- `610df0b566` (`manual adaptation`, unreleased): select Gemini reasoning defaults and variants using API IDs, including aliases and future model families. Preserve legacy Gemini defaults, use 32768 for Gemini 2.5 Pro's maximum budget, and share supported levels with small requests. Keep CyxCode's OpenRouter gate for other model families, Gateway option shapes, and SAP integration. The pinned Google SDK already supports these thinking levels; no dependency bump is needed.
- `95daf90670` (`partial manual adaptation`): restore the last user message's model, reasoning variant, and mode on load, resume, and fork. Validate historical selections against available providers and agents; keep live choices across reload/resume within the same connection and directory. Preserve CyxCode's existing variant metadata and base-model selection behavior, including explicit variant clearing.
- Combined validation: 234 tests pass across ACP interface/events/restoration, Gemini reasoning, provider transforms, Bedrock/SSE, and MCP browser handling. The existing CyxWatch provider boundary test also passes. ACP restoration tests exercise the real agent and session manager with the existing SDK/connection test doubles; they are not an external-client end-to-end test.

### Review next and exclusions

- `95daf90670` (remaining scope deferred): CyxCode's session schema lacks upstream's durable session `agent`/`model` fields, and its ACP agent does not implement the newer config-option flow. Unsent selections therefore remain connection-local; cross-connection restoration uses message history. The pinned ACP SDK's `ContentChunk` also lacks the `messageId` field required for upstream's reasoning-boundary fix. Plan schema/protocol compatibility separately before importing those portions.
- `95ebf50ace` (`skip for now`): upstream adds `/v1` to Cognitive Services base URLs for its newer SDK. CyxCode's pinned `@ai-sdk/azure@2.0.91` already appends `/v1` internally; importing that change would produce `/openai/v1/v1/...` for default URLs.
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

- The provider/MCP/Gemini and compatible ACP follow-up is recorded above. Review the remaining release delta in small batches; ACP persistence/protocol changes require a separate compatibility plan.

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

1. Fetch upstream `dev` without importing conflicting CyxCode tag names:

```powershell
git fetch --no-tags upstream dev
```

Verify the needed upstream release tag and fetch it under a distinct local name:

```powershell
git ls-remote --tags --refs upstream vX.Y.Z
git fetch --no-tags upstream refs/tags/vX.Y.Z:refs/tags/upstream-vX.Y.Z
```

2. Check latest upstream release:

```powershell
gh release list --repo anomalyco/opencode --limit 10
```

3. Compare latest released opencode delta:

```powershell
git log --oneline <previous-upstream-ref>..<latest-upstream-ref> -- packages/opencode packages/llm packages/app packages/desktop packages/stats packages/tui
git diff --name-status <previous-upstream-ref>..<latest-upstream-ref> -- packages/opencode packages/llm packages/app packages/desktop packages/stats packages/tui
```

4. Compare unreleased upstream `dev` after latest release:

```powershell
git log --oneline <latest-upstream-ref>..upstream/dev -- packages/opencode packages/llm packages/app packages/desktop packages/stats packages/tui
git diff --name-status <latest-upstream-ref>..upstream/dev -- packages/opencode packages/llm packages/app packages/desktop packages/stats packages/tui
```

5. For each candidate, classify as `take`, `manual adaptation`, or `skip for now` before editing code.

6. For any `take` or `manual adaptation`, add focused tests in `packages/opencode` and run package-local tests/typecheck only from package directories.
