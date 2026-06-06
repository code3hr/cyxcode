import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { CyxPaths } from "../../../src/cyxcode/paths"
import { CyxWatch } from "../../../src/cyxcode/watch"
import { embedBatch, stop } from "../../../src/cyxcode/recall/sidecar"

const g = globalThis as {
  __cyxcode_recall_sidecar?: {
    proc: unknown
    ready: Promise<number> | null
    port: number | null
  }
}

let dir: string
let cwd: string
let fetcher: typeof globalThis.fetch

function state() {
  g.__cyxcode_recall_sidecar ??= { proc: null, ready: null, port: null }
  g.__cyxcode_recall_sidecar.proc = null
  g.__cyxcode_recall_sidecar.ready = null
  g.__cyxcode_recall_sidecar.port = 18181
}

beforeEach(async () => {
  cwd = process.cwd()
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxwatch-sidecar-"))
  await fs.mkdir(path.join(dir, ".opencode"), { recursive: true })
  process.chdir(dir)
  CyxPaths.invalidateCache()
  CyxWatch.clear()
  fetcher = globalThis.fetch
  state()
})

afterEach(async () => {
  await stop()
  globalThis.fetch = fetcher
  CyxWatch.close()
  process.chdir(cwd)
  CyxPaths.invalidateCache()
  await fs.rm(dir, { recursive: true, force: true })
})

describe("recall sidecar CyxWatch boundary", () => {
  test("records internal sidecar embedding requests", async () => {
    const seen: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      seen.push(input.toString())
      return Response.json({ vectors: [[1, 0, 0]] })
    }) as typeof globalThis.fetch

    const rows = await embedBatch(["hello"])
    expect(rows[0]).toEqual(Float32Array.from([1, 0, 0]))
    expect(seen).toEqual(["http://127.0.0.1:18181/embed"])

    const events = await CyxWatch.recent(10)
    const row = events.find((item) => item.kind === "network.outbound" && item.path === "http://127.0.0.1:18181/embed")
    expect(row).toBeDefined()
    expect(row!.decision).toBe("allow")
    expect(row!.method).toBe("POST")
    expect(row!.flags).toContain("recall_sidecar")
    expect(row!.flags).toContain("internal_network")
  })
})
