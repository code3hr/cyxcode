import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Wiki, type WikiPage } from "../../src/cyxcode/wiki"
import { CyxPaths } from "../../src/cyxcode/paths"

describe("Wiki", () => {
  let dir: string
  let cwd: string
  let stub: ((texts: string[]) => Promise<Float32Array[]>) | undefined

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxwiki-test-"))
    cwd = process.cwd()
    await fs.mkdir(path.join(dir, ".opencode"), { recursive: true })
    await fs.mkdir(path.join(dir, ".git"), { recursive: true })
    process.chdir(dir)
    CyxPaths.invalidateCache()
    stub = (globalThis as any).__cyxcode_recall_embedder_stub
    ;(globalThis as any).__cyxcode_recall_embedder_stub = async (texts: string[]) =>
      texts.map(() => Float32Array.from({ length: 384 }, () => 0))
  })

  afterEach(async () => {
    process.chdir(cwd)
    CyxPaths.invalidateCache()
    ;(globalThis as any).__cyxcode_recall_embedder_stub = stub
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  })

  test("query ranks title matches above summary and backlinks", () => {
    const pages: WikiPage[] = [
      {
        id: "docs/architecture",
        path: "docs/architecture.md",
        kind: "doc",
        title: "Architecture Notes",
        summary: "System layout and conventions",
        tags: ["architecture", "system"],
        links: ["docs/api"],
        backlinks: [],
        hash: "a",
        created: 1,
        modified: 1,
        accessed: 1,
        accessCount: 1,
      },
      {
        id: "docs/api",
        path: "docs/api.md",
        kind: "doc",
        title: "API Guide",
        summary: "Architecture details for clients",
        tags: ["api"],
        links: [],
        backlinks: ["docs/architecture"],
        hash: "b",
        created: 1,
        modified: 2,
        accessed: 1,
        accessCount: 10,
      },
    ]

    const result = Wiki.query(["architecture"], pages)
    expect(result[0].id).toBe("docs/architecture")
    expect(result[1].id).toBe("docs/api")
  })

  test("graph converts wikilinks into edges", () => {
    const idx = {
      version: 1 as const,
      pages: [
        {
          id: "docs/a",
          path: "docs/a.md",
          kind: "doc" as const,
          title: "A",
          summary: "",
          tags: [],
          links: ["docs/b"],
          backlinks: [],
          hash: "a",
          created: 1,
          modified: 1,
          accessed: 1,
          accessCount: 0,
        },
        {
          id: "docs/b",
          path: "docs/b.md",
          kind: "doc" as const,
          title: "B",
          summary: "",
          tags: [],
          links: [],
          backlinks: ["docs/a"],
          hash: "b",
          created: 1,
          modified: 1,
          accessed: 1,
          accessCount: 0,
        },
      ],
    }

    const graph = Wiki.graph(idx)
    expect(graph.nodes.length).toBe(2)
    expect(graph.edges).toEqual([{ from: "docs/a", to: "docs/b", type: "wikilink" }])
  })

  test("create writes a note and updates the index", async () => {
    const page = await Wiki.create({
      title: "Project Notes",
      body: "Hello from the wiki.",
      tags: ["project", "notes"],
    })

    expect(page.title).toBe("Project Notes")
    expect(page.kind).toBe("wiki")
    expect(page.path.endsWith(".md")).toBe(true)

    const idx = await Wiki.readIndex()
    expect(idx.pages.some((item) => item.id === page.id)).toBe(true)
  })

  test("upsert updates an existing note by title", async () => {
    const first = await Wiki.upsert({
      title: "Rolling Note",
      body: "First body.",
      tags: ["first"],
    })

    const next = await Wiki.upsert({
      title: "Rolling Note",
      body: "Second body.",
      tags: ["second"],
    })

    expect(next.id).toBe(first.id)
    expect(next.tags).toContain("second")

    const idx = await Wiki.readIndex()
    expect(idx.pages.find((item) => item.id === first.id)?.summary).toContain("Second body")
  })

  test("update rewrites an existing note", async () => {
    const page = await Wiki.create({
      title: "Update Notes",
      body: "Old body.",
      tags: ["old"],
    })

    const next = await Wiki.update(page.id, {
      title: "Update Notes",
      body: "New body.",
      tags: ["new"],
    })

    expect(next.title).toBe("Update Notes")
    expect(next.tags).toContain("new")

    const idx = await Wiki.readIndex()
    expect(idx.pages.find((item) => item.id === page.id)?.summary).toContain("New body")
  })

  test("rename updates the page title", async () => {
    const page = await Wiki.create({
      title: "Old Name",
      body: "Body stays.",
      tags: ["keep"],
    })

    const next = await Wiki.rename(page.id, "New Name")
    expect(next.title).toBe("New Name")

    const idx = await Wiki.readIndex()
    expect(idx.pages.find((item) => item.id === page.id)?.title).toBe("New Name")
  })

  test("delete removes a note from the index", async () => {
    const page = await Wiki.create({
      title: "Delete Me",
      body: "Soon gone.",
      tags: ["gone"],
    })

    await Wiki.remove(page.id)

    const idx = await Wiki.readIndex()
    expect(idx.pages.some((item) => item.id === page.id)).toBe(false)
  })
})
