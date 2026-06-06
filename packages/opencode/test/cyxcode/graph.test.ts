import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Graph } from "../../src/cyxcode/graph"
import { Wiki } from "../../src/cyxcode/wiki"
import { Codegraph } from "../../src/cyxcode/codegraph"
import { CyxPaths } from "../../src/cyxcode/paths"
import { CyxWatch } from "../../src/cyxcode/watch"
import { recordFact } from "../../src/cyxcode/recall/facts"
import { close as closeDb, setDbPathOverride } from "../../src/cyxcode/recall/db"

describe("Graph", () => {
  let dir: string
  let cwd: string
  let stub: ((texts: string[]) => Promise<Float32Array[]>) | undefined

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxgraph-unified-"))
    cwd = process.cwd()
    await fs.mkdir(path.join(dir, ".opencode"), { recursive: true })
    await fs.mkdir(path.join(dir, ".git"), { recursive: true })
    await fs.mkdir(path.join(dir, "src"), { recursive: true })
    process.chdir(dir)
    CyxPaths.invalidateCache()
    setDbPathOverride(path.join(dir, "recall.sqlite"))
    CyxWatch.clear()
    stub = (globalThis as any).__cyxcode_recall_embedder_stub
    ;(globalThis as any).__cyxcode_recall_embedder_stub = async (texts: string[]) =>
      texts.map(() => Float32Array.from({ length: 384 }, () => 0))
  })

  afterEach(async () => {
    CyxWatch.clear()
    CyxWatch.close()
    closeDb()
    setDbPathOverride(null)
    process.chdir(cwd)
    CyxPaths.invalidateCache()
    ;(globalThis as any).__cyxcode_recall_embedder_stub = stub
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  })

  test("builds a unified graph across wiki, code, memory, learned, and facts", async () => {
    await fs.writeFile(
      path.join(dir, "src", "core.ts"),
      ["export function core() {", "  return 1", "}", ""].join("\n"),
    )
    await fs.writeFile(
      path.join(dir, "src", "app.ts"),
      ['import { core } from "@/core"', "", "export function run() {", "  return core()", "}", ""].join("\n"),
    )

    await Wiki.create({
      title: "Core Notes",
      body: "See [[Lib Notes]] for the linked note.",
      tags: ["core", "graph"],
    })
    await Wiki.create({
      title: "Lib Notes",
      body: "This note exists so the wikilink resolves.",
      tags: ["library"],
    })

    await Codegraph.rebuild()

    await fs.mkdir(path.dirname(CyxPaths.learnedPath()), { recursive: true })
    await fs.writeFile(
      CyxPaths.learnedPath(),
      JSON.stringify(
        {
          version: 1,
          pending: [],
          approved: [
            {
              id: "learn-1",
              regex: "core",
              category: "shell",
              description: "Shell pattern",
              fixes: [
                {
                  id: "learn-1-fix",
                  description: "echo core",
                  command: "echo core",
                  priority: 1,
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    )

    await fs.mkdir(CyxPaths.memoryDir(), { recursive: true })
    await fs.writeFile(
      path.join(CyxPaths.memoryDir(), "index.json"),
      JSON.stringify(
        {
          version: 1,
          entries: [
            {
              id: "mem-1",
              file: "mem-1.md",
              tags: ["Core Notes"],
              summary: "Memory about the core notes",
              created: "2026-01-01",
              accessed: "2026-01-02",
              accessCount: 2,
            },
          ],
        },
        null,
        2,
      ),
    )

    await recordFact(
      {
        subject: "Core Notes",
        predicate: "relates_to",
        object: "utility",
      },
      {
        sourceEvent: "graph-test",
      },
    )
    CyxWatch.clear()

    const graph = await Graph.build()

    expect(graph.stats).toMatchObject({
      wiki: 2,
      code: 2,
      memory: 1,
      learned: 1,
      facts: 1,
    })

    expect(graph.nodes.some((node) => node.kind === "wiki" && node.title === "Core Notes")).toBe(true)
    expect(graph.nodes.some((node) => node.kind === "code" && node.id === "src/app")).toBe(true)
    expect(graph.nodes.some((node) => node.kind === "symbol" && node.id === "src/core#core")).toBe(true)
    expect(graph.nodes.some((node) => node.kind === "memory" && node.id === "mem-1")).toBe(true)
    expect(graph.nodes.some((node) => node.kind === "learned" && node.id === "learn-1")).toBe(true)
    expect(graph.nodes.some((node) => node.kind === "concept" && node.id === "concept:utility")).toBe(true)

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: "wiki/core-notes", to: "wiki/lib-notes", type: "wikilink" },
        { from: "src/app", to: "src/core", type: "import" },
        { from: "src/core", to: "src/core#core", type: "declares" },
        { from: "mem-1", to: "wiki/core-notes", type: "tag" },
        { from: "learn-1", to: "concept:shell", type: "category" },
        { from: "wiki/core-notes", to: "concept:utility", type: "relates_to" },
      ]),
    )
  })

  test("links CyxWatch incidents to prompts, sessions, files, and hosts", async () => {
    await fs.writeFile(
      path.join(dir, "src", "secret.ts"),
      ["export const secret = 1", ""].join("\n"),
    )
    await Codegraph.rebuild()

    await CyxWatch.turn({
      text: "Check the secret handling path.",
      sessionID: "ses_graph",
      messageID: "msg_graph",
    })

    await CyxWatch.scope({
      sessionID: "ses_graph",
      messageID: "msg_graph",
      prompt: "Check the secret handling path.",
      fn: async () => {
        await CyxWatch.note({ kind: "file.read", path: path.join(dir, "src", "secret.ts") })
        await CyxWatch.request({
          url: "https://api.example.test/upload",
          method: "POST",
          bytes: 8 * 1024 * 1024,
        })
      },
    })

    const graph = await Graph.build({ symbols: false })

    expect(graph.stats.cyxwatch).toBeGreaterThanOrEqual(3)
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cyxwatch:session:ses_graph", kind: "cyxwatch" }),
        expect.objectContaining({ id: "cyxwatch:prompt:msg_graph", kind: "cyxwatch" }),
        expect.objectContaining({ id: "src/secret", kind: "code" }),
      ]),
    )
    expect(graph.nodes.some((node) => node.id.startsWith("cyxwatch:alert:") && node.kind === "cyxwatch")).toBe(true)
    expect(graph.nodes.some((node) => node.id.startsWith("cyxwatch:host:") && node.summary === "api.example.test")).toBe(true)

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ to: "cyxwatch:session:ses_graph", type: "in_session" }),
        expect.objectContaining({ to: "cyxwatch:prompt:msg_graph", type: "from_prompt" }),
        expect.objectContaining({ to: "src/secret", type: "touches" }),
        expect.objectContaining({ type: "contacts" }),
        expect.objectContaining({ type: "raised_from" }),
      ]),
    )
  })
})
