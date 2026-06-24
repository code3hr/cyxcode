---
description: Consolidate CyxCode memories, patterns, and stats (dream cycle)
---

Run the CyxCode dream consolidation cycle. This cleans up accumulated state from previous sessions.

Find the project state directory by searching upward from the current directory:
1. Prefer `.cyxcode/` when it exists.
2. Fall back to `.opencode/` only when `.cyxcode/` does not exist.

Read ALL of these files when present:
1. `<state-dir>/memory/index.json` and every `.md` file listed in its entries
2. `.cyxcode/patterns/learned.json` or legacy `.opencode/cyxcode-learned.json` (pending and approved patterns)
3. `.cyxcode/stats.json` or legacy `.opencode/cyxcode-stats.json` (router stats: matches, misses, hit rate, tokens saved)
4. `<state-dir>/history/corrections/*.json` (behavioral corrections)
5. `AGENTS.md` at the project root

Then perform these consolidation steps:

**Deduplicate**: If any learned patterns have identical or near-identical regex, remove duplicates from the JSON file. Keep the one that was approved first.

**Merge memories**: If any memory entries cover the same topic (overlapping tags, similar summaries), merge them into a single entry. Combine tags, keep the best summary, update the `.md` file, remove the redundant one.

**Validate**: Remove memory entries whose `.md` files don't exist. Remove learned patterns with invalid regex. Check if file paths referenced in memory tags still exist — flag stale entries.

**Summarize stats**: Read `cyxcode-stats.json` and report:
- Total pattern matches / misses / hit rate
- Tokens saved lifetime
- Number of sessions tracked
- Top patterns by usage

**Update AGENTS.md**: If you discovered non-obvious learnings from the memories and patterns that would help future sessions (e.g., common error patterns for this project, files that are frequently worked on together), add them to the appropriate section in AGENTS.md. Keep entries to 1-2 lines.

**Report**: Summarize what was consolidated, merged, removed, and any AGENTS.md updates made.

$ARGUMENTS
