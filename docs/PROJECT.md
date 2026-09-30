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

## Core Stabilization Checkpoint (2026-09-30)

Upstream integration is paused while CyxCode's core behavior is stabilized. The deferred upstream queue and restart instructions remain in [UPSTREAM-AUDIT.md](UPSTREAM-AUDIT.md).

First completed source fix:

- Restored capture substitution in the skill executor and enabled its three skipped regression tests.
- Shared substitution with bash and session shell suggestions, including multi-digit references and literal dollar signs in captures.
- Made command approval and successful execution results carry the expanded command without changing the stored pattern template.
- Verified 30 focused tests, including a real failing shell command, and the core package typecheck. This checkpoint does not establish that the whole core is stable; the installed binary still needs a rebuild to include this fix.

Next checks, in order:

1. Verify production pattern routing, unmatched-error fallback, learning, and reuse across sessions; replace coverage that only tests copied router logic. Check suggestion versus execution behavior and token-savings claims against the real paths.
2. Reproduce or retire earlier CyxWatch shell-recording/risk failures and verify permission boundaries. Define concrete requirements for project privacy before claiming protection.
3. Verify memory, recall, project isolation, and state restoration using persisted fixtures.
4. Rebuild and smoke-test the stabilized core, then decide whether to resume the deferred upstream queue.

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
