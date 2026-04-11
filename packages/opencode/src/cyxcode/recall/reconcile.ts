import fs from "fs/promises"
import path from "path"
import { Log } from "@/util/log"
import { Memory } from "../memory"
import { LearnedPatterns } from "../learned"
import { redactSecrets } from "../audit"
import { RECALL_MODEL, type ReindexStats } from "./types"
import { bumpWatermark, getWatermark, readMeta, upsertVector, wipeVectors, writeMeta } from "./db"
import { embedBatch, isDisabled } from "./embedder"

const log = Log.create({ service: "cyxcode-recall-reconcile" })

const BATCH = 32
const MAX_TEXT_CHARS = 4000

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function readMemoryBody(memDir: string, file: string): Promise<string> {
  try {
    const raw = await fs.readFile(path.join(memDir, file), "utf-8")
    return raw.trim()
  } catch {
    return ""
  }
}

async function indexMemory(stats: ReindexStats): Promise<void> {
  const idx = await Memory.readIndex()
  if (idx.entries.length === 0) return

  const memDir = Memory.getBasePath()
  const watermark = getWatermark("memory")

  const fresh = idx.entries.filter((e) => {
    const created = Date.parse(e.created)
    return Number.isFinite(created) && created >= watermark
  })

  let maxSuccessCreated = watermark
  let anyBatchFailed = false

  for (const batch of chunk(fresh, BATCH)) {
    const bodies = await Promise.all(batch.map((e) => readMemoryBody(memDir, e.file)))
    const texts: string[] = []
    const keep: Array<{ entry: (typeof batch)[number]; text: string }> = []
    for (let i = 0; i < batch.length; i++) {
      const body = bodies[i]
      if (!body) {
        stats.skipped++
        continue
      }
      const combined = `${batch[i].summary}\n\n${body}`
      const clean = redactSecrets(combined).slice(0, MAX_TEXT_CHARS)
      texts.push(clean)
      keep.push({ entry: batch[i], text: clean })
    }
    if (texts.length === 0) continue

    let vectors: Float32Array[]
    try {
      vectors = await embedBatch(texts)
    } catch (e) {
      stats.errors += texts.length
      log.warn("reconcile: embed failed for memory batch", { error: e })
      anyBatchFailed = true
      return
    }

    for (let i = 0; i < keep.length; i++) {
      try {
        upsertVector({
          source: "memory",
          sourceId: keep[i].entry.id,
          text: keep[i].text,
          embedding: vectors[i],
          meta: { tags: keep[i].entry.tags, created: keep[i].entry.created },
          createdAt: Date.parse(keep[i].entry.created) || Date.now(),
        })
        stats.memoryIndexed++
        const created = Date.parse(keep[i].entry.created)
        if (Number.isFinite(created) && created > maxSuccessCreated) maxSuccessCreated = created
      } catch (e) {
        stats.errors++
        anyBatchFailed = true
        log.warn("reconcile: upsert failed for memory entry", { id: keep[i].entry.id, error: e })
      }
    }
  }

  if (!anyBatchFailed) {
    bumpWatermark("memory", Date.now())
  } else if (maxSuccessCreated > watermark) {
    bumpWatermark("memory", maxSuccessCreated)
  }
}

async function indexLearned(stats: ReindexStats): Promise<void> {
  const data = await LearnedPatterns.read()
  const approved = data.approved
  if (approved.length === 0) return

  const entries = approved
    .map((raw) => {
      const sp = (raw as any).generatedPattern || raw
      if (!sp?.id || !sp?.regex) return null
      return {
        id: String(sp.id),
        regex: String(sp.regex),
        description: String(sp.description ?? ""),
        category: String(sp.category ?? "learned"),
      }
    })
    .filter((v): v is { id: string; regex: string; description: string; category: string } => v !== null)

  let anyBatchFailed = false

  for (const batch of chunk(entries, BATCH)) {
    const texts = batch.map((e) => redactSecrets(`${e.description}\n${e.regex}`).slice(0, MAX_TEXT_CHARS))

    let vectors: Float32Array[]
    try {
      vectors = await embedBatch(texts)
    } catch (e) {
      stats.errors += texts.length
      log.warn("reconcile: embed failed for learned batch", { error: e })
      anyBatchFailed = true
      return
    }

    for (let i = 0; i < batch.length; i++) {
      try {
        upsertVector({
          source: "learned",
          sourceId: batch[i].id,
          text: texts[i],
          embedding: vectors[i],
          meta: { category: batch[i].category, regex: batch[i].regex },
        })
        stats.learnedIndexed++
      } catch (e) {
        stats.errors++
        anyBatchFailed = true
        log.warn("reconcile: upsert failed for learned entry", { id: batch[i].id, error: e })
      }
    }
  }

  if (!anyBatchFailed) bumpWatermark("learned", Date.now())
}

let inFlight: Promise<ReindexStats> | null = null

export function isReconciling(): boolean {
  return inFlight !== null
}

export async function reconcile(opts: { force?: boolean } = {}): Promise<ReindexStats> {
  if (inFlight) return inFlight
  inFlight = runReconcile(opts).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runReconcile(opts: { force?: boolean }): Promise<ReindexStats> {
  const stats: ReindexStats = { memoryIndexed: 0, learnedIndexed: 0, skipped: 0, errors: 0 }

  if (isDisabled()) {
    log.debug("reconcile skipped: embedder disabled")
    return stats
  }

  const storedModel = readMeta("model")
  const wipe = !!opts.force || (storedModel !== null && storedModel !== RECALL_MODEL)

  if (wipe) {
    log.info("reconcile: wiping vectors", { reason: opts.force ? "force" : "model-change", storedModel })
    wipeVectors()
  }

  try {
    await indexMemory(stats)
  } catch (e) {
    log.warn("reconcile: indexMemory failed", { error: e })
    stats.errors++
  }

  try {
    await indexLearned(stats)
  } catch (e) {
    log.warn("reconcile: indexLearned failed", { error: e })
    stats.errors++
  }

  // Only persist the model marker after both index passes complete without throwing.
  if (stats.errors === 0 && storedModel !== RECALL_MODEL) {
    writeMeta("model", RECALL_MODEL)
  }

  log.info("reconcile complete", stats as unknown as Record<string, unknown>)
  return stats
}
