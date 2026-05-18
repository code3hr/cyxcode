import http from "node:http"
import os from "node:os"
import path from "node:path"
import { pipeline, env } from "@xenova/transformers"

const model = process.env.CYXCODE_RECALL_MODEL || "Xenova/all-MiniLM-L6-v2"
const cache = process.env.CYXCODE_RECALL_CACHE || path.join(os.homedir(), ".cyxcode", "models")
const dim = Number(process.env.CYXCODE_RECALL_DIM || 384)

env.cacheDir = cache
env.allowLocalModels = true

let pipe = null

async function get() {
  if (pipe) return pipe
  pipe = await pipeline("feature-extraction", model, { quantized: true })
  return pipe
}

async function read(req) {
  const list = []
  for await (const buf of req) list.push(buf)
  return Buffer.concat(list).toString("utf-8")
}

function json(res, code, data) {
  res.statusCode = code
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify(data))
}

function err(msg) {
  process.stdout.write(`ERROR ${msg}\n`)
  process.exit(1)
}

process.on("uncaughtException", (e) => {
  err(e instanceof Error ? e.stack || e.message : String(e))
})

process.on("unhandledRejection", (e) => {
  err(e instanceof Error ? e.stack || e.message : String(e))
})

const srv = http.createServer(async (req, res) => {
  if (!req.url) {
    json(res, 400, { error: "missing-url" })
    return
  }

  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true })
    return
  }

  if (req.method !== "POST" || req.url !== "/embed") {
    json(res, 404, { error: "not-found" })
    return
  }

  const raw = await read(req)
  let input
  try {
    input = JSON.parse(raw)
  } catch (e) {
    json(res, 400, { error: "invalid-json" })
    return
  }

  const texts = Array.isArray(input?.texts) ? input.texts.map((item) => String(item)) : []
  if (texts.length === 0) {
    json(res, 200, { vectors: [] })
    return
  }

  try {
    const fn = await get()
    const out = await fn(texts, { pooling: "mean", normalize: true })
    const data = Float32Array.from(out.data)
    if (data.length !== texts.length * dim) {
      throw new Error(`unexpected output length ${data.length}, expected ${texts.length * dim}`)
    }
    const vectors = []
    for (let i = 0; i < texts.length; i++) {
      vectors.push(Array.from(data.slice(i * dim, (i + 1) * dim)))
    }
    json(res, 200, { vectors })
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) })
  }
})

srv.listen(0, "127.0.0.1", () => {
  const addr = srv.address()
  if (!addr || typeof addr === "string") {
    err("failed to bind sidecar")
    return
  }
  process.stdout.write(`READY ${addr.port}\n`)
})
