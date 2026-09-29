# Upstream Audit

This file tracks selective upstream opencode updates for CyxCode. Use it to avoid broad merges that overwrite CyxCode-specific branding, commands, update flow, TUI behavior, skills, or security tooling.

## Current Pickup (2026-09-29)

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

### CyxCode Zen access correction

- Runtime verification exposed `OpenCode's free tier can only be used from within OpenCode` when selecting Big Pickle through anonymous OpenCode Zen access.
- Removed the inherited public-key autoload. Hosted Zen now requires configured credentials; missing keys and the `public` placeholder do not count as a connection. Explicit custom endpoints remain supported.
- The existing TUI skips unavailable saved models and opens the provider connection dialog when no model is available. The connection indicator now uses available providers, and the Zen setup prompt points to the actual [OpenCode Zen service](https://opencode.ai/docs/zen/) while retaining CyxCode application naming.
- Validation: 82 provider tests pass, including 10 new Zen access regressions; package-local type checking passes. No paid model request was made. Using a model still requires an account or configured local endpoint with access to that model.
- Reopened the development TUI with the user's existing OpenAI OAuth credentials; the visible model selection is GPT-5.5 through OpenAI.
- On 2026-09-29, a minimal live GPT-5.5 request using the rebuilt Windows executable failed with `Token refresh failed: 401`. The saved OpenAI connection requires reauthentication through `/connect` or `cyxcode providers login`; successful live inference remains unverified. This is separate from the Zen free-tier restriction.

### Tool and provider follow-up (2026-09-29)

- Status: seven additional upstream fixes adapted against the pinned release above. The overall release audit remains partial.
- `765ae641d7` (`take`): preserve a running tool's original start time when its metadata changes.
- `9f38562237` (`take`): include cache-write tokens in ACP context usage, matching CyxCode's existing prompt token accounting.
- `517ee736b3` (`manual adaptation`): discard unsigned Bedrock reasoning before replay while retaining signed and redacted blocks. Use the pinned SDK's `redactedData` field; upstream's newer `redactedContent` field is unsupported here.
- `49d997aec3` (`take`, adapted): disable xAI response storage for normal and small requests, retaining the existing prompt-cache-key patch. The bundled SDK request test verifies both fields.
- `3033afba51` (`take`, adapted): normalize Mistral-family tool IDs for Codestral, Pixtral, and Mixtral as well as Mistral and Devstral, including models exposed through aliases.
- `d468201952` (`manual adaptation`): expire truncated tool output using filesystem modification time. Current opaque tool IDs cannot safely be decoded as timestamps. Keep CyxCode's existing Effect filesystem service and retention interval.
- `f7da00f35e` (`take`): omit absent `movePath` properties from patch permission metadata while preserving move destinations.
- Validation: 214 tests pass across provider transforms, xAI SDK requests, ACP events, truncation, patching, and session prompts; package-local `bun typecheck` passes. The existing file-attachment test now explicitly configures a test provider instead of relying on anonymous Zen access. Tool start-time preservation has source review and existing prompt coverage, without a dedicated streaming integration test.
- Built and installed Windows version `3.0.4-upstream.20260929` locally, including app, dashboard, commands, and default skills. The build's version smoke test passed and the installed executable's SHA-256 matches the build output. Backed up the previous installation before copying. This does not publish a release or change package versions.

### Retry reliability follow-up (2026-09-29)

- `c78986831c` (`manual adaptation`): cap session retries at five and add up to 25% jitter to exponential backoff. Apply the limit in CyxCode's existing processor loop rather than importing upstream's Effect retry scheduler. Honor valid provider retry hints without jitter, reject negative/non-finite hints, and cap delays to the timer limit.
- `f929f8f100`, `61aefc0759`, `71d08e94d5`, `40282c1d4d` (`manual adaptation`): recognize transient network, rate-limit, server, and capacity errors in plain text and API responses. Stop retrying arbitrary JSON errors. Preserve context-overflow handling and CyxCode's existing error/status interfaces. Numeric status matching uses word boundaries so model identifiers containing similar digits do not become retryable.
- Cancellation now checks an already-aborted signal before sleeping and before starting another attempt. CyxWatch policy and network enforcement remain unchanged; the integration fixture explicitly allows only its temporary loopback server.
- Corrected the Zen quota message to link to the actual OpenCode Zen account page. Expanded the README with connection steps and the distinction between rejected anonymous access and still-unverified authenticated access to free models.
- Validation: all 44 focused retry and processor tests pass, along with package-local `bun typecheck`. Tests cover backoff, headers, classification, and cancellation. Real processor tests use the bundled SDK and a local HTTP server to verify six total failed requests, five retry-status events, saved terminal errors, idle state, and cancellation without another request. No paid requests or real credentials are used.

### Timeout and CLI permission follow-up (2026-09-29)

- `67caf894e0`, `b04697366f`, `4eb29a64f0` (`manual adaptation`, completed): add a separate response-header timer and five-minute header/stream defaults within CyxCode's existing provider wrapper. Clear the header timer on success or failure, including a synchronous custom-fetch exception. Preserve the default CyxWatch fetch boundary, custom fetch functions, caller cancellation, explicit total-request deadlines, and the previous SSE cancellation fix.
- Header timeouts convert to retryable API errors and use the already-backported bounded session retry policy. They remain distinct from user cancellation.
- Configuration: `headerTimeout` and `chunkTimeout` default to `300000` milliseconds and each accepts `false` to disable its timer. Preserve `timeout: false` by disabling implicit phase timers too; explicitly configured phase timers still apply. A numeric `timeout` remains a separate total-request deadline. Updated schema descriptions to reflect this behavior.
- Regenerated the JavaScript SDK with `packages/sdk/js/script/build.ts` and retained the provider configuration changes only. Unrelated generated event changes were excluded from this batch.
- `08faeb3893` (`take`, adapted): `cyxcode run` tracks descendant sessions announced by `session.created` events and rejects their unanswered permission requests using CyxCode's existing noninteractive policy. Unrelated sessions are ignored; no automatic permission grants are introduced.
- Validation: 83 tests pass across provider timeouts, the real CLI subprocess, message conversion, retries, and processor termination/cancellation. The provider-specific CyxWatch boundary check, local-policy exception check, and blocked-network check also pass. The combined CyxWatch run encountered a Windows `EBUSY` cleanup failure; the affected blocked-network test passes in a fresh process. Package-local type checks pass for the core package and SDK. Five-minute defaults are verified with accelerated timers; no paid model request was made.

### Sampling and Vertex follow-up (2026-09-29)

- `5e39051183` (`take`, adapted): omit deprecated Gemini sampling defaults outside the supported model families. Select temperature, top-p, and top-k using API IDs so configured aliases behave like their underlying models. Preserve existing MiniMax, Kimi, GLM, and Claude defaults.
- `8b65fa2ef6` (`take`): remove forced Qwen temperature and top-p defaults, leaving provider defaults and explicitly configured sampling settings in control.
- `5d953482ab` (`take`): scope DeepSeek V4 Flash top-p defaults to the dated `0731` models or the direct DeepSeek/OpenCode provider IDs. Other gateways keep their defaults for undated models. These are service identifiers, not application branding changes.
- `361a71ffad` (`manual adaptation`): route Google Vertex `us` and `eu` multi-regions through `aiplatform.<location>.rep.googleapis.com` in the existing URL-variable loader. Preserve global/regional endpoints and explicit proxy URLs; no SDK or dependency change.
- Validation: 189 focused tests pass, including 32 sampling cases, six actual bundled Vertex SDK requests with captured URLs, fixture responses, and a local test credential, existing provider transforms, proxy/OpenAI-compatible behavior, and the CyxWatch network boundary. Package-local `bun typecheck` and formatting checks pass. No live cloud request was made.
- Initially source-only; now included in the Windows rebuild recorded below, together with retry and timeout changes.

### Provider options and Copilot follow-up (2026-09-29)

- `8168f0f0f6` (`take`, completed): select Gateway Anthropic reasoning variants by API ID, completing the earlier Google/API-ID adaptation. Aliases now retain adaptive or budgeted thinking, and misleading display IDs cannot switch an OpenAI model to Anthropic options.
- `c0f09afef5` (`take`): send the session ID as Copilot's `X-Interaction-Id` before session lookups. Preserve Anthropic headers and the existing subagent/compaction `x-initiator` rules, including when lookups fail.
- `542ba88602` (`partial manual adaptation`): select cache keys by the bundled SDK for OpenAI, Azure, xAI, Cerebras, and DeepInfra. Add the Cerebras/DeepInfra option namespaces needed for custom provider names. Preserve existing Venice/OpenRouter compatibility defaults, and honor `setCacheKey: false` for those services and Zen without dropping Zen's encrypted reasoning metadata.
- The remaining cache changes are deferred: the pinned Mistral SDK does not serialize upstream's new cache-key option; broader namespace additions, Venice SDK routing, and Anthropic automatic caching need their own compatibility checks. Existing per-message caching and Gateway caching behavior are preserved.
- Validation: 167 regression tests pass across provider transforms, actual bundled SDK cache-key requests, xAI Responses, and Copilot headers; package-local type checking passes. Request fixtures use synthetic credentials and captured HTTP responses, with no live inference request.
- Initially source-only; now included in the Windows rebuild recorded below.

### Config-only loaders and Cerebras limits (2026-09-29)

- Fixed the CyxCode provider-loader issue found during the preceding batch: explicitly configured providers now register their custom loaders even without an environment or saved-auth connection. Keep the existing merge order so explicit config options and headers retain precedence over loader defaults.
- OpenAI/xAI loaders retain `languageModel` fallback for configured SDKs without a Responses API. Request tests cover config-only OpenAI/xAI Responses, Azure Responses/chat selection, custom OpenAI-compatible SDK overrides, proxy URLs, credentials, and headers. The xAI cache-key regression now uses config-only credentials without its former environment workaround.
- `e49772a8b4` (`manual adaptation`, completed): omit the generic output-token limit for the Cerebras SDK when the final plugin-adjusted options contain `max_completion_tokens`. Keep the existing LLM request boundary and plugin contract; no new plugin or SDK migration. Preserve generic limits for other SDKs and Cerebras requests without an explicit completion limit.
- Validation: 167 tests pass: 20 focused loader/cache-key/Cerebras cases, 134 existing provider/Bedrock/GitLab/Vertex/Zen cases, and 13 LLM cases. Cerebras tests exercise real LLM streams through the bundled SDK and a local server, including model, agent, variant, and plugin settings. Package-local type checking passes.
- Repaired the older LLM test fixture's missing local-network policy: bind its server to loopback and explicitly allow only that server's host/port in each temporary instance. The initial run timed out at the network boundary; all 13 tests pass with the scoped fixture policy. Production CyxWatch enforcement is unchanged, and its provider-boundary regression passes.
- Initially source-only; now included in the Windows rebuild recorded below. No live cloud request was made.

### MiniMax compatibility and Windows rebuild (2026-09-29)

- `50eee1f5a4` (`manual adaptation`, completed with prerequisite behavior): add MiniMax M3 `none`/`thinking` variants using API IDs, including aliases. Use `chat_template_kwargs.thinking_mode` for NVIDIA/Lilac's OpenAI-compatible transport and native `thinking` options for Anthropic and other OpenAI-compatible transports. Enable adaptive thinking by default for reasoning-capable MiniMax M3 models using Anthropic, whose service defaults thinking off.
- Keep older MiniMax handling and the reasoning-capability gate. Restrict NVIDIA/Lilac template options to the OpenAI-compatible SDK because the pinned Anthropic SDK would discard them. That SDK also omits disabled thinking from the wire; the `none` variant therefore relies on the MiniMax Anthropic endpoint's default-off behavior, without a live service verification.
- Validation: 161 provider tests pass and package-local type checking passes. Five bundled-SDK request tests exercise default, disabled, and enabled thinking through custom aliases, NVIDIA, and Lilac. No dependency changes.
- Built and installed `3.0.4-upstream.20260929.2` for Windows x64 with app, dashboard, commands, and default skills. This includes every completed batch above. Used the tracked model catalog as build input and restored both generated snapshot files byte-for-byte afterward; dependency installation and release publishing were disabled.
- Compiled CLI validation: an isolated `cyxcode run` against a temporary loopback model server returned `cyxcode-smoke-ok`. Both requests retained `max_completion_tokens: 1234` and omitted the conflicting generic `max_tokens`. The fixture used isolated config/data directories, a synthetic key, and a CyxWatch rule scoped to the temporary server. This is a local runtime check, not live cloud-provider verification.
- Installed version check passes. Executable SHA-256: `0291CD36CC4546A96BE80AFEB685DB1C3E9F9B54731E336A7E15BCDAE877A690`. Previous installation backup: `C:\Users\chick\AppData\Local\Temp\cyxcode-install-backup-20e2fbb76d754d28bb3cf721d4b6ef30\bin`.
- Build diagnostics remain in the unchanged UI: invalid `:selected` CSS selector warning, large JavaScript chunks, and an outdated Browserslist database. Both web asset builds and executable compilation completed. The prior OpenAI OAuth refresh failure still requires user reauthentication; authenticated Zen free-model access remains unverified.

### Review next and exclusions

- `c3be6c4965` (`manual adaptation`, deferred): configurable MCP callback ports require coordinated config, listener, and OAuth changes. CyxCode currently uses a fixed callback port; importing only the debug-command change would not provide working support.
- `e63996919b` (`skip for now`): the grep symlink fix targets upstream's replacement search implementation. CyxCode retains the existing absolute-path ripgrep handling, so the upstream path reconstruction change does not map to this implementation.
- `7c2199d84a` (`manual adaptation`, deferred): GitLab reasoning variants depend on newer reasoning metadata and SDK option handling; review those together before importing.
- `b8374b5a7c` (`skip for now`): the Copilot billing-batch division belongs to upstream's dynamic model discovery, which CyxCode does not implement. CyxCode's existing OAuth loader sets model costs to zero; there is no corresponding division to patch.
- `cba6b5f2f7`, `f8b4dd70ac` (`manual adaptation`, deferred): native Cloudflare OpenAI/Anthropic passthrough and Anthropic slug normalization must be reviewed together with the gateway response/fallback path. CyxCode currently uses the unified gateway adapter, so applying the slug change alone would target a nonexistent native path.
- `02a167e048` (already covered in part), `500c46ec79` (`manual adaptation`, deferred): CyxCode already compares GPT major/minor numbers separately for its future GPT-5.x rule. Upstream's broader integer-version/suffix acceptance changes the OAuth allowlist policy; review it together with unsupported aliases and context limits. The explicit GPT-6 Sol/Luna allowlist remains active.
- Remaining core review priorities include model/provider changes tied to newer SDKs and the compatibility work described here for ACP and MCP. The full release audit has not been declared complete.
- Config-only custom loader registration and `e49772a8b4` Cerebras completion limits are completed in the batch above.
- `561afb401a`, `a9a6fad0fa` (`skip for now`): Copilot PDF discovery and summarized adaptive thinking target upstream's dynamic model discovery/native Anthropic path. CyxCode's current loader uses the existing Copilot SDK path; review discovery and endpoint selection together before enabling these capabilities.
- `e434ce01d3`, `8571a922db` (`manual adaptation`, pending): OpenAI pro modes and Merge Gateway reasoning metadata have prerequisites absent from CyxCode's current model schema or variant handling. Review supported SDK request shapes before importing each behavior.
- `2b2aacc939` (`manual adaptation`, deferred): modern Claude adaptive thinking requires coordinated SDK support. Both pinned Anthropic and Bedrock SDKs limit effort to `low`/`medium`/`high`/`max`, so upstream's `xhigh` is rejected, and their thinking schemas do not forward `display: summarized`. Keep the existing Claude behavior until the SDK and reasoning-replay changes can be validated together. MiniMax M3 is completed above.

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
