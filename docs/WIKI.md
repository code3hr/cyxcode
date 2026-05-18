# CyxCode Knowledge Wiki

*Local markdown notes with wikilinks, backlinks, and graph indexing.*

---

## What it is

CyxCode now treats markdown notes as first-class project knowledge. The wiki layer scans project markdown, parses `[[wikilinks]]`, computes backlinks, and keeps a local index of notes that the AI can reuse as context.

It is:

- **Local-first.** Notes stay in the project under `.cyxcode/wiki/` or `.opencode/wiki/`.
- **Markdown-native.** Existing `.md` files are indexed directly, no separate note format required.
- **Graph-aware.** Each link becomes an edge in the knowledge graph.
- **Retrieval-friendly.** Wiki notes can be injected into the session prompt and indexed into recall.

---

## How it works

### File layout

CyxCode creates a wiki directory during `cyxcode init`:

```text
.cyxcode/wiki/
```

If the project is still on legacy state, the fallback is:

```text
.opencode/wiki/
```

The wiki index lives beside the notes as `index.json`.

CyxCode also exposes a small CLI on top of the same storage:

```bash
cyxcode wiki create "Architecture Notes" --tags architecture,design
cyxcode wiki rename docs/architecture "Architecture Notes"
cyxcode wiki delete docs/obsolete
cyxcode wiki query architecture
```

### Wikilinks

Use `[[note name]]` inside any markdown file.

Examples:

```md
# Architecture

See [[api design]] and [[deployment notes]].
```

CyxCode resolves those links into:

- `links` from the current note
- `backlinks` from other notes that reference it
- graph edges for the dashboard/API

### Prompt integration

When the AI builds its system prompt, CyxCode now loads relevant wiki notes alongside project memories. That means a note can influence a session without being manually pasted into chat.

### Dashboard integration

The web app includes a knowledge page at `/:dir/knowledge` with:

- a searchable note list
- a graph view of links and backlinks
- a detail panel for the selected page
- create, rename, edit, and delete actions for wiki notes
- a rebuild action for refreshing the local index

The unified graph view folds wiki notes, code files, memories, learned patterns, and semantic facts into one view.
The graph can expand by hop depth and jump into the wiki note or source detail view for focused inspection.

### Separate code graph

Source imports and top-level symbols are tracked in a separate code graph under `/experimental/codegraph`. That scanner is for source relationships, while the wiki index is for markdown notes and `[[wikilinks]]`.

Wiki notes can also point at code files or symbols, and the unified graph records those references as cross-layer edges.

### Recall integration

Wiki notes are also indexed into the semantic recall layer. That lets CyxCode surface related project docs when a task, error, or discussion matches the content of a note semantically, not just by exact keyword.

### Verification

The wiki and graph layer is covered by the targeted package tests:

```bash
cd packages/opencode
bun test test/cyxcode/wiki.test.ts test/cyxcode/graph.test.ts test/session/prompt.test.ts
```

Those tests cover wikilinks, backlinks, wiki CRUD, unified graph build, and prompt assembly with graph context.

---

## Current API surface

The first implementation exposes these experimental endpoints:

- `GET /experimental/wiki`
- `GET /experimental/wiki/graph`
- `GET /experimental/wiki/page?id=...`
- `POST /experimental/wiki/rebuild`
- `POST /experimental/wiki/page`
- `PATCH /experimental/wiki/page?id=...`
- `DELETE /experimental/wiki/page?id=...`
- `GET /experimental/graph`
- `GET /experimental/codegraph`
- `GET /experimental/codegraph/graph`
- `GET /experimental/codegraph/page?id=...`
- `POST /experimental/codegraph/rebuild`
- `GET /experimental/memory`
- `GET /experimental/memory/page?id=...`

These are enough to inspect the index, fetch a page, and rebuild backlinks after edits.

---

## Usage

1. Create or edit markdown notes in your project.
2. Add `[[wikilinks]]` between related notes.
3. Run `cyxcode init` so the wiki directory exists.
4. Rebuild the wiki index if you want an immediate refresh.
5. Start a session and let CyxCode pull relevant wiki context automatically.

---

## What this is for

- Architecture notes that should stay connected to real code.
- Project docs that AI should remember without re-reading from scratch.
- Design decisions, runbooks, and implementation notes that benefit from backlinks.

---

## What it is not

- It is not a replacement for git history.
- It is not a database-backed CMS.
- It is not full Obsidian parity yet.

The current goal is a simple, local knowledge layer that compounds project docs into useful AI context.
