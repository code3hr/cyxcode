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
