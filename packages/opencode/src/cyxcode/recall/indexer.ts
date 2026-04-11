import { Log } from "@/util/log"
import { Bus } from "@/bus"
import { SessionCompaction } from "@/session/compaction"
import { CyxEvents, redactSecrets } from "../audit"
import { LearnedPatterns } from "../learned"
import { bumpAccessBySourceId, upsertVector } from "./db"
import { embedBatch, isDisabled } from "./embedder"
import { recordFact } from "./facts"
import { reconcile } from "./reconcile"

const log = Log.create({ service: "cyxcode-recall-indexer" })

const MAX_TEXT_CHARS = 4000

async function onCompacted(_sessionID: string) {
  if (isDisabled()) return
  // Delay briefly so Memory's auto-capture (which runs in its own handler) lands first.
  await new Promise<void>((r) => setTimeout(r, 100))
  try {
    await reconcile()
  } catch (e) {
    log.warn("indexer: reconcile after compaction failed", { error: e })
  }
}

function unwrapPattern(raw: any): { id: string; regex: string; description: string; category: string } | null {
  const sp = raw?.generatedPattern ?? raw
  if (!sp?.id || !sp?.regex) return null
  return {
    id: String(sp.id),
    regex: String(sp.regex),
    description: String(sp.description ?? ""),
    category: String(sp.category ?? "learned"),
  }
}

async function onPatternLearned(patternId: string) {
  if (isDisabled()) return
  if (!patternId) return
  try {
    const file = await LearnedPatterns.read()
    const haystack: any[] = [...file.approved, ...file.pending]
    let sp: { id: string; regex: string; description: string; category: string } | null = null
    for (const raw of haystack) {
      const u = unwrapPattern(raw)
      if (u && u.id === patternId) {
        sp = u
        break
      }
    }
    if (!sp) return

    const text = redactSecrets(`${sp.description}\n${sp.regex}`).slice(0, MAX_TEXT_CHARS)
    const [vec] = await embedBatch([text])
    if (!vec) return

    upsertVector({
      source: "pattern-learned",
      sourceId: sp.id,
      text,
      embedding: vec,
      meta: { category: sp.category, regex: sp.regex },
    })

    try {
      recordFact(
        { subject: String(patternId), predicate: "learned-from", object: "cyxcode.pattern.learned" },
        { sourceEvent: "cyxcode.pattern.learned" },
      )
    } catch (e) {
      log.warn("indexer: recordFact failed", { error: e })
    }
  } catch (e) {
    log.warn("indexer: pattern-learned handler failed", { error: e })
  }
}

async function onMemoryLoaded(memoryId: string) {
  if (isDisabled()) return
  if (!memoryId) return
  try {
    bumpAccessBySourceId("memory", memoryId)
  } catch (e) {
    log.warn("indexer: bumpAccess failed", { error: e })
  }
}

type Unsub = () => void
const subs: Unsub[] = []

export function registerSubscribers(): void {
  subs.push(
    Bus.subscribe(SessionCompaction.Event.Compacted, (event) => {
      onCompacted(event.properties.sessionID).catch((err) =>
        log.warn("indexer: compaction handler threw", { error: err }),
      )
    }),
  )

  subs.push(
    Bus.subscribe(CyxEvents.PatternLearned, (event) => {
      onPatternLearned(event.properties.patternId).catch((err) =>
        log.warn("indexer: pattern-learned handler threw", { error: err }),
      )
    }),
  )

  subs.push(
    Bus.subscribe(CyxEvents.MemoryLoaded, (event) => {
      onMemoryLoaded(event.properties.memoryId).catch((err) =>
        log.warn("indexer: memory-loaded handler threw", { error: err }),
      )
    }),
  )
}

export function unregisterSubscribers(): void {
  while (subs.length > 0) {
    const fn = subs.pop()
    try { fn?.() } catch {}
  }
}
