# Upstream Sync Notes

This note tracks the next clean sync work for CyxCode against upstream OpenCode.

## Why This Exists

CyxCode is a fork of OpenCode. The goal is to pull in safe upstream fixes without disturbing CyxCode-specific work such as CyxWatch, memory, state versioning, branding, and release plumbing.

## Upstream Findings

I checked the upstream OpenCode repo. The latest release I found is `v1.17.8` from June 17, 2026. The notable additions are:

- Faster session timelines with less flicker and scroll jumping.
- MCP/provider fixes:
  - OpenAI-compatible providers now accept MCP tool schemas that previously failed validation.
  - Cloudflare AI Gateway now receives the configured API key correctly.
  - MCP tools without declared schema properties now work with stricter providers.
  - Long-running MCP tools keep their timeout alive when they report progress.
  - MCP OAuth now shuts down its callback server after auth or cancel, and failures show the server error text.
- Desktop UX:
  - A Home tab toggle to switch between Home and the last tab.
  - A faster file and folder picker in the v2 layout.

I also checked the current upstream `dev` history. The newest work is mostly small fixes and refactors:

- titlebar tab overflow handling
- duplicate renderable ID handling in the TUI
- subtask spacing in the TUI
- project copy refactors for v2
- structured MCP output
- cleanup of closed MCP clients

## Safe Way To Stay Current

1. Fetch upstream regularly with `git fetch upstream`.
2. Review only the new commits since the last sync point.
3. Cherry-pick only narrow fixes that are clearly safe.
4. Keep them on a short-lived sync branch first.
5. Run typecheck and focused tests before merging back to `dev`.

## Good Sync Candidates

- MCP schema and provider fixes
- OAuth and auth callback cleanup
- TUI rendering and layout bug fixes
- build and release fixes
- test-only or smoke-test-only improvements

## Do Not Import Blindly

- CyxCode branding changes
- CyxWatch security policy plumbing
- memory and state versioning logic
- release workflow assumptions that differ from the fork
- docs that describe upstream-only behavior

## Sources

- https://github.com/anomalyco/opencode/releases
- https://github.com/anomalyco/opencode/commits/dev/
