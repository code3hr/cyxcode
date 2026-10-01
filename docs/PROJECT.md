# CyxCode Project Notes

CyxCode is a downstream product built from OpenCode. The repository should stay easy to audit, easy to release, and clear about which names are product-facing versus compatibility-facing.

## Product Shape

CyxCode focuses on AI-assisted command-line work with local memory, learned error patterns, project recall, and governed tool execution. Security and pentest workflows are active product areas, but the core should remain small and composable.

## Boundaries

- User-facing docs, website copy, release metadata, CLI help, and dashboard surfaces should say CyxCode.
- Compatibility internals may keep OpenCode naming when renaming would add merge churn or break existing paths, headers, packages, or config.
- Generated state belongs outside version control unless it is an intentional fixture.
- Large plans should stay local until they become maintained project documentation with owners and current status.
- Branding cleanup should preserve compatibility names when changing them would add merge churn or break existing integrations.

## Current Priorities

- Keep the root directory limited to source-of-truth project files.
- Keep release, stats, and packaging automation pointed at `code3hr/cyxcode`.
- Keep generated runtime state ignored, especially `.cyxcode/`, `.opencode/` caches, build outputs, and scan artifacts.
- Prefer small, auditable cleanup commits over broad renames.
- Validate from package directories, especially `packages/opencode`, because root-level tests are guarded.

## Core Stabilization Checkpoint (2026-10-01)

Upstream integration is paused while CyxCode's core behavior is stabilized. The deferred upstream queue and restart instructions remain in [UPSTREAM-AUDIT.md](UPSTREAM-AUDIT.md).

First completed source fix:

- Restored capture substitution in the skill executor and enabled its three skipped regression tests.
- Shared substitution with bash and session shell suggestions, including multi-digit references and literal dollar signs in captures.
- Made command approval and successful execution results carry the expanded command without changing the stored pattern template.
- Verified 30 focused tests, including a real failing shell command, and the core package typecheck. This checkpoint does not establish that the whole core is stable; the installed binary still needs a rebuild to include this fix.

Next checks, in order:

1. Audit remaining shared in-memory state across projects: recall/database handles and memory/recall background initialization and subscriptions. Router isolation alone does not establish isolation of every service.
2. Continue learning/reuse checks: coordination between separate CyxCode processes, pattern generalization versus saved commands, full application restarts, and suggestion versus execution behavior/token-savings claims.
3. Define concrete requirements for project privacy before claiming protection; verify memory, recall, and state restoration using persisted fixtures.
4. Rebuild and smoke-test the stabilized core, then decide whether to resume the deferred upstream queue.

Second source fix: learning now consumes only errors from the completing session's current user turn, including multiple assistant steps. Errors belonging to other sessions or earlier turns remain untouched. Router misses use the shared capture buffer, and router tests now exercise the production implementation instead of a copied router. A local streaming-provider regression covers turn isolation, pending-pattern approval, disk reload, and matching through a fresh learned skill. Full startup/restart and cross-project isolation remain pending.

Validation: 75 focused tests passed across the capture, learning, router, shell, and session prompt suites; the core package typecheck passed.

Third source fix (2026-10-01): project-state lookup now follows the active instance, stops at Git/worktree/workspace boundaries even without a state directory, and excludes home state when walking up from a child directory. Its bounded cache is keyed by the resolution context. Existing `.cyxcode` preference and `.opencode` compatibility paths remain supported; explicit global path APIs still resolve to home.

Validation: 136 tests passed across path resolution, concurrent project policy writes, memory, wiki, instance lifecycle, learning, prompts, versioning, and CyxWatch. The core package typecheck passed. All 42 CyxWatch tests passed, including the previously reported shell-recording/risk case; that historical failure was not reproduced. The installed executable still predates these core fixes.

Fourth source fix (2026-10-01): routers, loaded project patterns, readiness, and counters now belong to the active project instance. Global/community tiers remain available to each project. Disposal waits for pattern loading, and the next instance loads patterns afresh. The existing `SkillRouter` facade resolves the caller's project.

Learning additions, approvals, rejections, and Dream pattern maintenance now lock the entire read/modify/write operation per file within one process. Writes use a temporary file and rename; storage errors propagate instead of reporting success, and generated IDs use UUIDs to avoid same-millisecond collisions. Tests reproduce lost simultaneous additions and shared routers, then verify independent project stores, approvals, deduplication, maintenance, failure recovery, and reload. Cross-process locking and recall isolation remain pending.

Validation: 92 tests passed across 11 files covering pattern storage and project isolation, routing, learning, templates, shell suggestions, session prompts, and instance lifecycle. The core package typecheck and source CLI version smoke check passed. The installed executable has not been rebuilt for these changes.

Full-session fixtures must create their own project and state markers and assert the resolved storage path before writing. Disable inherited external skills/prompts and model catalog refresh when running the learning regression:

```powershell
cd packages/opencode
$env:CYXCODE_DISABLE_CLAUDE_CODE = 'true'
$env:CYXCODE_DISABLE_EXTERNAL_SKILLS = 'true'
$env:CYXCODE_DISABLE_MODELS_FETCH = 'true'
bun test test/session/learning.test.ts test/cyxcode/router.test.ts test/cyxcode/learned.test.ts --timeout 30000
```

Focused capture regressions, from `packages/opencode`:

```bash
bun test test/cyxcode/base-skill.test.ts test/cyxcode/template.test.ts test/cyxcode/template-shell.test.ts test/cyxcode/pattern-match.test.ts --timeout 30000
```

## Validation

For source changes in `packages/opencode`:

```bash
cd packages/opencode
bun typecheck
```

For documentation or metadata-only cleanup:

```bash
git diff --check
```

For website changes, build from `packages/web` when the local environment permits it:

```bash
cd packages/web
bun run build
```
