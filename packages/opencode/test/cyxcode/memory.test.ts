import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { setTimeout as sleep } from "node:timers/promises"
import { Memory, type MemoryEntry, type MemoryIndex } from "../../src/cyxcode/memory"
import { CyxPaths } from "../../src/cyxcode/paths"
import { MemoryRoutes } from "../../src/server/routes/memory"
import { CyxWatch } from "../../src/cyxcode/watch"

/**
 * Memory System Tests
 *
 * Tests keyword extraction, query scoring, and load behavior.
 * File I/O operations are tested through the query and load logic.
 */

describe("Memory", () => {
  describe("query", () => {
    const sampleEntries: MemoryEntry[] = [
      {
        id: "mem-1",
        file: "mem-1.md",
        tags: ["react", "component", "button"],
        summary: "React button component implementation",
        created: "2024-01-01",
        accessed: "2024-01-15",
        accessCount: 5,
      },
      {
        id: "mem-2",
        file: "mem-2.md",
        tags: ["react", "hook", "usestate"],
        summary: "Custom hook for state management",
        created: "2024-01-02",
        accessed: "2024-01-10",
        accessCount: 3,
      },
      {
        id: "mem-3",
        file: "mem-3.md",
        tags: ["docker", "container", "nginx"],
        summary: "Docker nginx configuration",
        created: "2024-01-03",
        accessed: "2024-01-05",
        accessCount: 1,
      },
      {
        id: "mem-4",
        file: "mem-4.md",
        tags: ["typescript", "types", "interface"],
        summary: "TypeScript interface patterns",
        created: "2024-01-04",
        accessed: "2024-01-20",
        accessCount: 10,
      },
    ]

    test("should return empty array for empty keywords", () => {
      const result = Memory.query([], sampleEntries)
      expect(result).toEqual([])
    })

    test("should return empty array for no matches", () => {
      const result = Memory.query(["python", "flask"], sampleEntries)
      expect(result).toEqual([])
    })

    test("should match exact tag", () => {
      const result = Memory.query(["react"], sampleEntries)
      expect(result.length).toBe(2)
      expect(result.map(e => e.id)).toContain("mem-1")
      expect(result.map(e => e.id)).toContain("mem-2")
    })

    test("should score exact matches higher than partial", () => {
      const result = Memory.query(["react"], sampleEntries)
      // Both have "react" as exact match, should be sorted by accessCount
      expect(result[0].accessCount).toBeGreaterThanOrEqual(result[1].accessCount)
    })

    test("should match partial tags", () => {
      const result = Memory.query(["type"], sampleEntries)
      // "type" partially matches "typescript" and "types"
      expect(result.length).toBe(1)
      expect(result[0].id).toBe("mem-4")
    })

    test("should be case insensitive", () => {
      const result = Memory.query(["REACT", "Docker"], sampleEntries)
      expect(result.length).toBe(3)
    })

    test("should sort by score then accessCount", () => {
      const entries: MemoryEntry[] = [
        {
          id: "a",
          file: "a.md",
          tags: ["test"],
          summary: "",
          created: "",
          accessed: "",
          accessCount: 10,
        },
        {
          id: "b",
          file: "b.md",
          tags: ["test"],
          summary: "",
          created: "",
          accessed: "",
          accessCount: 5,
        },
      ]

      const result = Memory.query(["test"], entries)
      expect(result[0].id).toBe("a") // Higher accessCount
      expect(result[1].id).toBe("b")
    })

    test("should prioritize exact matches over partial", () => {
      const entries: MemoryEntry[] = [
        {
          id: "partial",
          file: "partial.md",
          tags: ["testing"],
          summary: "",
          created: "",
          accessed: "",
          accessCount: 10,
        },
        {
          id: "exact",
          file: "exact.md",
          tags: ["test"],
          summary: "",
          created: "",
          accessed: "",
          accessCount: 1,
        },
      ]

      const result = Memory.query(["test"], entries)
      // Exact match should score 3, partial should score 1
      expect(result[0].id).toBe("exact")
    })

    test("should handle multiple keyword matches", () => {
      const result = Memory.query(["react", "component"], sampleEntries)
      // mem-1 has both tags
      expect(result[0].id).toBe("mem-1")
    })
  })

  describe("readIndex and writeIndex", () => {
    test("should return empty index when file doesn't exist", async () => {
      // This will use the actual filesystem, testing the error handling path
      // when the index file doesn't exist yet
      const index = await Memory.readIndex()
      expect(index).toHaveProperty("version")
      expect(index).toHaveProperty("entries")
      expect(Array.isArray(index.entries)).toBe(true)
    })
  })

  describe("getBasePath", () => {
    test("should return a path string", () => {
      const basePath = Memory.getBasePath()
      expect(typeof basePath).toBe("string")
      expect(basePath.length).toBeGreaterThan(0)
    })

    test("should contain memory directory", () => {
      const basePath = Memory.getBasePath()
      expect(basePath).toContain("memory")
    })
  })
})

