---
description: Save a behavioral correction for CyxCode to remember
---

The user wants to save a behavioral correction. Extract the rule from their message.

Write a JSON file to `.opencode/history/corrections/` directory. The filename should be a short slug of the rule (e.g., `use-bun-not-npm.json`).

File content:
```json
{
  "id": "<filename without .json>",
  "rule": "<the correction rule>",
  "strength": 1,
  "created": "<current ISO timestamp>",
  "updated": "<current ISO timestamp>",
  "source": "explicit",
  "promoted": false,
  "decayBase": 0
}
```

If a file with a similar rule already exists in that directory, read it, increment `strength` by 1, update the `updated` timestamp, and write it back.

Create the directory if it doesn't exist: `mkdir -p .opencode/history/corrections/`

After saving, confirm: "Correction saved: {rule} (strength: {n})"

$ARGUMENTS
