# Semantic Recall Layer

*Pattern matching catches 80% of errors for free. For the other 20%, recall finds what you've seen before — semantically, locally, still for free.*

---

## What it is

The recall layer is CyxCode's semantic memory over everything you've already indexed: project memories, learned patterns, and auto-captured errors. When the 170+ hardcoded patterns miss, recall scans your prior indexed knowledge for *semantically similar* prior errors and injects them into the LLM's context — **without a single API call**.

It is:

- **Additive.** Zero edits to `memory.ts`, `learned.ts`, skills, or the router. Delete `packages/opencode/src/cyxcode/recall/` and CyxCode runs exactly as it did before.
- **Local.** A 25 MB MiniLM model runs on your CPU via WebAssembly. No network, no API key, no cloud.
- **Free.** Zero LLM tokens spent on retrieval. Ever.
- **Fast.** Sub-millisecond similarity search at <10k stored rows via brute-force dot product on unit-normalized vectors.

---

## Why it exists

CyxCode already had the raw capture: `memory.ts` stores project-scoped memories by tag, `learned.ts` auto-captures unmatched errors and generates regex patterns from the AI's fixes. But the matching was **exact**: tag-keyword lookups and regex patterns that only fire on syntactic matches.

That means:

- The AI solves `pnpm install failed: ENOENT lockfile` — CyxCode learns a pattern.
- Tomorrow the same user types `pnpm install broken, lockfile gone` — different words, same meaning.
- The regex misses. The AI solves it *again*. Tokens burned. Same knowledge, relearned.

Recall fixes this: when the regex misses, recall does a vector similarity search over everything we've already indexed. If it finds a prior match, it surfaces that context to the AI automatically.

---

## Use cases

### 1. Recurring errors with different surface syntax

You hit `pnpm install failed: ENOENT lockfile` on Monday. The AI solves it (costs tokens), `learned.ts` captures the fix, and recall indexes the error+fix pair. On Thursday you hit `npm ci broken - lockfile missing` — different package manager, different words, same class of problem. The 170+ regex patterns won't match (they're syntactically different). But recall scores it at ~0.85 similarity against Monday's indexed entry and injects that prior context into the LLM's prompt. The LLM gets "you solved something like this before, here's what worked" and produces the fix on the first turn instead of the multi-turn diagnostic.

**Savings:** ~2000-4000 tokens per recurrence (3-turn diagnostic compressed to 1 turn). Compounds over a month of daily development.

### 2. Cross-session project memory recall

You spent a session last week debugging a Docker build that failed with `no space left on device`. Memory captured it during session compaction: the discovery, the fix (`docker system prune -a`), the context. Tagged as `[docker, disk, prune]`.

Three weeks later, a CI pipeline fails with `ENOSPC: write failed`. The keyword tags don't match — `ENOSPC` isn't in `[docker, disk, prune]`. Memory's tag-based lookup misses it. But recall's vector search catches the semantic overlap between "no space left on device" and "ENOSPC write failed" (~0.78 similarity). The LLM sees the prior fix context without you re-explaining the situation.

**Gap filled:** Tags work for exact keyword matches; embeddings work for *meaning* matches. This is the exact gap between CyxCode's existing tag-based memory and what users actually need.

### 3. Pattern learning acceleration

Every time `learned.ts` approves a new pattern, recall indexes it with its description and regex. As patterns accumulate per project, the recall index becomes a growing semantic knowledge base of "errors this project has seen." When a genuinely novel error appears that no pattern matches, recall can still surface the *nearest-neighbor* pattern — not as a fix, but as diagnostic context: "this looks similar to a webpack chunking error you solved before."

**Effect:** The LLM doesn't start from zero on ambiguous errors. It starts from "here's the closest thing in your project's history," shaving off the initial diagnostic phase where the AI asks clarifying questions.

### When recall does NOT help