describe("Memory query edge cases", () => {
  test("should handle entries with empty tags", () => {
    const entries: MemoryEntry[] = [
      {
        id: "empty-tags",
        file: "empty.md",
        tags: [],
        summary: "No tags",
        created: "",
        accessed: "",
        accessCount: 0,
      },
    ]

    const result = Memory.query(["test"], entries)
    expect(result).toEqual([])
  })

  test("should handle entries with single character tags", () => {
    const entries: MemoryEntry[] = [
      {
        id: "short-tags",
        file: "short.md",
        tags: ["a", "b", "c"],
        summary: "Short tags",
        created: "",
        accessed: "",
        accessCount: 0,
      },
    ]

    const result = Memory.query(["a"], entries)
    expect(result.length).toBe(1)
  })

  test("should handle very long tags", () => {
    const longTag = "a".repeat(100)
    const entries: MemoryEntry[] = [
      {
        id: "long-tag",
        file: "long.md",
        tags: [longTag],
        summary: "Long tag",
        created: "",
        accessed: "",
        accessCount: 0,
      },
    ]

    const result = Memory.query([longTag], entries)
    expect(result.length).toBe(1)
  })

  test("should handle special characters in keywords", () => {
    const entries: MemoryEntry[] = [
      {
        id: "special",
        file: "special.md",
        tags: ["c++", "c#", "node.js"],
        summary: "Special chars",
        created: "",
        accessed: "",
        accessCount: 0,
      },
    ]

    const result = Memory.query(["c++"], entries)
    expect(result.length).toBe(1)
  })
})

describe("Memory scoring algorithm", () => {
  test("exact match scores 3 points", () => {
    const entries: MemoryEntry[] = [
      {
        id: "test",
        file: "test.md",
        tags: ["exact"],
        summary: "",
        created: "",
        accessed: "",
        accessCount: 0,
      },
    ]

    // Query with exact match
    const result = Memory.query(["exact"], entries)
    expect(result.length).toBe(1)
  })

  test("partial match scores 1 point", () => {
    const entries: MemoryEntry[] = [
      {
        id: "partial",
        file: "partial.md",
        tags: ["partially"],
        summary: "",
        created: "",
        accessed: "",
        accessCount: 0,
      },
    ]

    // "part" is contained in "partially"
    const result = Memory.query(["part"], entries)
    expect(result.length).toBe(1)
  })

  test("multiple tag matches accumulate score", () => {
    const entries: MemoryEntry[] = [
      {
        id: "multi",
        file: "multi.md",
        tags: ["foo", "bar", "baz"],
        summary: "",
        created: "",
        accessed: "",
        accessCount: 0,
      },
      {
        id: "single",
        file: "single.md",
        tags: ["foo"],
        summary: "",
        created: "",
        accessed: "",
        accessCount: 0,
      },
    ]

    const result = Memory.query(["foo", "bar"], entries)
    // "multi" should rank higher (2 exact matches = 6 points vs 1 = 3 points)
    expect(result[0].id).toBe("multi")
  })
})

