import { beforeEach, afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { setTimeout as sleep } from "node:timers/promises"
import { CyxWatch } from "../../src/cyxcode/watch"
import { Filesystem } from "../../src/util/filesystem"
import { Process } from "../../src/util/process"

let dir: string
let cwd: string

beforeEach(async () => {
  cwd = process.cwd()
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxwatch-test-"))
  await fs.mkdir(path.join(dir, ".opencode"), { recursive: true })
  process.chdir(dir)
  CyxWatch.clear()
})

afterEach(async () => {
  process.chdir(cwd)
  await fs.rm(dir, { recursive: true, force: true })
})

describe("CyxWatch", () => {
  test("records file access", async () => {
    const file = path.join(dir, "note.txt")
    await Filesystem.write(file, "hello")
    await sleep(50)
    const rows = await CyxWatch.recent(10)
    const row = rows.find((item) => item.path === file)
    expect(row).toBeDefined()
    expect(row!.kind).toBe("file.write")
    expect(row!.bytes).toBe(5)
  })

  test("records shell commands and reports risk", async () => {
    const cmd = process.platform === "win32" ? ["cmd", "/c", "echo", "hi"] : ["sh", "-lc", "echo hi"]
    await Process.run(cmd, { cwd: dir, nothrow: true })
    await CyxWatch.note({ kind: "file.read", path: path.join(dir, ".ssh", "id_rsa") })

    const report = await CyxWatch.report("all")
    expect(report.total).toBeGreaterThanOrEqual(2)
    expect(report.shell).toBeGreaterThanOrEqual(1)
    expect(report.read).toBeGreaterThanOrEqual(1)
    expect(report.risky).toBeGreaterThanOrEqual(1)
    expect(report.risk).toBeGreaterThan(0)
    expect(report.flags.some((row) => row.name === "sensitive_path")).toBe(true)
  })

  test("classifies risky tool requests", async () => {
    const shell = CyxWatch.classify({
      permission: "bash",
      patterns: ["rm -rf /"],
      metadata: { command: "rm -rf /" },
    })
    expect(shell.decision).toBe("block")

    const file = CyxWatch.classify({
      permission: "edit",
      patterns: [path.join(dir, ".ssh", "config")],
      metadata: { filepath: path.join(dir, ".ssh", "config") },
    })
    expect(file.decision).toBe("require-approval")

    const net = CyxWatch.classify({
      permission: "webfetch",
      patterns: ["http://127.0.0.1:8080"],
      metadata: { url: "http://127.0.0.1:8080" },
    })
    expect(net.decision).toBe("require-approval")

    const search = CyxWatch.classify({
      permission: "websearch",
      patterns: ["cyxcode security"],
      metadata: { query: "cyxcode security" },
    })
    expect(search.decision).toBe("require-approval")

    const ext = CyxWatch.classify({
      permission: "external_directory",
      patterns: [path.join(dir, "out")],
      metadata: { filepath: path.join(dir, "out") },
    })
    expect(ext.decision).toBe("require-approval")
  })
})