- **First-time projects with no history** — recall is empty, falls through to the LLM every time until patterns and memories accumulate.
- **Errors that are syntactically identical** — regex patterns catch those already, for free, before recall is ever consulted.
- **Non-error use cases** — recall only fires on shell command failures in the current wiring; it doesn't help with code generation, refactoring, or chat.

### The core value in one sentence

Every token you spend on a novel error becomes a free hint for every *similar* future error — without writing a regex for it.

---

## How it works

### The pipeline

```
 Shell command fails
        │
        ▼
 170+ regex patterns checked first (free, <1 ms)
        │
        ├─ HIT ──► apply fix, record stats, done
        │
        └─ MISS ─► Recall.similar(error.tail) ◄── THIS LAYER
                      │
                      ├─ embed query with MiniLM      (~20 ms warm, local)
                      ├─ dot product vs all rows       (~1 ms per 1k rows)
                      ├─ top-k scored above threshold
                      │
                      ├─ found ──► append "[CyxCode] similar prior errors"
                      │            to shell output → LLM sees context
                      │
                      └─ empty ──► fall through to LLM (normal behavior)
```

### The embedder

- **Library:** `@xenova/transformers` v2.17.2 — Hugging Face's JavaScript port, runs ONNX models via WASM. Bun-compatible.
- **Model:** `Xenova/all-MiniLM-L6-v2` — 22M parameters, 384-dimensional output. Quantized (int8) to ~25 MB on disk.
- **Cache location:** `~/.cyxcode/models/` (override the default `~/.cache/huggingface` to avoid Windows AV issues).
- **Lazy load:** the model only downloads + initializes on the first `embed()` call. `initRecall()` fires a background warmup so the first user-visible query is already hot.
- **Failure mode:** if the model fails to load (disk full, network blocked, ONNX runtime mismatch), a `disabled` flag flips and every downstream method silently returns `[]`. CyxCode keeps running normally.

### Text → vector, in one step

```
"pnpm install failed: ENOENT lockfile"
   │
   ├── tokenize ────► [pnpm, install, failed, EN, ##OENT, lock, ##file]
   │
   ├── 6 transformer layers ─► 384-number vector per token
   │
   ├── mean-pool ─────► one 384-number vector for the whole sentence
   │
   └── L2-normalize ──► unit vector (magnitude = 1.0)

Result: Float32Array(384)
```

### Why normalization is the whole trick

Cosine similarity between two vectors is:

```
cos(a, b) = (a · b) / (|a| · |b|)
```

If `|a| = |b| = 1` (which `normalize: true` guarantees), this collapses to just the dot product:

```
cos(a, b) = a · b  =  a[0]·b[0] + a[1]·b[1] + … + a[383]·b[383]
```

384 multiplies, 383 adds — about **1 microsecond per comparison**. No square roots, no division. At <10,000 stored vectors we brute-force the whole table in a few milliseconds, faster than any network round-trip. No vector database required.

### Storage