describe("Memory controls", () => {
  let dir: string
  let cwd: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "cyx-memory-controls-"))
    cwd = process.cwd()
    await fs.mkdir(path.join(dir, ".opencode"), { recursive: true })
    await fs.mkdir(path.join(dir, ".git"), { recursive: true })
    process.chdir(dir)
    CyxPaths.invalidateCache()
  })

  afterEach(async () => {
    await sleep(250)
    CyxWatch.close()
    process.chdir(cwd)
    CyxPaths.invalidateCache()
    await fs.rm(dir, { recursive: true, force: true })
  })

  test("defaults memories to private and updates privacy class", async () => {
    await Memory.save("control", ["auth"], "Auth memory", "remember auth middleware")

    const saved = await Memory.get("control")
    expect(saved?.entry.privacy).toBe("private")

    const next = await Memory.update("control", { privacy: "never_send" })
    expect(next?.privacy).toBe("never_send")

    const idx = await Memory.readIndex()
    expect(idx.entries.find((entry) => entry.id === "control")?.privacy).toBe("never_send")
  })

  test("marks high confidence secret tags as never_send", async () => {
    await Memory.save("token-note", ["token"], "Token memory", "remember token handling")

    const saved = await Memory.get("token-note")
    expect(saved?.entry.privacy).toBe("never_send")

    const next = await Memory.update("token-note", { privacy: "public" })
    expect(next?.privacy).toBe("never_send")
  })

  test("encrypts protected memory files at rest", async () => {
    await Memory.save("secure-note", ["docs"], "Secure memory", "plain secret body")
    await Memory.update("secure-note", { privacy: "sensitive" })

    const raw = await fs.readFile(path.join(Memory.getBasePath(), "secure-note.md"), "utf-8")
    expect(raw).toStartWith("cyxmem:v1.")
    expect(raw).not.toContain("plain secret body")
    expect((await Memory.get("secure-note"))?.content).toBe("plain secret body")

    await Memory.update("secure-note", { privacy: "private" })
    expect(await fs.readFile(path.join(Memory.getBasePath(), "secure-note.md"), "utf-8")).toBe("plain secret body")
  })

  test("applies memory privacy presets conservatively", async () => {
    await Memory.save("auth-note", ["auth"], "Auth memory", "jwt middleware")
    await Memory.save("readme-note", ["docs"], "Readme memory", "project readme")
    await Memory.update("readme-note", { privacy: "never_send" })

    const balanced = await Memory.applyPreset("balanced")
    expect(balanced?.updated).toBe(1)
    expect(balanced?.entries.find((entry) => entry.id === "auth-note")?.privacy).toBe("sensitive")
    expect(balanced?.entries.find((entry) => entry.id === "readme-note")?.privacy).toBe("never_send")

    const open = await Memory.applyPreset("public")
    expect(open?.entries.find((entry) => entry.id === "auth-note")?.privacy).toBe("sensitive")
    expect(open?.entries.find((entry) => entry.id === "readme-note")?.privacy).toBe("never_send")
  })

  test("deletes memory index entry and backing file", async () => {
    await Memory.save("remove-me", ["cleanup"], "Remove memory", "delete this")
    const saved = await Memory.get("remove-me")
    expect(saved).toBeDefined()

    expect(await Memory.remove("remove-me")).toBe(true)
    expect(await Memory.get("remove-me")).toBeUndefined()
    await expect(fs.stat(path.join(Memory.getBasePath(), "remove-me.md"))).rejects.toThrow()
  })

  test("memory routes export, update, and delete entries", async () => {
    await Memory.save("route-memory", ["route"], "Route memory", "route content")
    const app = MemoryRoutes()

    const exp = await app.request("/export?id=route-memory")
    expect(exp.status).toBe(200)
    expect((await exp.json()).content).toBe("route content")

    const patch = await app.request("/page?id=route-memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privacy: "sensitive" }),
    })
    expect(patch.status).toBe(200)
    expect((await patch.json()).entry.privacy).toBe("sensitive")

    const presets = await app.request("/presets")
    expect(presets.status).toBe(200)
    expect((await presets.json()).presets.map((item: { id: string }) => item.id)).toContain("balanced")

    const preset = await app.request("/preset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "strict" }),
    })
    expect(preset.status).toBe(200)
    expect((await preset.json()).entries[0].privacy).toBe("sensitive")

    const del = await app.request("/page?id=route-memory", { method: "DELETE" })
    expect(del.status).toBe(200)
    expect((await del.json()).success).toBe(true)
  })
})
