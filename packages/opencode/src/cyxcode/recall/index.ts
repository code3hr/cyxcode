import { Log } from "@/util/log"
import { db, selectVectors, vectorCount } from "./db"
import { embed, isDisabled, isWarmed, warmup } from "./embedder"
import { factsAbout as _factsAbout, factsCount, recordFact as _recordFact } from "./facts"
import { registerSubscribers } from "./indexer"
import { reconcile } from "./reconcile"
import { dot, decayFactor, topK, type Scored } from "./vector"
import type {
  Fact,
  FactsAboutOpts,
  RecallStats,
  RecordFactOpts,
  ReindexStats,
  Similar,
  SimilarOpts,
  Triple,
  VectorRow,
  VectorSource,
} from "./types"

const log = Log.create({ service: "cyxcode-recall" })

let initialized = false
let enabled = false

export function __resetForTest(): void {
  initialized = false
  enabled = false
}

export namespace Recall {
  export async function initRecall(): Promise<void> {
    if (initialized) return
    initialized = true
    try {
      db()
      enabled = true
    } catch (e) {
      enabled = false
      log.warn("recall: init failed, disabling", { error: e })
      return
    }

    // Bus subscribers are a separate concern from read-path enablement:
    // if no Instance context is available (e.g. in unit tests), the query API
    // still works — we just don't auto-index live events.
    try {
      registerSubscribers()
    } catch (e) {
      log.warn("recall: Bus subscribers not registered (no Instance?)", { error: e })
    }

    // Background: warm up the embedder so the first live similar() call is hot
    warmup().catch(() => {})

    // Background: retro-index existing memory + learned stores
    reconcile().catch((e) => log.warn("recall: initial reconcile failed", { error: e }))
  }

  export function isReady(): boolean {
    return enabled && !isDisabled() && isWarmed()
  }

  export function stats(): RecallStats {
    if (!enabled) return { vectors: 0, facts: 0, disabled: true }
    try {
      return { vectors: vectorCount(), facts: factsCount(), disabled: isDisabled() }
    } catch {
      return { vectors: 0, facts: 0, disabled: true }
    }
  }

  export async function similar(text: string, opts: SimilarOpts = {}): Promise<Similar[]> {
    if (!enabled || isDisabled() || !text) return []

    const limit = opts.limit ?? 5
    const minScore = opts.minScore ?? 0.35
    const decay = opts.decay !== false

    let query: Float32Array
    try {
      query = await embed(text)
    } catch {
      return []
    }

    let rows: VectorRow[]
    try {
      rows = selectVectors(opts.sources)
    } catch (e) {
      log.warn("recall: selectVectors failed", { error: e })
      return []
    }

    const now = Date.now()
    const scored: Scored<VectorRow>[] = rows.map((r) => {
      const sim = dot(query, r.embedding)
      const factor = decay ? decayFactor(now, r.createdAt) : 1
      return { item: r, score: sim * factor }
    })

    return topK(scored, limit, minScore).map((s) => ({
      id: s.item.id,
      source: s.item.source,
      sourceId: s.item.sourceId,
      text: s.item.text,
      score: s.score,
      createdAt: s.item.createdAt,
      meta: s.item.meta,
    }))
  }

  export async function factsAbout(subject: string, opts?: FactsAboutOpts): Promise<Fact[]> {
    if (!enabled) return []
    try {
      return _factsAbout(subject, opts)
    } catch (e) {
      log.warn("recall: factsAbout failed", { error: e })
      return []
    }
  }

  export async function recordFact(triple: Triple, opts?: RecordFactOpts): Promise<Fact | null> {
    if (!enabled) return null
    try {
      return _recordFact(triple, opts)
    } catch (e) {
      log.warn("recall: recordFact failed", { error: e })
      return null
    }
  }

  export async function reindex(): Promise<ReindexStats> {
    if (!enabled || isDisabled()) {
      return { memoryIndexed: 0, learnedIndexed: 0, skipped: 0, errors: 0 }
    }
    return reconcile({ force: true })
  }
}

export type { Fact, Similar, Triple, ReindexStats, RecallStats, VectorSource, SimilarOpts, FactsAboutOpts, RecordFactOpts } from "./types"
