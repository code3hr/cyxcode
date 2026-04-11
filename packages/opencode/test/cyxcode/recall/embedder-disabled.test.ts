import { describe, test, expect, beforeEach, afterAll } from "bun:test"
import path from "path"
import fs from "fs"
import os from "os"
import { close, setDbPathOverride, upsertVector } from "../../../src/cyxcode/recall/db"
import { Recall, __resetForTest } from "../../../src/cyxcode/recall"

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cyxrecall-"))
const dbPath = path.join(tmpRoot, "recall.db")

const g = globalThis as any

function installStub(fn: ((texts: string[]) => Float32Array[]) | null) {
  if (fn) g.__cyxcode_recall_embedder_stub = fn
  else delete g.__cyxcode_recall_embedder_stub
}

function resetEmbedderState(disabled: boolean) {
  // Mutate the existing object — embedder.ts holds a const ref to it.
  if (!g.__cyxcode_recall_embedder) {
    g.__cyxcode_recall_embedder = { disabled, warmed: !disabled, pipelinePromise: null }
    return
  }
  g.__cyxcode_recall_embedder.disabled = disabled
  g.__cyxcode_recall_embedder.warmed = !disabled
  g.__cyxcode_recall_embedder.pipelinePromise = null
}

function hashEmbed(text: string): Float32Array {
  const v = new Float32Array(384)
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  for (let i = 0; i < 384; i++) {
    h = Math.imul(h ^ i, 2246822519)
    v[i] = ((h >>> 0) % 2000 - 1000) / 1000
  }
  // unit-normalize
  let sum = 0
  for (let i = 0; i < 384; i++) sum += v[i] * v[i]
  const norm = Math.sqrt(sum) || 1
  for (let i = 0; i < 384; i++) v[i] /= norm
  return v
}

beforeEach(() => {
  close()
  try { fs.unlinkSync(dbPath) } catch {}
  setDbPathOverride(dbPath)
  installStub(null)
  resetEmbedderState(false)
  __resetForTest()
})

afterAll(() => {
  close()
  setDbPathOverride(null)
  installStub(null)
  resetEmbedderState(false)
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch {}
})

describe("recall/embedder disabled path", () => {
  test("similar() returns empty when embedder is disabled", async () => {
    // Seed a row with a hash embedding so there's data to (not) match
    upsertVector({
      source: "memory",
      sourceId: "seed1",
      text: "pnpm install failed",
      embedding: hashEmbed("pnpm install failed"),
    })

    // Mark embedder as disabled
    resetEmbedderState(true)
    // Skip initRecall — directly call similar; Recall.enabled is false pre-init
    // so we also need to pretend init happened. Simulate by setting globalThis flags.
    await Recall.initRecall()
    // Re-disable after init overwrote the state
    resetEmbedderState(true)

    const out = await Recall.similar("pnpm install failed")
    expect(out).toEqual([])
  })

  test("similar() returns hits when embedder is warm via stub", async () => {
    installStub((texts) => texts.map((t) => hashEmbed(t)))
    await Recall.initRecall()

    upsertVector({
      source: "memory",
      sourceId: "seed1",
      text: "docker build failed: no space left on device",
      embedding: hashEmbed("docker build failed: no space left on device"),
    })

    const hits = await Recall.similar("docker build failed: no space left on device", { minScore: 0.9, decay: false })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].sourceId).toBe("seed1")
    expect(hits[0].score).toBeCloseTo(1, 3)
  })

  test("similar() returns empty for empty query", async () => {
    installStub((texts) => texts.map((t) => hashEmbed(t)))
    await Recall.initRecall()
    const out = await Recall.similar("")
    expect(out).toEqual([])
  })
})

describe("recall/MemoryLoaded bump path", () => {
  test("bumpAccessBySourceId updates accessed_at and access_count", async () => {
    installStub((texts) => texts.map((t) => hashEmbed(t)))
    await Recall.initRecall()

    upsertVector({
      source: "memory",
      sourceId: "mem_abc",
      text: "something",
      embedding: hashEmbed("something"),
    })

    const { bumpAccessBySourceId } = await import("../../../src/cyxcode/recall/db")
    bumpAccessBySourceId("memory", "mem_abc")
    bumpAccessBySourceId("memory", "mem_abc")

    const { selectVectors } = await import("../../../src/cyxcode/recall/db")
    const rows = selectVectors(["memory"])
    const row = rows.find((r) => r.sourceId === "mem_abc")
    expect(row).toBeDefined()
    expect(row!.accessCount).toBe(2)
  })
})
