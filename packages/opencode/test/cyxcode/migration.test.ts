import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { CyxMigration } from "../../src/cyxcode/migration"

/**
 * Migration Tests
 *
 * Tests copy-based migration from .opencode/ to .cyxcode/.
 */

describe("CyxMigration", () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxmigrate-test-"))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  describe("needsMigration", () => {
    test("returns false when .opencode/ does not exist", async () => {
      expect(await CyxMigration.needsMigration(tmpDir)).toBe(false)
    })

    test("returns false when .cyxcode/ does not exist (init must run first)", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      expect(await CyxMigration.needsMigration(tmpDir)).toBe(false)
    })

    test("returns true when .opencode/ has cyxcode files and .cyxcode/ exists", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode"), { recursive: true })
      await fs.writeFile(
        path.join(tmpDir, ".opencode", "cyxcode-learned.json"),
        '{"version":1,"pending":[],"approved":[]}'
      )
      expect(await CyxMigration.needsMigration(tmpDir)).toBe(true)
    })

    test("returns false when migration marker exists", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode"), { recursive: true })
      await fs.writeFile(
        path.join(tmpDir, ".opencode", "cyxcode-learned.json"),
        '{"version":1,"pending":[],"approved":[]}'
      )
      await fs.writeFile(
        path.join(tmpDir, ".opencode", ".cyxcode-migrated"),
        '{"migratedAt":"2026-01-01"}'
      )
      expect(await CyxMigration.needsMigration(tmpDir)).toBe(false)
    })

    test("returns false when .opencode/ has no cyxcode files", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode"), { recursive: true })
      // Only opencode-native files (no cyxcode-learned, memory, history, etc.)
      await fs.writeFile(path.join(tmpDir, ".opencode", "opencode.jsonc"), "{}")
      expect(await CyxMigration.needsMigration(tmpDir)).toBe(false)
    })
  })

  describe("migrate", () => {
    test("copies cyxcode-learned.json to patterns/learned.json", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode", "patterns"), { recursive: true })

      const learnedData = '{"version":1,"pending":[],"approved":[{"id":"test","regex":"err"}]}'
      await fs.writeFile(path.join(tmpDir, ".opencode", "cyxcode-learned.json"), learnedData)

      const report = await CyxMigration.migrate(tmpDir)

      expect(report.patterns).toBe(1)
      expect(report.totalFiles).toBeGreaterThanOrEqual(1)

      const migrated = await fs.readFile(
        path.join(tmpDir, ".cyxcode", "patterns", "learned.json"),
        "utf-8"
      )
      expect(migrated).toBe(learnedData)
    })

    test("copies cyxcode-stats.json to stats.json", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode"), { recursive: true })

      const statsData = '{"version":1,"matches":5,"misses":2}'
      await fs.writeFile(path.join(tmpDir, ".opencode", "cyxcode-stats.json"), statsData)

      const report = await CyxMigration.migrate(tmpDir)

      expect(report.stats).toBe(1)

      const migrated = await fs.readFile(path.join(tmpDir, ".cyxcode", "stats.json"), "utf-8")
      expect(migrated).toBe(statsData)
    })

    test("copies memory directory recursively", async () => {
      const srcMemory = path.join(tmpDir, ".opencode", "memory")
      await fs.mkdir(srcMemory, { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode", "memory"), { recursive: true })

      await fs.writeFile(path.join(srcMemory, "index.json"), '{"version":1,"entries":[]}')
      await fs.writeFile(path.join(srcMemory, "auth-jwt.md"), "auth uses JWT")

      const report = await CyxMigration.migrate(tmpDir)

      expect(report.memories).toBe(2)

      const index = await fs.readFile(
        path.join(tmpDir, ".cyxcode", "memory", "index.json"),
        "utf-8"
      )
      expect(index).toContain("entries")

      const mem = await fs.readFile(
        path.join(tmpDir, ".cyxcode", "memory", "auth-jwt.md"),
        "utf-8"
      )
      expect(mem).toBe("auth uses JWT")
    })

    test("copies history directory recursively", async () => {
      const srcHistory = path.join(tmpDir, ".opencode", "history")
      await fs.mkdir(path.join(srcHistory, "commits"), { recursive: true })
      await fs.mkdir(path.join(srcHistory, "corrections"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode", "history"), { recursive: true })

      await fs.writeFile(path.join(srcHistory, "HEAD.json"), '{"hash":"abc123"}')
      await fs.writeFile(path.join(srcHistory, "commits", "abc123.json"), '{"hash":"abc123"}')

      const report = await CyxMigration.migrate(tmpDir)

      expect(report.history).toBeGreaterThanOrEqual(2)

      const head = await fs.readFile(
        path.join(tmpDir, ".cyxcode", "history", "HEAD.json"),
        "utf-8"
      )
      expect(head).toContain("abc123")
    })

    test("writes migration marker after successful copy", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode", "patterns"), { recursive: true })

      await fs.writeFile(
        path.join(tmpDir, ".opencode", "cyxcode-learned.json"),
        '{"version":1,"pending":[],"approved":[]}'
      )

      await CyxMigration.migrate(tmpDir)

      const marker = JSON.parse(
        await fs.readFile(path.join(tmpDir, ".opencode", ".cyxcode-migrated"), "utf-8")
      )
      expect(marker.migratedAt).toBeTruthy()
      expect(marker.filesCount).toBeGreaterThanOrEqual(1)
    })

    test("does not delete originals (copy, not move)", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode", "patterns"), { recursive: true })

      await fs.writeFile(
        path.join(tmpDir, ".opencode", "cyxcode-learned.json"),
        '{"version":1,"pending":[],"approved":[]}'
      )

      await CyxMigration.migrate(tmpDir)

      // Original still exists
      const original = await fs.readFile(
        path.join(tmpDir, ".opencode", "cyxcode-learned.json"),
        "utf-8"
      )
      expect(original).toContain("version")
    })

    test("returns zero report when no cyxcode files exist", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode"), { recursive: true })

      const report = await CyxMigration.migrate(tmpDir)

      expect(report.totalFiles).toBe(0)
      expect(report.patterns).toBe(0)
      expect(report.memories).toBe(0)
    })
  })
})
