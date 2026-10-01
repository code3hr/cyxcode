# CyxCode session resume

Updated: 2026-10-01 (Asia/Dubai).

## Start here next session

The website redesign and v3.0.5 publication are complete. Continue **CyxCode core stabilization**, starting with recall/database isolation and background-service ownership across projects. Further upstream backports remain paused by user decision.

1. Read `AGENTS.md`, this file, `docs/PROJECT.md`, and the paused-work section of `docs/UPSTREAM-AUDIT.md`.
2. Check `git status --short` and branch/remote revisions before editing. Preserve existing local work.
3. Inspect recall database handles, memory/recall initialization, and subscriptions for process-global state. Reproduce any cross-project leak with isolated fixtures before changing ownership.
4. Make the smallest verified fix, run focused package tests and `bun typecheck`, and update the checkpoint.

This file supersedes older statements in the project/upstream notes that the sync branch has not reached `dev` or that no release includes the stabilization fixes. Those documents still contain useful historical checkpoints and the pending audit.

## Repository and published baseline

- Workspace: `D:\Dev\cyxcode\cyxcode`.
- Current local branch: `sync/mcp-oauth-upstream-2026-06-28`.
- Released commit: `1c61b5620fcb37ccd3a8b1da25584a1229e34b99` (`feat(web): redesign CyxCode website and clarify setup`).
- `origin/dev` and `origin/sync/mcp-oauth-upstream-2026-06-28` both pointed to that commit at publication; the subsequent handoff documentation commit advances both branches. Default branch is `dev`; local `dev` may need refreshing.
- Published tag: **v3.0.5**, following v3.0.4. Recheck releases before choosing any future tag; do not recreate this release.
- [Live website](https://code3hr.github.io/cyxcode/).
- [Release and downloads](https://github.com/code3hr/cyxcode/releases/tag/v3.0.5).
- [Successful Pages deployment](https://github.com/code3hr/cyxcode/actions/runs/36843827570).
- [Successful release workflow](https://github.com/code3hr/cyxcode/actions/runs/36844547663).
- Always pass `--repo code3hr/cyxcode` to `gh run` and `gh release`; the CLI may otherwise target upstream OpenCode.

## Completed and verified

### Public website

The public GitHub Pages site lives in **`WEB/`**. Read `WEB/README.md` for development and deployment instructions; the separate `packages/web` package is not this website.

- Redesigned homepage, navigation, footer, feature sections, workflow examples, and installation guidance while retaining CyxCode branding.
- Added interactive Recover/Remember/Review examples, truthful model-access guidance, clipboard failure feedback, keyboard navigation, mobile layouts, and a poster for the existing demo recording.
- Removed the simulated live token-savings counter and misleading hosted-service claims.
- Fixed Windows path-casing build behavior and added a generated CSS asset check, including the `/cyxcode` Pages base path.
- Verified all eight pages at 1440, 768, 390, and 320 pixel widths; 36 internal links/anchors; interactions; keyboard handling; and navigation without JavaScript. Automated accessibility checks reported no violations in the checks run.
- Production build passed. Live Pages homepage, styles, interactive workflow, and installation route passed after deployment.

### Core fixes included in v3.0.5

- Pattern captures substitute consistently in suggestions, approval prompts, and executed commands.
- Learned errors remain associated with the originating session and user turn.
- Project paths respect active instances and Git/workspace boundaries.
- Routers, loaded patterns, readiness, and counters belong to each project instance.
- Learning additions, approvals, rejections, and maintenance serialize complete storage operations within one process; temporary-file writes/rename and propagated storage errors replace silent success.
- Previously completed provider compatibility, configurable MCP OAuth callback ports, and ACP model/mode/reasoning selection and persistence updates are included.
- Detailed source validation is recorded in `docs/PROJECT.md` and `docs/UPSTREAM-AUDIT.md`. Test totals from successive checkpoints overlap; do not add them together.

### Release verification

- All five native builds passed: Linux x64/ARM64, macOS Intel/Apple Silicon, Windows x64.
- Five archives plus `checksums.sha256` are published; all archive checksum entries match GitHub asset digests.
- Release code-only vulnerability gate passed. This is not a full dependency vulnerability audit.
- All 13 push-hook typecheck tasks passed (cached results).
- Downloaded Windows archive checksum verified; binary reports `3.0.5`.
- Isolated Windows package smoke passed: `/path`, `/app/`, `/dashboard/`, and `/experimental/codegraph/graph` all returned HTTP 200.
- Release notes explain changes, model-access limits, and remaining stabilization work.
- The user's installed local CLI was **not replaced** during publication. Last recorded installed build is `3.0.4-upstream.20260930.1`; inspect the actual executable before assuming it is current.

## Pending work, in priority order

1. **Recall/database and background-service isolation:** database handles, memory/recall initialization, subscriptions, and disposal across concurrent project instances.
2. **Learning correctness:** coordination between separate CyxCode processes (current locks are in-process only); generalized error matching versus commands containing the original literal; application restart/persistence; suggestion versus execution behavior and token-savings claims.
3. **Privacy requirements:** turn the ideas in the user's local planning files into explicit requirements and acceptance checks before claiming guarantees. Verify memory, recall, and state restoration using persisted fixtures.
4. **Live integrations:** authenticated model generation, multi-step tools, and an external ACP editor remain to be verified. The last recorded OpenAI token-refresh attempt failed with 401 and needs reauthentication if still applicable. No successful live Muse or authenticated free Zen access is established.
5. **Local testing:** install/rebuild the current CLI when resuming hands-on testing if the user wants to test the installed command. The released Windows artifact has already passed the isolated smoke above.
6. **Upstream, only after stabilization:** revisit `docs/UPSTREAM-AUDIT.md`; unfinished work includes reasoning adapters, Claude/Kimi thinking, Cloudflare routing, OpenAI modes/filtering, prompt caching, Muse prompt review, and the remaining release delta. Integration into `dev` and publication of the completed work are now done; the full upstream audit is still incomplete.

Preserve CyxCode features, names, commands, CyxWatch, memory/state behavior, and update identity. Retain OpenCode compatibility internals where renaming would break compatibility or create unnecessary merge churn.

## Model-access facts to preserve

Anonymous OpenCode Zen requests were rejected by the service. Do not claim that changing a signature/header restores access or that the exact server-side enforcement mechanism was verified. CyxCode's README and website explain `/connect`, then `/models`, using supported credentials or a configured local model. Authenticated access to hosted free models depends on the service and remains unverified in CyxCode.

## Working-tree and test precautions

- At handoff, `docs/tofix.md` is user-modified. Untracked work includes `docs/plantofix.md`, `demo/`, `.opencode/wiki/`, `lean-software-guardrails/`, temporary test directories, and logs. Do not overwrite, delete, or stage these wholesale.
- Run tests and `bun typecheck` from package directories, especially `packages/opencode`; root-level tests are guarded.
- Full-session fixtures must use isolated home/XDG paths, database paths, and explicit project markers, and assert resolved paths before writing. An earlier test touched home state; that incident was corrected. Avoid repeating it.
- Read the learning-test environment instructions in `docs/PROJECT.md` to disable inherited external skills/prompts and model catalog refresh.
- The release build derives its version from the tag via `CYXCODE_VERSION`; the source package version is not the public release version. Use `.github/workflows/release.yml` for cross-platform releases.
- Temporary verification artifacts may remain under `%TEMP%\cyxcode-release-v3.0.5` (downloaded archive, extracted binary, isolated smoke logs) and `%TEMP%\cyxcode-v3.0.5-notes.md`. These are conveniences, not durable project documentation.

## Handoff file status

This `resume.md` is maintained in a documentation commit after v3.0.5 publication. The release tag remains on the tested release commit above.
