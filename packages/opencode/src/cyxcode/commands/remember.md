---
description: Save a memory about this project for future sessions
---

The user wants to save something to CyxCode's project memory system.

Save the user's message as a memory file in `.opencode/memory/`.

1. Read the existing `.opencode/memory/index.json` (create if missing with `{"version": 1, "entries": []}`)
2. Generate an `id` from the content (lowercase, hyphens, max 40 chars)
3. Extract tags: file names, technology keywords, significant words
4. Write the memory content to `.opencode/memory/{id}.md` (1-5 lines max, be concise)
5. Add an entry to `index.json`:
   ```json
   {
     "id": "the-id",
     "file": "the-id.md",
     "tags": ["tag1", "tag2"],
     "summary": "one line summary",
     "created": "YYYY-MM-DD",
     "accessed": "YYYY-MM-DD",
     "accessCount": 0
   }
   ```
6. Confirm what was saved

$ARGUMENTS
