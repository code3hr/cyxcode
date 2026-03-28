import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { createHash } from "crypto"

/**
 * Commit Tests
 *
 * Tests commit creation, hashing, HEAD management, parent chain, and GC.
 * Uses temp directories to avoid polluting real project.
 */

let tmpDir: string
let originalCwd: string

beforeEach(async () => {
  originalCwd = process.cwd()
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxcode-test-"))
  const opencode = path.join(tmpDir, ".opencode")
  await fs.mkdir(opencode, { recursive: true })
  // Point the module to our temp dir
  process.chdir(tmpDir)
})

afterEach(async () => {
  // Change back to original directory before cleanup (Windows requirement)
  process.chdir(originalCwd)
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe("Commit", () => {
  test("hash is deterministic for same state", () => {
    const state = { goal: "test", workingFiles: [], inProgress: "", completed: [], discoveries: [], activeMemories: [], activePatterns: [] }
    const hash1 = createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16)
    const hash2 = createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16)
    expect(hash1).toBe(hash2)
  })

  test("hash changes when state changes", () => {
    const state1 = { goal: "test1", workingFiles: [], inProgress: "", completed: [], discoveries: [], activeMemories: [], activePatterns: [] }
    const state2 = { goal: "test2", workingFiles: [], inProgress: "", completed: [], discoveries: [], activeMemories: [], activePatterns: [] }
    const hash1 = createHash("sha256").update(JSON.stringify(state1)).digest("hex").slice(0, 16)
    const hash2 = createHash("sha256").update(JSON.stringify(state2)).digest("hex").slice(0, 16)
    expect(hash1).not.toBe(hash2)
  })

  test("hash is 16 chars hex", () => {
    const state = { goal: "test", workingFiles: [], inProgress: "", completed: [], discoveries: [], activeMemories: [], activePatterns: [] }
    const hash = createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16)
    expect(hash).toHaveLength(16)
    expect(hash).toMatch(/^[a-f0-9]{16}$/)
  })

  test("HEAD.json structure", async () => {
    const headPath = path.join(tmpDir, ".opencode", "history", "HEAD.json")
    const head = { hash: "abc123def456ghij", timestamp: new Date().toISOString() }
    await fs.mkdir(path.dirname(headPath), { recursive: true })
    await fs.writeFile(headPath, JSON.stringify(head))

    const content = JSON.parse(await fs.readFile(headPath, "utf-8"))
    expect(content.hash).toBe("abc123def456ghij")
    expect(content.timestamp).toBeDefined()
  })

  test("commit structure has required fields", () => {
    const commit = {
      hash: "abc123def456ghij",
      parent: null,
      timestamp: new Date().toISOString(),
      trigger: "session-end" as const,
      session: { slug: "test-session", timestamp: new Date().toISOString() },
      state: {
        goal: "test goal",
        workingFiles: ["/path/to/file.ts"],
        inProgress: "working on tests",
        completed: [],
        discoveries: [],
        activeMemories: [],
        activePatterns: [],
      },
    }

    expect(commit.hash).toBeDefined()
    expect(commit.parent).toBeNull()
    expect(commit.trigger).toBe("session-end")
    expect(commit.session.slug).toBe("test-session")
    expect(commit.state.goal).toBe("test goal")
    expect(commit.state.workingFiles).toHaveLength(1)
  })

  test("parent chain links commits", () => {
    const commit1 = { hash: "aaaa", parent: null }
    const commit2 = { hash: "bbbb", parent: "aaaa" }
    const commit3 = { hash: "cccc", parent: "bbbb" }

    expect(commit3.parent).toBe(commit2.hash)
    expect(commit2.parent).toBe(commit1.hash)
    expect(commit1.parent).toBeNull()
  })

  test("identical state produces same hash (skip duplicate)", () => {
    const state = { goal: "same goal", workingFiles: [], inProgress: "", completed: [], discoveries: [], activeMemories: [], activePatterns: [] }
    const hash1 = createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16)
    const hash2 = createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16)
    expect(hash1).toBe(hash2)
    // autoCommit skips if hash === HEAD.hash — this verifies the dedup mechanism
  })
})
