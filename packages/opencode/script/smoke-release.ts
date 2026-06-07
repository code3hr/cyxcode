#!/usr/bin/env bun

import { spawn, type ChildProcessWithoutNullStreams } from "child_process"
import { existsSync } from "fs"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const repo = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)))
const args = process.argv.slice(2)

function arg(name: string) {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return undefined
  return args[idx + 1]
}

function num(name: string, fallback: number) {
  const value = arg(name)
  if (!value) return fallback
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return parsed
  return fallback
}

function usage() {
  console.error(
    [
      "Usage:",
      "  bun run script/smoke-release.ts --version 2.3.7",
      "  bun run script/smoke-release.ts --exe ../../.release-smoke/v2.3.7/bin/cyxcode.exe",
      "",
      "Options:",
      "  --port <number>          default: 4211",
      "  --startup-ms <number>    default: 60000",
      "  --request-ms <number>    default: 10000",
      "  --root <path>            default: .release-smoke/<version>/smoke-run",
    ].join("\n"),
  )
}

async function wait(proc: ChildProcessWithoutNullStreams, out: string[], err: string[], ms: number) {
  const start = performance.now()
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not become ready within ${ms}ms`)), ms)
    const exit = (code: number | null) => {
      clearTimeout(timer)
      reject(new Error(`server exited before readiness with code ${code ?? "unknown"}`))
    }
    const done = () => {
      clearTimeout(timer)
      proc.off("exit", exit)
      resolve()
    }

    proc.stdout.on("data", (data: Buffer) => {
      out.push(data.toString())
      if (out.join("").includes("server listening on")) done()
    })
    proc.stderr.on("data", (data: Buffer) => {
      err.push(data.toString())
    })
    proc.once("exit", exit)
  })
  return Math.round(performance.now() - start)
}

async function probe(name: string, url: string, ms: number) {
  const start = performance.now()
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) })
  const body = await res.arrayBuffer()
  return {
    name,
    status: res.status,
    ms: Math.round(performance.now() - start),
    bytes: body.byteLength,
  }
}

async function main() {
  const ver = arg("version")
  const exe =
    arg("exe") ??
    (ver
      ? path.join(repo, ".release-smoke", `v${ver}`, "bin", process.platform === "win32" ? "cyxcode.exe" : "cyxcode")
      : undefined)
  if (!exe) {
    usage()
    process.exit(1)
  }
  if (!existsSync(exe)) throw new Error(`binary not found: ${exe}`)

  const port = num("port", 4211)
  const root = path.resolve(arg("root") ?? path.join(repo, ".release-smoke", ver ? `v${ver}` : "manual", "smoke-run"))
  const work = path.join(root, "workspace")
  const xdg = path.join(root, "xdg")
  const state = path.join(root, "state")
  const logs = path.join(root, "logs")
  await Promise.all([work, xdg, state, logs].map((dir) => mkdir(dir, { recursive: true })))

  const out: string[] = []
  const err: string[] = []
  const proc = spawn(exe, ["serve", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: work,
    env: {
      ...process.env,
      XDG_CONFIG_HOME: path.join(xdg, "config"),
      XDG_DATA_HOME: path.join(xdg, "data"),
      XDG_CACHE_HOME: path.join(xdg, "cache"),
      CYXCODE_DB: path.join(state, "cyxcode-smoke.db"),
      CYXCODE_DASHBOARD_URL: process.env.CYXCODE_DASHBOARD_URL ?? "http://127.0.0.1:3002",
      CYXCODE_DISABLE_MODELS_FETCH: "1",
      CYXCODE_DISABLE_LSP_DOWNLOAD: "1",
    },
    windowsHide: true,
  })

  try {
    const ready = await wait(proc, out, err, num("startup-ms", 60_000))
    const base = `http://127.0.0.1:${port}`
    const checks = await Promise.all([
      probe("path", `${base}/path`, num("request-ms", 10_000)),
      probe("graph", `${base}/experimental/codegraph/graph`, num("request-ms", 10_000)),
    ])

    console.log(`binary: ${exe}`)
    console.log(`ready_ms: ${ready}`)
    for (const item of checks) {
      console.log(`${item.name}: status=${item.status} ms=${item.ms} bytes=${item.bytes}`)
    }

    if (checks.some((item) => item.status < 200 || item.status >= 300)) process.exitCode = 1
  } finally {
    await Promise.all([
      writeFile(path.join(logs, "server.out.log"), out.join("")),
      writeFile(path.join(logs, "server.err.log"), err.join("")),
    ])
    if (!proc.killed) proc.kill("SIGKILL")
    proc.stdout.destroy()
    proc.stderr.destroy()
    proc.unref()
  }
}

await main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
