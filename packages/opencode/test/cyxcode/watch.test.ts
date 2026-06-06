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
import { Websocket } from "../../src/util/websocket"
import { Tool } from "../../src/tool/tool"
import { ReadTool } from "../../src/tool/read"
import { Instance } from "../../src/project/instance"
import { Permission } from "../../src/permission"
import { MessageID, SessionID } from "../../src/session/schema"
import { WatchPolicy } from "../../src/cyxcode/watch/policy"
import { createWatchRoutes } from "../../src/server/watch"

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
  await Instance.disposeAll()
  CyxWatch.close()
  process.chdir(cwd)
  CyxPaths.invalidateCache()
  await fs.rm(dir, { recursive: true, force: true })
})

function ctx(ruleset: Permission.Ruleset = []) {
  const session = SessionID.make("ses_cyxwatch_test")
  const message = MessageID.make("msg_cyxwatch_test")
  return {
    sessionID: session,
    messageID: message,
    callID: "call_cyxwatch_test",
    agent: "build",
    abort: new AbortController().signal,
    messages: [],
    metadata() {},
    async ask(req: Omit<Permission.Request, "id" | "sessionID" | "tool">) {
      await Permission.ask({
        ...req,
        sessionID: session,
        tool: {
          messageID: message,
          callID: "call_cyxwatch_test",
        },
        ruleset,
      })
    },
  } satisfies Tool.Context
}

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

  test("queries watch history by session, path, host, flag, and decision", async () => {
    const file = path.join(dir, "query-secret.txt")
    await CyxWatch.scope({
      sessionID: "ses_query",
      messageID: "msg_query",
      prompt: "query watch history",
      fn: async () => {
        await CyxWatch.note({ kind: "file.read", path: file })
        await CyxWatch.request({
          url: "https://query.example.com/upload",
          method: "POST",
          bytes: 11,
          guard: {
            decision: "warn",
            risk: 9,
            flags: ["tracked_query"],
          },
        })
      },
    })

    const rows = await CyxWatch.query({
      sessionID: "ses_query",
      path: "query-secret",
      limit: 10,
    })
    const hosts = await CyxWatch.query({
      host: "query.example.com",
      flag: "tracked_query",
      decision: "warn",
      limit: 10,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]!.path).toBe(file)
    expect(hosts).toHaveLength(1)
    expect(hosts[0]!.host).toBe("query.example.com")
    expect(hosts[0]!.decision).toBe("warn")
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

  test("records policy metadata for allowed outbound requests", async () => {
    await CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          id: "warn-example",
          permission: ["webfetch"],
          host: ["example.com"],
          decision: "warn",
          risk: 33,
          flags: ["tracked_host"],
        },
      ],
    })

    const old = globalThis.fetch
    globalThis.fetch = Object.assign(async () => new Response("ok"), {
      preconnect: old.preconnect,
    })
    try {
      const res = await Http.fetch("https://example.com/api")
      expect(await res.text()).toBe("ok")
      await sleep(250)

      const rows = await CyxWatch.recent(10)
      const row = rows.find((item) => item.kind === "network.outbound" && item.path === "https://example.com/api")
      expect(row).toBeDefined()
      expect(row!.decision).toBe("warn")
      expect(row!.risk).toBe(33)
      expect(row!.flags).toContain("tracked_host")
      expect(row!.flags).toContain("policy_warn-example")
    } finally {
      globalThis.fetch = old
    }
  })

  test("matches outbound policy by method and byte threshold", async () => {
    await CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          id: "large-post",
          permission: ["webfetch"],
          host: ["example.com"],
          method: ["POST"],
          bytes_gt: 4,
          decision: "warn",
          risk: 22,
          flags: ["large_post"],
        },
      ],
    })

    const miss = CyxWatch.classify({
      permission: "webfetch",
      patterns: ["https://example.com/api"],
      metadata: { url: "https://example.com/api", method: "GET", bytes: 5 },
    })
    expect(miss.decision).toBe("allow")

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
      expect(row!.decision).toBe("warn")
      expect(row!.risk).toBe(22)
      expect(row!.flags).toContain("large_post")
      expect(row!.flags).toContain("policy_large-post")
    } finally {
      globalThis.fetch = old
    }
  })

  test("rejects invalid policy rules before saving", async () => {
    await expect(CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          decision: "block",
        },
      ],
    })).rejects.toThrow("rule must include at least one matcher")

    await expect(CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          permission: [""],
          decision: "warn",
        },
      ],
    })).rejects.toThrow("Too small")

    await expect(CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          permission: ["webfetch"],
          bytes_gt: 10,
          bytes_lt: 5,
          decision: "warn",
        },
      ],
    })).rejects.toThrow("byte thresholds")
  })

  test("falls back to blank policy when saved policy file is invalid", async () => {
    await fs.mkdir(path.dirname(WatchPolicy.file()), { recursive: true })
    await fs.writeFile(WatchPolicy.file(), JSON.stringify({
      version: 2,
      rules: [
        {
          permission: ["webfetch"],
          decision: "bogus",
        },
      ],
    }))

    expect(CyxWatch.policy()).toEqual({ version: 2, rules: [] })
    const out = CyxWatch.classify({
      permission: "webfetch",
      patterns: ["https://example.com/api"],
      metadata: { url: "https://example.com/api" },
    })
    expect(out.decision).toBe("allow")
  })

  test("loads default policy rules and lets user policy override them", async () => {
    await fs.mkdir(path.dirname(WatchPolicy.defaultFile()), { recursive: true })
    await fs.writeFile(WatchPolicy.defaultFile(), JSON.stringify({
      version: 2,
      rules: [
        {
          id: "default-warn",
          permission: ["webfetch"],
          host: ["example.com"],
          decision: "warn",
          flags: ["default_policy"],
        },
      ],
    }))

    const base = CyxWatch.classify({
      permission: "webfetch",
      patterns: ["https://example.com/api"],
      metadata: { url: "https://example.com/api" },
    })
    expect(base.decision).toBe("warn")
    expect(base.flags).toContain("default_policy")
    expect(CyxWatch.policy()).toEqual({ version: 2, rules: [] })

    await CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          id: "user-allow",
          permission: ["webfetch"],
          host: ["example.com"],
          decision: "allow",
          flags: ["user_policy"],
        },
      ],
    })

    const out = CyxWatch.classify({
      permission: "webfetch",
      patterns: ["https://example.com/api"],
      metadata: { url: "https://example.com/api" },
    })
    expect(out.decision).toBe("allow")
    expect(out.flags).toContain("user_policy")
    expect(out.flags).not.toContain("default_policy")
    expect(CyxWatch.policy().rules.map((rule) => rule.id)).toEqual(["user-allow"])
  })

  test("ignores invalid default policy while loading user policy", async () => {
    await fs.mkdir(path.dirname(WatchPolicy.defaultFile()), { recursive: true })
    await fs.writeFile(WatchPolicy.defaultFile(), JSON.stringify({
      version: 2,
      rules: [
        {
          decision: "warn",
        },
      ],
    }))
    await CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          id: "user-warn",
          permission: ["webfetch"],
          host: ["example.com"],
          decision: "warn",
          flags: ["user_policy"],
        },
      ],
    })

    const out = CyxWatch.classify({
      permission: "webfetch",
      patterns: ["https://example.com/api"],
      metadata: { url: "https://example.com/api" },
    })
    expect(out.decision).toBe("warn")
    expect(out.flags).toContain("user_policy")
    expect(out.flags).toContain("policy_user-warn")
    expect(CyxWatch.policy().rules.map((rule) => rule.id)).toEqual(["user-warn"])
  })

  test("loads packaged starter default rules", () => {
    expect(CyxWatch.policy()).toEqual({ version: 2, rules: [] })

    const ids = CyxWatch.effectivePolicy().rules.map((rule) => rule.id)
    expect(ids).toContain("default-private-key-block")
    expect(ids).toContain("default-browser-credential-block")
    expect(ids).toContain("default-metadata-service-block")
    expect(ids).toContain("default-large-upload-approval")
  })

  test("starter policy blocks private key reads", async () => {
    const file = path.join(dir, ".ssh", "id_ed25519")
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, "private key")

    await expect(Filesystem.readText(file)).rejects.toThrow("CyxWatch blocked operation")
    await sleep(250)

    const rows = await CyxWatch.recent(10)
    const row = rows.find((item) => item.kind === "file.read" && item.path === file)
    expect(row).toBeDefined()
    expect(row!.decision).toBe("block")
    expect(row!.flags).toContain("private_key")
    expect(row!.flags).toContain("policy_default-private-key-block")
  })

  test("policy route rejects invalid policy with bad request", async () => {
    const app = createWatchRoutes()
    const bad = await app.request("/cyxwatch/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 2,
        rules: [
          {
            decision: "block",
          },
        ],
      }),
    })

    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({
      error: "Invalid CyxWatch policy: rules.0: rule must include at least one matcher",
    })
    expect(CyxWatch.policy()).toEqual({ version: 2, rules: [] })

    const good = await app.request("/cyxwatch/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 2,
        rules: [
          {
            permission: ["webfetch"],
            host: ["example.com"],
            decision: "warn",
          },
        ],
      }),
    })

    expect(good.status).toBe(200)
    const out = await good.json()
    expect(out.policy.rules[0].host).toEqual(["example.com"])
  })

  test("policy routes separate editable and effective policy", async () => {
    await fs.mkdir(path.dirname(WatchPolicy.defaultFile()), { recursive: true })
    await fs.writeFile(WatchPolicy.defaultFile(), JSON.stringify({
      version: 2,
      rules: [
        {
          id: "default-warn",
          permission: ["webfetch"],
          host: ["example.com"],
          decision: "warn",
        },
      ],
    }))
    await CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          id: "user-block",
          permission: ["webfetch"],
          host: ["blocked.example.com"],
          decision: "block",
        },
      ],
    })

    const app = createWatchRoutes()
    const user = await app.request("/cyxwatch/policy")
    const effective = await app.request("/cyxwatch/policy/effective")

    expect(user.status).toBe(200)
    expect(effective.status).toBe(200)
    expect((await user.json()).policy.rules.map((rule: WatchPolicy.Rule) => rule.id)).toEqual(["user-block"])
    const ids = (await effective.json()).policy.rules.map((rule: WatchPolicy.Rule) => rule.id)
    expect(ids.slice(0, 2)).toEqual(["user-block", "default-warn"])
    expect(ids).toContain("default-private-key-block")
  })

  test("query route filters watch events", async () => {
    await CyxWatch.scope({
      sessionID: "ses_route",
      messageID: "msg_route",
      prompt: "query route",
      fn: async () => {
        await CyxWatch.request({
          url: "https://route.example.com/api",
          guard: {
            decision: "warn",
            risk: 7,
            flags: ["route_flag"],
          },
        })
      },
    })

    const app = createWatchRoutes()
    const res = await app.request("/cyxwatch/query?session=ses_route&host=route.example.com&flag=route_flag&decision=warn")

    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out.total).toBe(1)
    expect(out.events[0].sessionID).toBe("ses_route")
    expect(out.events[0].host).toBe("route.example.com")
  })

  test("saved policy blocks shell wrapper commands before spawn", async () => {
    const cmd = process.platform === "win32" ? ["cmd", "/c", "echo", "blocked-policy"] : ["sh", "-lc", "echo blocked-policy"]
    await CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          id: "deny-shell",
          permission: ["bash"],
          cmd: ["*blocked-policy*"],
          decision: "block",
          flags: ["blocked_shell_policy"],
        },
      ],
    })

    await expect(Process.run(cmd, { cwd: dir, nothrow: true })).rejects.toThrow("CyxWatch blocked operation")
    await sleep(250)

    const rows = await CyxWatch.recent(10)
    const row = rows.find((item) => item.kind === "shell.command" && item.cmd === cmd.join(" "))
    expect(row).toBeDefined()
    expect(row!.decision).toBe("block")
    expect(row!.flags).toContain("blocked_shell_policy")
    expect(row!.flags).toContain("policy_deny-shell")
  })

  test("saved policy blocks file reads before loading content", async () => {
    const file = path.join(dir, "private-note.txt")
    await fs.writeFile(file, "do not read")
    await CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          id: "deny-read",
          permission: ["read"],
          path: [file],
          decision: "block",
          flags: ["blocked_read_policy"],
        },
      ],
    })

    await expect(Filesystem.readText(file)).rejects.toThrow("CyxWatch blocked operation")
    await sleep(250)

    const rows = await CyxWatch.recent(10)
    const row = rows.find((item) => item.kind === "file.read" && item.path === file)
    expect(row).toBeDefined()
    expect(row!.decision).toBe("block")
    expect(row!.flags).toContain("blocked_read_policy")
    expect(row!.flags).toContain("policy_deny-read")
  })

  test("permission gate denies tool reads blocked by saved CyxWatch policy", async () => {
    const file = path.join(dir, "blocked-note.txt")
    await fs.writeFile(file, "do not read")
    await CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          id: "deny-tool-read",
          permission: ["read"],
          path: [file],
          decision: "block",
          flags: ["blocked_tool_read"],
        },
      ],
    })

    await Instance.provide({
      directory: dir,
      fn: async () => {
        const read = await ReadTool.init()
        await expect(
          read.execute({ filePath: file }, ctx([{ permission: "read", pattern: "*", action: "allow" }])),
        ).rejects.toThrow("prevents you from using")
      },
    })
  })

  test("permission gate forces approval for sensitive tool reads", async () => {
    const file = path.join(dir, ".env")
    await fs.writeFile(file, "TOKEN=secret")

    await Instance.provide({
      directory: dir,
      fn: async () => {
        const read = await ReadTool.init()
        const task = read.execute({ filePath: file }, ctx([{ permission: "read", pattern: "*", action: "allow" }]))
        await sleep(50)

        const list = await Permission.list()
        expect(list.length).toBe(1)
        expect(list[0].permission).toBe("read")
        expect(list[0].patterns).toEqual([file])

        await Permission.reply({ requestID: list[0].id, reply: "reject" })
        await expect(task).rejects.toThrow("rejected permission")
      },
    })
  })

  test("records websocket connections through wrapper", async () => {
    await CyxWatch.savePolicy({
      version: 2,
      rules: [
        {
          id: "socket-warn",
          permission: ["websocket"],
          host: ["socket.example.com"],
          decision: "warn",
          risk: 31,
          flags: ["socket_policy"],
        },
      ],
    })

    const old = globalThis.WebSocket
    const list: string[] = []
    const fake = class {
      constructor(url: string | URL) {
        list.push(url.toString())
      }
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3
    }
    globalThis.WebSocket = fake as unknown as typeof WebSocket
    try {
      Websocket.connect("wss://socket.example.com/live")
      expect(list).toEqual(["wss://socket.example.com/live"])
      await sleep(250)

      const rows = await CyxWatch.recent(10)
      const row = rows.find((item) => item.kind === "network.websocket" && item.path === "wss://socket.example.com/live")
      expect(row).toBeDefined()
      expect(row!.host).toBe("socket.example.com")
      expect(row!.method).toBe("WEBSOCKET")
      expect(row!.decision).toBe("warn")
      expect(row!.risk).toBe(31)
      expect(row!.flags).toContain("socket_policy")
      expect(row!.flags).toContain("policy_socket-warn")
    } finally {
      globalThis.WebSocket = old
    }
  })

  test("blocks private websocket targets before connecting", async () => {
    let called = false
    const old = globalThis.WebSocket
    const fake = class {
      constructor() {
        called = true
      }
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3
    }
    globalThis.WebSocket = fake as unknown as typeof WebSocket
    try {
      expect(() => Websocket.connect("ws://127.0.0.1:8080/live")).toThrow("CyxWatch blocked operation")
      expect(called).toBe(false)
      await sleep(250)

      const rows = await CyxWatch.recent(10)
      const row = rows.find((item) => item.kind === "network.websocket" && item.path === "ws://127.0.0.1:8080/live")
      expect(row).toBeDefined()
      expect(row!.decision).toBe("require-approval")
      expect(row!.flags).toContain("private_network")
    } finally {
      globalThis.WebSocket = old
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
    expect(sent!.text).toContain("<project-memory>")
    expect(sent!.text).toContain("auth uses jwt middleware")
  })

  test("excludes never_send memory before prompt context", async () => {
    await Memory.save("private-auth", ["auth"], "private auth", "never send this auth detail")
    await Memory.update("private-auth", { privacy: "never_send" })

    const out = await Memory.relevant([
      {
        info: { role: "user" },
        parts: [{ type: "text", text: "auth detail", synthetic: false }],
      },
    ] as Parameters<typeof Memory.relevant>[0])
    expect(out).toEqual([])
    await sleep(250)

    const rows = await CyxWatch.recent(20)
    const row = rows.find((item) => item.kind === "memory.redact" && item.flags.includes("redacted_never_send_memory"))
    expect(row).toBeDefined()
    expect(rows.some((item) => item.kind === "memory.send" && item.text?.includes("never send this auth detail"))).toBe(false)
  })

  test("context route returns sent memory text", async () => {
    await Memory.save("route-auth", ["auth"], "route auth", "route auth context")
    await Memory.relevant([
      {
        info: { role: "user" },
        parts: [{ type: "text", text: "auth context", synthetic: false }],
      },
    ] as Parameters<typeof Memory.relevant>[0])
    await sleep(250)

    const app = createWatchRoutes()
    const res = await app.request("/cyxwatch/context?limit=10")
    expect(res.status).toBe(200)

    const out = await res.json()
    expect(out.total).toBeGreaterThan(0)
    expect(out.events[0].kind).toBe("memory.send")
    expect(out.events[0].text).toContain("route auth context")
  })
})
