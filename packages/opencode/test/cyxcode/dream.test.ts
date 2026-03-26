import { describe, expect, test, beforeEach } from "bun:test"
import { Dream } from "../../src/cyxcode/dream"

/**
 * Dream System Tests
 *
 * Tests dream phases: orient, deduplicate, validate, persist stats.
 * Note: Some tests depend on actual file system state and may be affected
 * by other test runs or the presence of .opencode directory.
 */

describe("Dream", () => {
  describe("orient", () => {
    test("should return memory index, learned data, and stats", async () => {
      const result = await Dream.orient()

      expect(result).toHaveProperty("memoryIndex")
      expect(result).toHaveProperty("learnedData")
      expect(result).toHaveProperty("stats")

      expect(result.memoryIndex).toHaveProperty("version")
      expect(result.memoryIndex).toHaveProperty("entries")
      expect(Array.isArray(result.memoryIndex.entries)).toBe(true)
    })

    test("should return stats with expected fields", async () => {
      const result = await Dream.orient()

      expect(result.stats).toHaveProperty("version")
      expect(result.stats).toHaveProperty("matches")
      expect(result.stats).toHaveProperty("misses")
      expect(result.stats).toHaveProperty("hitRate")
      expect(result.stats).toHaveProperty("tokensSaved")
      expect(result.stats).toHaveProperty("sessions")
    })
  })

  describe("deduplicatePatterns", () => {
    test("should return deduplication counts", async () => {
      const result = await Dream.deduplicatePatterns()

      expect(result).toHaveProperty("removedApproved")
      expect(result).toHaveProperty("removedPending")
      expect(typeof result.removedApproved).toBe("number")
      expect(typeof result.removedPending).toBe("number")
      expect(result.removedApproved).toBeGreaterThanOrEqual(0)
      expect(result.removedPending).toBeGreaterThanOrEqual(0)
    })
  })

  describe("deduplicateMemories", () => {
    test("should return merge count", async () => {
      const result = await Dream.deduplicateMemories()

      expect(result).toHaveProperty("merged")
      expect(typeof result.merged).toBe("number")
      expect(result.merged).toBeGreaterThanOrEqual(0)
    })
  })

  describe("validate", () => {
    test("should return validation counts", async () => {
      const result = await Dream.validate()

      expect(result).toHaveProperty("removedMemories")
      expect(result).toHaveProperty("removedPatterns")
      expect(typeof result.removedMemories).toBe("number")
      expect(typeof result.removedPatterns).toBe("number")
      expect(result.removedMemories).toBeGreaterThanOrEqual(0)
      expect(result.removedPatterns).toBeGreaterThanOrEqual(0)
    })
  })

  describe("persistStats", () => {
    test("should return persisted stats", async () => {
      const result = await Dream.persistStats()

      expect(result).toHaveProperty("version")
      expect(result).toHaveProperty("matches")
      expect(result).toHaveProperty("misses")
      expect(result).toHaveProperty("hitRate")
      expect(result).toHaveProperty("tokensSaved")
      expect(result).toHaveProperty("sessions")
      expect(result).toHaveProperty("lastDream")
    })

    test("should update lastDream timestamp", async () => {
      const before = new Date().toISOString()
      const result = await Dream.persistStats()
      const after = new Date().toISOString()

      expect(result.lastDream >= before).toBe(true)
      expect(result.lastDream <= after).toBe(true)
    })

    test("should increment sessions count", async () => {
      const initial = await Dream.loadStats()
      const initialSessions = initial.sessions

      await Dream.persistStats()

      const updated = await Dream.loadStats()
      expect(updated.sessions).toBe(initialSessions + 1)
    })
  })

  describe("loadStats", () => {
    test("should return stats object", async () => {
      const stats = await Dream.loadStats()

      expect(stats).toHaveProperty("version", 1)
      expect(typeof stats.matches).toBe("number")
      expect(typeof stats.misses).toBe("number")
      expect(typeof stats.hitRate).toBe("number")
      expect(typeof stats.tokensSaved).toBe("number")
      expect(typeof stats.sessions).toBe("number")
    })

    test("should return hitRate between 0 and 1", async () => {
      const stats = await Dream.loadStats()

      expect(stats.hitRate).toBeGreaterThanOrEqual(0)
      expect(stats.hitRate).toBeLessThanOrEqual(1)
    })
  })

  describe("run", () => {
    test("should execute all phases and return results", async () => {
      const result = await Dream.run()

      expect(result).toHaveProperty("dupPatterns")
      expect(result).toHaveProperty("dupMemories")
      expect(result).toHaveProperty("validation")
      expect(result).toHaveProperty("stats")

      // Verify nested structures
      expect(result.dupPatterns).toHaveProperty("removedApproved")
      expect(result.dupPatterns).toHaveProperty("removedPending")
      expect(result.dupMemories).toHaveProperty("merged")
      expect(result.validation).toHaveProperty("removedMemories")
      expect(result.validation).toHaveProperty("removedPatterns")
    })

    test("should not throw errors", async () => {
      // Simply call and verify it completes without throwing
      const result = await Dream.run()
      expect(result).toBeDefined()
    })
  })

  describe("initAutoDream", () => {
    test("should not throw when called", () => {
      expect(() => Dream.initAutoDream()).not.toThrow()
    })
  })
})

describe("Dream stats calculations", () => {
  test("hitRate should be matches / (matches + misses)", async () => {
    const stats = await Dream.loadStats()
    const total = stats.matches + stats.misses

    if (total > 0) {
      const expectedHitRate = stats.matches / total
      expect(Math.abs(stats.hitRate - expectedHitRate)).toBeLessThan(0.001)
    } else {
      expect(stats.hitRate).toBe(0)
    }
  })

  test("stats values should be non-negative", async () => {
    const stats = await Dream.loadStats()

    expect(stats.matches).toBeGreaterThanOrEqual(0)
    expect(stats.misses).toBeGreaterThanOrEqual(0)
    expect(stats.tokensSaved).toBeGreaterThanOrEqual(0)
    expect(stats.sessions).toBeGreaterThanOrEqual(0)
  })
})

describe("Dream deduplication logic", () => {
  test("deduplicatePatterns should be idempotent", async () => {
    // Run deduplication twice
    const first = await Dream.deduplicatePatterns()
    const second = await Dream.deduplicatePatterns()

    // Second run should remove nothing (already clean)
    expect(second.removedApproved).toBe(0)
    expect(second.removedPending).toBe(0)
  })

  test("deduplicateMemories should be idempotent", async () => {
    // Run deduplication twice
    const first = await Dream.deduplicateMemories()
    const second = await Dream.deduplicateMemories()

    // Second run should merge nothing (already clean)
    expect(second.merged).toBe(0)
  })

  test("validate should be idempotent", async () => {
    // Run validation twice
    const first = await Dream.validate()
    const second = await Dream.validate()

    // Second run should remove nothing (already clean)
    expect(second.removedMemories).toBe(0)
    expect(second.removedPatterns).toBe(0)
  })
})
