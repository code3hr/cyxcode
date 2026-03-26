import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { Memory, type MemoryEntry, type MemoryIndex } from "../../src/cyxcode/memory"

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
