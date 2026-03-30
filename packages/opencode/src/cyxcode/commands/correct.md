---
description: Save a behavioral correction for CyxCode to remember
---

The user wants to save a behavioral correction. Extract the rule from their message.

Find the `.opencode/history/corrections/` directory at the project root (search upward from current directory for the `.opencode` folder). Write a JSON file there. The filename should be a short slug of the rule (e.g., `use-bun-not-npm.json`).

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

Create the directory at the project root if it doesn't exist (look for the directory that contains AGENTS.md or package.json).

After saving, confirm: "Correction saved: {rule} (strength: {n})"

$ARGUMENTS