A dedicated SQLite file at `.cyxcode/recall.db` (separate from the main `cyxcode.db` so it's independently prunable and deletable without affecting anything else).

Two main tables:

- **`vectors`** — the embeddings, keyed by `(source, source_id)`. Each row stores the 384 floats as a raw BLOB (1,536 bytes) by reinterpreting the `Float32Array` buffer. No JSON, no base64, no per-field encoding. Round-trip is bit-exact.
- **`facts`** — temporal triples `(subject, predicate, object, valid_from, valid_until)`. When you re-assert a fact with a newer `valid_from`, the prior row's `valid_until` closes automatically. Lets recall answer "what's currently true" vs "what *was* true as of last week."

Plus `source_watermarks` (per-source incremental index cursor) and `meta_kv` (model version marker for upgrade detection).

### Data sources

Recall indexes three sources automatically via Bus event subscriptions:

| Source | Event | What gets indexed |
|---|---|---|
| `memory` | `SessionCompaction.Compacted` | Your `memory/index.json` entries + their markdown bodies — everything `memory.ts` captures at compaction time |
| `pattern-learned` | `CyxEvents.PatternLearned` | The description + regex of every pattern that `learned.ts` approves |
| Access tracking | `CyxEvents.MemoryLoaded` | Not indexed — just bumps `accessed_at` + `access_count` on matching rows so decay aligns with real usage |

On first run, `reconcile()` walks the existing `memory/index.json` and `learned.json` files and batch-embeds everything retroactively. Watermarks track progress so subsequent runs only index new entries. Model upgrades trigger an automatic wipe + full rebuild.

### The query path

```typescript
import { Recall } from "@/cyxcode/recall"

// Semantic similarity search
const hits = await Recall.similar("pnpm install broken", {
  limit: 5,
  minScore: 0.5,            // cosine threshold
  sources: ["memory", "learned"],  // optional source filter
  decay: true,              // default: multiply score by exp(-ageDays/30)
})
// → Similar[]: { id, source, sourceId, text, score, createdAt, meta }

// Temporal fact lookup
const facts = await Recall.factsAbout("pnpm", { at: Date.now() })
// → Fact[]: only rows valid at the given timestamp

// Record a temporal fact
await Recall.recordFact(
  { subject: "pnpm", predicate: "failed_on", object: "node@18" },
  { sourceEvent: "manual" },
)

// Force a full rebuild (model changed, corruption, or just desired)
const stats = await Recall.reindex()
// → { memoryIndexed, learnedIndexed, skipped, errors }

// Check state
Recall.isReady()           // enabled AND embedder warmed (safe to call without cold-start)
Recall.stats()             // { vectors, facts, disabled }
```

### Auto-wiring into the shell pipeline

In `session/prompt.ts`, when a shell command fails and no pattern matches, the code now:

1. Checks `Recall.isReady()` (instant; returns `false` if model isn't warmed or recall is disabled)
2. Slices the last ~2000 chars of the shell output (errors live at the tail, and MiniLM tokenizer caps at ~512 tokens)
3. Calls `Recall.similar()` with `limit: 3, minScore: 0.5`
4. If hits, appends them to the shell output as `[CyxCode]` hints — the LLM sees them in the next turn as if they were part of the error context

Example injected hint:

```
docker: Error response from daemon: no space left on device.

[CyxCode] No pattern matched, but recall found 2 similar prior errors:
  1. [memory 0.89] docker build failed on device_full. Previously fixed via: docker system prune -a
  2. [learned 0.71] ENOSPC: no space left on device. Generated pattern: /no space left on device/
[CyxCode] Retrieval via local embeddings — no LLM tokens spent
```

The LLM now diagnoses the current failure with prior context, usually producing the right fix immediately — and CyxCode never paid a token for the retrieval itself.

---

## What recall does NOT do

- **It does not understand your code.** The MiniLM model was trained on general web text. It groups error messages by linguistic meaning, not by program semantics. That's enough for error recovery; it's not enough for code generation.
- **It does not generate text.** It's a read-only fingerprinter. No completion, no chat, no LLM calls. Ever.
- **It does not learn from your data.** Model weights are frozen forever. Your data lives only in the stored embeddings in `recall.db`. Delete that file → recall has zero memory of you.
- **It does not reach the network.** After the one-time 25 MB model download on first use, recall is fully offline.
- **It does not replace the pattern system.** Patterns are still checked first. Recall only runs when patterns miss. It's the second line of defense, not the first.

---

## File layout

All recall code lives in one directory that can be deleted without breaking anything else:

```
packages/opencode/src/cyxcode/recall/
├── index.ts           Public Recall namespace + initRecall() entrypoint
├── types.ts           Public types: Similar, Fact, Triple, ReindexStats, …
├── errors.ts          RecallError discriminated union
├── paths.ts           Local path helpers wrapping CyxPaths (recall.db, models/)
├── schema.sql.ts      SQLite DDL + PRAGMAS
├── db.ts              bun:sqlite open, BLOB helpers, vector/fact CRUD
├── vector.ts          Pure cosine + decay + top-k (fully unit-testable)
├── facts.ts           Temporal triple store (recordFact, factsAbout)
├── embedder.ts        Lazy @xenova/transformers singleton + test stub hook
├── indexer.ts         Bus event subscribers (Compacted, PatternLearned, MemoryLoaded)
└── reconcile.ts       First-run retro index + on-demand rebuild
```

Plus the test suite at `packages/opencode/test/cyxcode/recall/`:

```
vector.test.ts               dot product, decay, top-k, blob round-trip
facts.test.ts                record/recall, temporal validity windows
embedder-disabled.test.ts    disabled path, stub-based hit path, MemoryLoaded bump
```

---

## Files edited in the host

Recall is additive. The only existing-file edits across the entire feature are:

| File | Change | Purpose |
|---|---|---|
| `packages/opencode/package.json` | +1 line | Add `@xenova/transformers@2.17.2` dependency |
| `packages/opencode/src/cyxcode/index.ts` | +5 lines | Dynamic-import block for `initRecall()` alongside `initMemoryCapture()` |
| `packages/opencode/src/session/prompt.ts` | +1 import, +16 lines | `else if (Recall.isReady())` branch that injects similar-prior-error hints on pattern miss |

Deleting `packages/opencode/src/cyxcode/recall/` + `packages/opencode/test/cyxcode/recall/` and reverting those three files restores CyxCode to its pre-recall state exactly.

---

## Performance characteristics

| Operation | Cost | Notes |
|---|---|---|
| Model download (one-time) | ~25 MB over network | Cached at `~/.cyxcode/models/` forever after |
| Model load (cold) | ~1.5 s WASM init | Happens in background during `initRecall()` warmup |
| First `embed()` call (cold) | ~200 ms | Hidden by warmup; subsequent calls <20 ms |
| `similar()` at <1k rows | <5 ms total | Dominated by the embed call, not the scan |
| `similar()` at <10k rows | <20 ms total | Still CPU-bound on the dot products |
| `similar()` at >20k rows | ⚠️ consider `sqlite-vec` | TODO comment marks the migration point in `db.ts` |
| Storage per row | 1,536 B embedding + text | For 1k rows that's ~2–3 MB of DB |
| Memory during similar() | 1k rows × 1.5 KB = ~1.5 MB | All rows loaded into JS heap for scoring |

---

## Configuration

Recall has very few knobs. Most behavior is automatic.

### Environment variables

| Variable | Default | Effect |
|---|---|---|
| `RECALL_INDEX_MISSES` | `true` (reserved) | Kill switch for indexing raw pattern-miss errors. Currently unused since the `PatternMiss` event carries no error text in its Zod payload — the signal is captured via `PatternLearned` instead. |

### Disabling recall entirely

Delete `packages/opencode/src/cyxcode/recall/` and revert `packages/opencode/src/cyxcode/index.ts` + `packages/opencode/src/session/prompt.ts`. CyxCode boots and runs exactly as before.

Or, at runtime, delete `.cyxcode/recall.db`. Recall will recreate an empty DB on next boot and `isReady()` will return `true`, but `similar()` will return `[]` until something gets indexed.

### Disk usage

- `.cyxcode/recall.db` — the SQLite database. Grows ~1.5 KB per indexed row. Deletable anytime.
- `~/.cyxcode/models/` — the MiniLM model cache. ~25 MB, shared across all projects. Deletable — will re-download on next cold start.

---

## Design principles

1. **Patterns first.** Regex matching is checked before recall is ever consulted. Patterns are free; embedding a query costs ~20 ms.
2. **Local only.** No API keys, no cloud, no telemetry. The 96% recall improvement on LongMemEval's raw mode comes from local storage + local retrieval — cloud services don't help and only add privacy risk.
3. **Store raw, match semantically.** Don't let an LLM decide what's worth remembering. Store the actual error + fix, and let vector similarity surface relevance later. This is the MemPalace insight applied to CyxCode's domain.
4. **Zero-cost fallback on failure.** Every method returns `[]` on any failure path. `initRecall()` never rejects. Bus subscriber errors are logged and swallowed. Host flow is never blocked.
5. **Reversibility.** The feature must be deletable in one `rm -rf` + three file reverts. This forces the design to stay additive and keeps the blast radius of bugs small.
6. **Read path works even when write path doesn't.** `Recall.similar()` functions correctly even if Bus subscribers can't register (e.g., in unit tests with no `Instance` context). The database is the source of truth.

---

## Verification

### Unit tests (23 tests, all local, no model download)

- `vector.test.ts` — cosine math, decay factor, top-k, BLOB round-trip
- `facts.test.ts` — record/recall, validity windows, temporal filtering
- `embedder-disabled.test.ts` — disabled state returns `[]`, warm stub returns scored hits, MemoryLoaded bump increments access count

Run them:

```bash
cd packages/opencode
bun test test/cyxcode/recall/
# Expected: 23 pass, 0 fail
```

### Manual smoke test

```bash
cd D:/Dev/Failed/cyxcode
bun run dev
# In a project with some .cyxcode/memory/ entries:
!pnpm install
# If it fails and matches no hardcoded pattern, look for:
#   [CyxCode] No pattern matched, but recall found N similar prior errors:
```

First run: ~15 s to download the model (once). Subsequent: recall is hot within a few seconds of launch.

### Reversibility check

```bash
rm -rf packages/opencode/src/cyxcode/recall
rm -rf packages/opencode/test/cyxcode/recall
git checkout packages/opencode/src/cyxcode/index.ts
git checkout packages/opencode/src/session/prompt.ts
git checkout packages/opencode/package.json
bun run dev
# → CyxCode boots normally, behaves identically to pre-recall state
```

---

## Known limitations

1. **`@xenova/transformers` v2.17.2 pin.** v3 uses a different backend (`onnxruntime-web` with worker threading) and hasn't been validated against Bun yet. v2.17.2 is the last WASM-only release and is community-confirmed Bun-compatible.
2. **Full table scan on every query.** Fine at <10k rows. Above ~20k, migrate to the `sqlite-vec` extension. A `TODO(sqlite-vec)` comment in `db.ts::selectVectors()` marks the migration point.
3. **`PatternMiss` event has no error text.** The `cyxcode.pattern.miss` Bus event's Zod payload is `{ tokensUsed, errorLength }` — the actual error string isn't in the payload. Recall therefore can't index "raw misses" directly, only the approved patterns that `learned.ts` generates from them. The signal is still captured, just via an extra hop through pattern generation.
4. **Shell output truncation at 2000 chars.** Long build logs compress to the last 2000 chars before embedding. This matches where errors typically sit, but catastrophic failures with huge stack traces may miss context from the middle.
5. **Model upgrade cost.** Changing `RECALL_MODEL` triggers a full wipe + rebuild. For 1k memory entries, this takes ~30 s of background CPU. Acceptable as a one-time cost.
6. **No per-project isolation of the model cache.** The ~25 MB model lives at `~/.cyxcode/models/` and is shared across all projects on the machine. By design — no reason to download it per project.

---

## Future work

- Wire `sqlite-vec` at the selectVectors call site once row counts warrant it
- Expose `/recall` slash command for manual query + reindex from the TUI
- Improve `redactSecrets` in `audit.ts` so both memory and recall benefit from better secret scrubbing
- Surface recall hit rate in the existing `/audit` report alongside pattern hit rate
- Explore whether the KG facts layer should auto-retire stale memory entries based on `access_count` decay

---

## See also

- [USAGE.md](USAGE.md) — user guide for the full CyxCode toolkit
- [AUDIT-SYSTEM.md](AUDIT-SYSTEM.md) — event journal that recall subscribes to
- [STATE-VERSIONING.md](STATE-VERSIONING.md) — the broader state layer recall plugs into
- [PERFORMANCE.md](PERFORMANCE.md) — token/time benchmarks for the whole system
