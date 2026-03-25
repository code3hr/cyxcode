---
description: Review and approve learned CyxCode patterns
---

Read the file `.opencode/cyxcode-learned.json`.

If the file doesn't exist or has no pending entries, say "No pending patterns to review."

Otherwise, show the user all **pending** patterns as a numbered list. For each:
1. **Error** (first 100 chars of errorOutput)
2. **Regex**: the generated regex
3. **Fix**: the suggested fix command or description
4. **Learned from**: the failed command

Then ask the user which patterns to:
- **Approve** (move from pending to approved — will be active on next restart)
- **Reject** (remove from pending)
- **Skip** (leave as pending for later)

Update the JSON file by moving approved entries from the `pending` array to the `approved` array, and removing rejected entries.

After updating, summarize what was approved/rejected.

$ARGUMENTS
