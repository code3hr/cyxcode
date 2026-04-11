import fs from "fs"
import { Log } from "@/util/log"
import { cacheDir } from "./paths"
import { RECALL_DIM, RECALL_MODEL } from "./types"
import { RecallError } from "./errors"

const log = Log.create({ service: "cyxcode-recall-embedder" })

type EmbedFn = (texts: string[]) => Promise<Float32Array[]>

type EmbedderState = {
  disabled: boolean
  warmed: boolean
  pipelinePromise: Promise<EmbedFn> | null
}

const g = globalThis as any
if (!g.__cyxcode_recall_embedder) {
  g.__cyxcode_recall_embedder = { disabled: false, warmed: false, pipelinePromise: null } as EmbedderState
}
const state: EmbedderState = g.__cyxcode_recall_embedder

function getStub(): ((texts: string[]) => Float32Array[] | Promise<Float32Array[]>) | null {
  return (g.__cyxcode_recall_embedder_stub as any) ?? null
}

async function loadPipeline(): Promise<EmbedFn> {
  if (state.disabled) throw new RecallError("embedder-disabled")
  if (state.pipelinePromise) return state.pipelinePromise
  state.pipelinePromise = (async () => {
    try {
      const dir = cacheDir()
      try { fs.mkdirSync(dir, { recursive: true }) } catch {}

      const mod: any = await import("@xenova/transformers")
      mod.env.cacheDir = dir
      mod.env.allowLocalModels = true
      const pipe = await mod.pipeline("feature-extraction", RECALL_MODEL, { quantized: true })

      const fn: EmbedFn = async (texts) => {
        if (texts.length === 0) return []
        const out = await pipe(texts, { pooling: "mean", normalize: true })
        // Force Float32 regardless of the backing TypedArray the library returns.
        const data = Float32Array.from(out.data as ArrayLike<number>)
        if (data.length !== texts.length * RECALL_DIM) {
          throw new Error(
            `embedder: unexpected output length ${data.length}, expected ${texts.length * RECALL_DIM}`,
          )
        }
        const rows: Float32Array[] = []
        for (let i = 0; i < texts.length; i++) {
          rows.push(data.slice(i * RECALL_DIM, (i + 1) * RECALL_DIM))
        }
        return rows
      }
      return fn
    } catch (e) {
      state.disabled = true
      state.pipelinePromise = null
      log.warn("recall: embedder disabled (model load failed)", {
        error: e instanceof Error ? e.message : String(e),
      })
      throw new RecallError("model-load-failed", { cause: e })
    }
  })()
  return state.pipelinePromise
}

export function isDisabled(): boolean {
  return state.disabled
}

export function isWarmed(): boolean {
  return state.warmed
}

export function disable(reason?: string) {
  state.disabled = true
  if (reason) log.warn("recall: embedder manually disabled", { reason })
}

export async function embed(text: string): Promise<Float32Array> {
  const batch = await embedBatch([text])
  return batch[0]
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return []
  const stub = getStub()
  if (stub) {
    const out = await stub(texts)
    state.warmed = true
    return out
  }
  const fn = await loadPipeline()
  const rows = await fn(texts)
  state.warmed = true
  return rows
}

export async function warmup(): Promise<void> {
  try {
    await embed("warmup")
  } catch {
    // already logged inside loadPipeline; swallow here
  }
}
