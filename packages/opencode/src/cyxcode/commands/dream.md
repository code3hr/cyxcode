---
description: Consolidate CyxCode memories, patterns, and stats (dream cycle)
---

Run the CyxCode dream consolidation cycle. This cleans up accumulated state from previous sessions.

Read ALL of these files:
1. `.opencode/memory/index.json` and every `.md` file listed in its entries
2. `.opencode/cyxcode-learned.json` (pending and approved patterns)
3. `.opencode/cyxcode-stats.json` (router stats — matches, misses, hit rate, tokens saved)
4. `AGENTS.md` at the project root

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
