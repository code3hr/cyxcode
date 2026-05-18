import { spawn, type ChildProcess } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { Log } from "@/util/log"
import { cacheDir } from "./paths"
import { RECALL_MODEL } from "./types"
import { RecallError } from "./errors"

const log = Log.create({ service: "cyxcode-recall-sidecar" })

type State = {
  proc: ChildProcess | null
  ready: Promise<number> | null
  port: number | null
}

const g = globalThis as any
if (!g.__cyxcode_recall_sidecar) {
  g.__cyxcode_recall_sidecar = { proc: null, ready: null, port: null } as State
}
const state: State = g.__cyxcode_recall_sidecar

let exitHook = false

function bin(): string {
  return process.env.CYXCODE_NODE_BIN || "node"
}

function file(): string {
  return fileURLToPath(new URL("./sidecar.node.js", import.meta.url))
}

function reset() {
  state.proc = null
  state.ready = null
  state.port = null
}

async function wait(): Promise<number> {
  if (state.port) return state.port
  if (state.ready) return state.ready

  state.ready = new Promise<number>((resolve, reject) => {
    const env = {
      ...process.env,
      CYXCODE_RECALL_CACHE: cacheDir(),
      CYXCODE_RECALL_MODEL: RECALL_MODEL,
    }

    try {
      fs.mkdirSync(cacheDir(), { recursive: true })
    } catch {}

    const proc = spawn(bin(), [file()], {
      cwd: path.dirname(cacheDir()),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    state.proc = proc
    const out = proc.stdout!
    const err = proc.stderr!

    let buf = ""
    let txt = ""
    let done = false

    const fail = (msg: string, cause?: unknown) => {
      if (done) return
      done = true
      try { proc.kill() } catch {}
      reset()
      log.warn(msg, {
        error: cause instanceof Error ? cause.message : cause ? String(cause) : undefined,
      })
      reject(
        new RecallError("model-load-failed", {
          message: "sidecar-start-failed",
          cause: cause instanceof Error ? cause : new Error(String(cause ?? msg)),
        }),
      )
    }

    out.on("data", (chunk) => {
      buf += chunk.toString("utf-8")
      const rows = buf.split(/\r?\n/)
      buf = rows.pop() ?? ""
      for (const row of rows) {
        const v = row.trim()
        if (!v) continue
        if (v.startsWith("READY ")) {
          const n = Number(v.slice(6).trim())
          if (!Number.isFinite(n)) {
            fail("recall sidecar emitted invalid port", v)
            return
          }
          done = true
          state.port = n
          resolve(n)
          return
        }
        if (v.startsWith("ERROR ")) {
          fail("recall sidecar reported startup failure", v.slice(6).trim())
          return
        }
      }
    })

    err.on("data", (chunk) => {
      txt += chunk.toString("utf-8")
    })

    proc.on("error", (e) => {
      fail("recall sidecar spawn failed", e)
    })

    proc.on("exit", (code, sig) => {
      if (done) {
        reset()
        return
      }
      fail(`recall sidecar exited before ready (${code ?? "null"}${sig ? `, ${sig}` : ""})`, txt.trim() || undefined)
    })
  })

  return state.ready
}

async function request<T>(input: string, init: RequestInit): Promise<T> {
  const port = await wait()
  const res = await fetch(`http://127.0.0.1:${port}${input}`, init)
  if (!res.ok) {
    throw new Error(`sidecar request failed: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return []
  const data = await request<{ vectors: number[][] }>("/embed", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts }),
  })
  return data.vectors.map((row) => Float32Array.from(row))
}

export async function warm(): Promise<void> {
  await embedBatch(["warmup"])
}

export async function stop(): Promise<void> {
  const proc = state.proc
  reset()
  if (!proc) return
  try {
    proc.kill()
  } catch {}
}

if (!exitHook) {
  exitHook = true
  process.once("exit", () => {
    void stop()
  })
}
