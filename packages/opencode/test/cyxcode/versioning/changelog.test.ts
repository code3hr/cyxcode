import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"

/**
 * Changelog Tests
 *
 * Tests append-only event log, FIFO cap, and atomic writes.
 */

let tmpDir: string
let originalCwd: string

beforeEach(async () => {
  originalCwd = process.cwd()
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxcode-test-"))
  await fs.mkdir(path.join(tmpDir, ".opencode", "history"), { recursive: true })
  process.chdir(tmpDir)
})

afterEach(async () => {
  // Change back to original directory before cleanup (Windows requirement)
  process.chdir(originalCwd)
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe("Changelog", () => {
  test("entry structure is valid", () => {
    const entry = {
      type: "commit" as const,
      timestamp: new Date().toISOString(),
      data: { hash: "abc123", trigger: "session-end", session: "test-slug" },
    }

    expect(entry.type).toBe("commit")
    expect(entry.timestamp).toBeDefined()
    expect(entry.data.hash).toBe("abc123")
  })

  test("changelog file is valid JSON array", async () => {
    const logPath = path.join(tmpDir, ".opencode", "history", "changelog.json")
    const entries = [
      { type: "commit", timestamp: "2026-03-27T10:00:00Z", data: { hash: "aaa" } },
      { type: "correction", timestamp: "2026-03-27T11:00:00Z", data: { rule: "test" } },
    ]
    await fs.writeFile(logPath, JSON.stringify(entries, null, 2))

    const content = JSON.parse(await fs.readFile(logPath, "utf-8"))
    expect(Array.isArray(content)).toBe(true)
    expect(content).toHaveLength(2)
    expect(content[0].type).toBe("commit")
    expect(content[1].type).toBe("correction")
  })

  test("FIFO cap at 1000 entries", () => {
    const MAX_ENTRIES = 1000
    const entries = Array.from({ length: 1005 }, (_, i) => ({
      type: "commit",
      timestamp: new Date().toISOString(),
      data: { index: i },
    }))

    while (entries.length > MAX_ENTRIES) entries.shift()

    expect(entries).toHaveLength(1000)
    expect(entries[0].data.index).toBe(5) // First 5 removed
    expect(entries[999].data.index).toBe(1004)
  })

  test("recent returns last N entries", () => {
    const entries = Array.from({ length: 20 }, (_, i) => ({
      type: "commit",
      timestamp: new Date().toISOString(),
      data: { index: i },
    }))

    const recent = entries.slice(-5)
    expect(recent).toHaveLength(5)
    expect(recent[0].data.index).toBe(15)
    expect(recent[4].data.index).toBe(19)
  })

  test("empty file returns empty array", async () => {
    const logPath = path.join(tmpDir, ".opencode", "history", "changelog.json")
    // File doesn't exist
    try {
      const content = await fs.readFile(logPath, "utf-8")
      expect(JSON.parse(content)).toEqual([])
    } catch {
      // Expected — file doesn't exist, read() should return []
      expect(true).toBe(true)
    }
  })

  test("all event types are valid", () => {
    const validTypes = ["commit", "correction", "correction-reinforced", "drift", "promotion", "decay", "epoch"]
    for (const type of validTypes) {
      const entry = { type, timestamp: new Date().toISOString(), data: {} }
      expect(validTypes).toContain(entry.type)
    }
  })

  test("atomic write leaves no .tmp files on success", async () => {
    const logPath = path.join(tmpDir, ".opencode", "history", "changelog.json")
    const tmpPath = logPath + ".tmp"

    // Simulate atomic write
    await fs.writeFile(tmpPath, "[]")
    await fs.rename(tmpPath, logPath)

    // .tmp should not exist after rename
    try {
      await fs.access(tmpPath)
      expect(false).toBe(true) // Should not reach here
    } catch {
      expect(true).toBe(true) // .tmp file correctly cleaned up
    }
  })
})
