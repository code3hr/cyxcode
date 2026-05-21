import { beforeEach, afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import z from "zod"
import { setTimeout as sleep } from "node:timers/promises"
import { CyxWatch } from "../../src/cyxcode/watch"
import { CyxPaths } from "../../src/cyxcode/paths"
import { WatchSecret } from "../../src/cyxcode/watch/secret"
import { Memory } from "../../src/cyxcode/memory"
import { Filesystem } from "../../src/util/filesystem"
import { Http } from "../../src/util/http"
import { Process } from "../../src/util/process"
import { Tool } from "../../src/tool/tool"

let dir: string
let cwd: string

beforeEach(async () => {
  cwd = process.cwd()
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxwatch-test-"))
  await fs.mkdir(path.join(dir, ".opencode"), { recursive: true })
  process.chdir(dir)
  CyxPaths.invalidateCache()
  CyxWatch.clear()
})

afterEach(async () => {
  CyxWatch.close()
  process.chdir(cwd)
  CyxPaths.invalidateCache()
  await fs.rm(dir, { recursive: true, force: true })
})

describe("CyxWatch", () => {
  test("records file access", async () => {
    const file = path.join(dir, "note.txt")
    await Filesystem.write(file, "hello")
    await sleep(250)
    const rows = await CyxWatch.recent(10)
    const row = rows.find((item) => item.path === file)
    expect(row).toBeDefined()
    expect(row!.kind).toBe("file.write")
    expect(row!.bytes).toBe(5)
  })

  test("mirrors events into local sqlite storage", async () => {
    const file = path.join(dir, "sqlite-note.txt")
    await Filesystem.write(file, "hello")
    await sleep(250)

    const rows = await CyxWatch.recent(10)
    const row = rows.find((item) => item.path === file)
    expect(row).toBeDefined()
    expect(await fs.stat(path.join(CyxPaths.projectDir(), "cyxwatch", "events.db"))).toBeDefined()
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

  test("applies project policy to block matching outbound hosts", async () => {
    await CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          id: "deny-example",
          permission: ["webfetch"],
          host: ["example.com"],
          decision: "block",
          flags: ["blocked_host"],
        },
      ],
    })

    let called = false
    const old = globalThis.fetch
    globalThis.fetch = Object.assign(
      async () => {
        called = true
        return new Response("ok")
      },
      {
        preconnect: old.preconnect,
      },
    )
    try {
      await expect(Http.fetch("https://example.com/api")).rejects.toThrow("CyxWatch blocked operation")
      expect(called).toBe(false)
      await sleep(250)

      const rows = await CyxWatch.recent(10)
      const row = rows.find((item) => item.kind === "network.outbound" && item.path === "https://example.com/api")
      expect(row).toBeDefined()
      expect(row!.decision).toBe("block")
      expect(row!.flags).toContain("blocked_host")
    } finally {
      globalThis.fetch = old
    }
  })

  test("allows explicit policy exceptions for local network calls", async () => {
    await CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          id: "allow-local-test",
          permission: ["webfetch"],
          host: ["127.0.0.1:8080"],
          decision: "allow",
        },
      ],
    })

    let called = false
    const old = globalThis.fetch
    globalThis.fetch = Object.assign(
      async () => {
        called = true
        return new Response("ok")
      },
      {
        preconnect: old.preconnect,
      },
    )
    try {
      const res = await Http.fetch("http://127.0.0.1:8080/health")
      expect(await res.text()).toBe("ok")
      expect(called).toBe(true)
    } finally {
      globalThis.fetch = old
    }
  })

  test("blocks dangerous process wrapper commands before spawn", async () => {
    await expect(Process.run(["rm", "-rf", "/"], { nothrow: true })).rejects.toThrow("CyxWatch blocked operation")
  })

  test("records outbound requests through http wrapper", async () => {
    const old = globalThis.fetch
    globalThis.fetch = Object.assign(async () => new Response("ok"), {
      preconnect: old.preconnect,
    })
    try {
      const res = await Http.fetch("https://example.com/api", {
        method: "POST",
        body: "hello",
      })
      expect(await res.text()).toBe("ok")
      await sleep(250)

      const rows = await CyxWatch.recent(10)
      const row = rows.find((item) => item.kind === "network.outbound" && item.path === "https://example.com/api")
      expect(row).toBeDefined()
      expect(row!.host).toBe("example.com")
      expect(row!.method).toBe("POST")
      expect(row!.bytes).toBe(5)
    } finally {
      globalThis.fetch = old
    }
  })

  test("blocks wrapper-level network requests requiring approval", async () => {
    let called = false
    const old = globalThis.fetch
    globalThis.fetch = Object.assign(
      async () => {
        called = true
        return new Response("ok")
      },
      {
        preconnect: old.preconnect,
      },
    )
    try {
      await expect(Http.fetch("http://127.0.0.1:8080/secret")).rejects.toThrow("CyxWatch blocked operation")
      expect(called).toBe(false)
      await sleep(250)

      const rows = await CyxWatch.recent(10)
      const row = rows.find((item) => item.kind === "network.outbound" && item.path === "http://127.0.0.1:8080/secret")
      expect(row).toBeDefined()
      expect(row!.decision).toBe("require-approval")
    } finally {
      globalThis.fetch = old
    }
  })

  test("blocks wrapper-level sensitive writes requiring approval", async () => {
    const file = path.join(dir, ".ssh", "config")
    await expect(Filesystem.write(file, "secret")).rejects.toThrow("CyxWatch blocked operation")
    await sleep(250)

    const rows = await CyxWatch.recent(10)
    const row = rows.find((item) => item.kind === "file.write" && item.path === file)
    expect(row).toBeDefined()
    expect(row!.decision).toBe("require-approval")
  })

  test("blocks wrapper-level sensitive reads before loading content", async () => {
    const file = path.join(dir, ".env")
    await fs.writeFile(file, "API_TOKEN=secret")

    await expect(Filesystem.readText(file)).rejects.toThrow("CyxWatch blocked operation")
    await sleep(250)

    const rows = await CyxWatch.recent(10)
    const row = rows.find((item) => item.kind === "file.read" && item.path === file)
    expect(row).toBeDefined()
    expect(row!.decision).toBe("require-approval")
    expect(row!.flags).toContain("sensitive_path")
  })

  test("classifies credential files as sensitive reads", async () => {
    const file = path.join(dir, ".aws", "credentials")
    const out = CyxWatch.classify({
      permission: "read",
      patterns: [file],
      metadata: { filepath: file },
    })
    expect(out.decision).toBe("require-approval")
    expect(out.flags).toContain("sensitive_path")
  })

  test("blocks env enumeration commands before spawn", async () => {
    const cmd = process.platform === "win32" ? ["cmd", "/c", "set"] : ["sh", "-lc", "printenv"]
    await expect(Process.run(cmd, { nothrow: true })).rejects.toThrow("CyxWatch blocked operation")
    await sleep(250)

    const rows = await CyxWatch.recent(10)
    const row = rows.find((item) => item.kind === "shell.command" && item.flags.includes("env_access"))
    expect(row).toBeDefined()
    expect(row!.decision).toBe("require-approval")
  })

  test("redacts high-confidence secrets without exposing raw values", async () => {
    const out = await WatchSecret.scan({
      source: "test",
      text: "token=ghp_123456789012345678901234567890123456",
    })
    expect(out.redacted).toBe(true)
    expect(out.content).not.toContain("ghp_123456789012345678901234567890123456")
    expect(out.content).toContain("[REDACTED:github_token:1]")
    await sleep(250)

    const rows = await CyxWatch.recent(10)
    const row = rows.find((item) => item.kind === "output.secret")
    expect(row).toBeDefined()
    expect(row!.flags).toContain("secret_in_output")
    expect(JSON.stringify(row)).not.toContain("ghp_123456789012345678901234567890123456")
  })

  test("redacts secrets from tool output", async () => {
    const tool = Tool.define("secret-test", {
      description: "test",
      parameters: z.object({}),
      async execute() {
        return {
          title: "secret",
          metadata: {},
          output: "AWS key AKIA1234567890ABCDEF",
        }
      },
    })
    const info = await tool.init()
    const result = await info.execute(
      {},
      {
        sessionID: "ses_test",
        messageID: "msg_test",
        agent: "build",
        abort: new AbortController().signal,
        messages: [],
        metadata() {},
        async ask() {},
      } as unknown as Tool.Context,
    )
    expect(result.output).toContain("[REDACTED:aws_access_key:1]")
    expect(result.output).not.toContain("AKIA1234567890ABCDEF")
    expect((result.metadata as { cyxwatchSecretRedacted?: boolean }).cyxwatchSecretRedacted).toBe(true)
  })

  test("records assistant output secret telemetry", async () => {
    const out = await WatchSecret.scan({
      source: "assistant:msg_test:part_test",
      text: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456",
    })
    expect(out.content).toContain("[REDACTED:bearer_token:1]")
    expect(out.content).not.toContain("abcdefghijklmnopqrstuvwxyz123456")
    await sleep(250)

    const rows = await CyxWatch.recent(10)
    const row = rows.find((item) => item.kind === "output.secret" && item.path === "assistant:msg_test:part_test")
    expect(row).toBeDefined()
    expect(row!.flags).toContain("secret_bearer_token")
    expect(JSON.stringify(row)).not.toContain("abcdefghijklmnopqrstuvwxyz123456")
  })

  test("records memory reads and prompt-context sends", async () => {
    await Memory.save("auth-note", ["auth", "jwt"], "auth note", "auth uses jwt middleware")
    const out = await Memory.relevant([
      {
        info: { role: "user" },
        parts: [{ type: "text", text: "how does auth work", synthetic: false }],
      },
    ] as Parameters<typeof Memory.relevant>[0])
    expect(out.length).toBeGreaterThan(0)
    await sleep(250)

    const rows = await CyxWatch.recent(20)
    expect(rows.some((item) => item.kind === "memory.read" && item.path?.endsWith("auth-note.md"))).toBe(true)
    expect(rows.some((item) => item.kind === "memory.retrieve" && item.path === "memory:project")).toBe(true)
    const sent = rows.find((item) => item.kind === "memory.send" && item.path === "memory:prompt-context")
    expect(sent).toBeDefined()
    expect(sent!.flags).toContain("memory_disclosure")
  })
})
