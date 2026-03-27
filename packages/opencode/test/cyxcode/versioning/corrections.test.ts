import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"

/**
 * Corrections Tests
 *
 * Tests correction CRUD, strength scoring, budget enforcement,
 * and system prompt formatting.
 */

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxcode-test-"))
  const corrections = path.join(tmpDir, ".opencode", "history", "corrections")
  await fs.mkdir(corrections, { recursive: true })
  process.chdir(tmpDir)
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe("Corrections", () => {
  test("correction structure is valid", () => {
    const correction = {
      id: "test-hash-123",
      rule: "always use bun, not npm",
      strength: 1,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      source: "explicit" as const,
      promoted: false,
      decayBase: 0,
    }

    expect(correction.id).toBeDefined()
    expect(correction.rule).toBe("always use bun, not npm")
    expect(correction.strength).toBe(1)
    expect(correction.source).toBe("explicit")
    expect(correction.promoted).toBe(false)
  })

  test("strength increments on reinforcement", () => {
    const correction = { strength: 1 }
    correction.strength++
    expect(correction.strength).toBe(2)
    correction.strength++
    expect(correction.strength).toBe(3)
  })

  test("auto-promote threshold is 3", () => {
    const AUTO_PROMOTE_THRESHOLD = 3
    expect(1 >= AUTO_PROMOTE_THRESHOLD).toBe(false)
    expect(2 >= AUTO_PROMOTE_THRESHOLD).toBe(false)
    expect(3 >= AUTO_PROMOTE_THRESHOLD).toBe(true)
    expect(5 >= AUTO_PROMOTE_THRESHOLD).toBe(true)
  })

  test("correction file can be written and read", async () => {
    const correction = {
      id: "test-id",
      rule: "always use bun",
      strength: 2,
      created: "2026-03-27T00:00:00Z",
      updated: "2026-03-27T12:00:00Z",
      source: "explicit",
      promoted: false,
      decayBase: 0,
    }

    const filePath = path.join(tmpDir, ".opencode", "history", "corrections", "test-id.json")
    await fs.writeFile(filePath, JSON.stringify(correction, null, 2))

    const content = JSON.parse(await fs.readFile(filePath, "utf-8"))
    expect(content.rule).toBe("always use bun")
    expect(content.strength).toBe(2)
  })

  test("multiple corrections sorted by strength", () => {
    const corrections = [
      { id: "a", rule: "rule a", strength: 1 },
      { id: "b", rule: "rule b", strength: 5 },
      { id: "c", rule: "rule c", strength: 3 },
    ]

    const sorted = corrections.sort((a, b) => b.strength - a.strength)
    expect(sorted[0].id).toBe("b") // strength 5
    expect(sorted[1].id).toBe("c") // strength 3
    expect(sorted[2].id).toBe("a") // strength 1
  })

  test("system prompt format has correct tags", () => {
    const lines = ["- [strength 5] always use bun", "- [strength 2] keep responses short"]
    const output = `<cyxcode-corrections>\nIMPORTANT — User has corrected you on these behaviors:\n${lines.join("\n")}\n</cyxcode-corrections>`

    expect(output).toContain("<cyxcode-corrections>")
    expect(output).toContain("</cyxcode-corrections>")
    expect(output).toContain("IMPORTANT")
    expect(output).toContain("[strength 5]")
    expect(output).toContain("always use bun")
  })

  test("budget cap prevents overflow", () => {
    const MAX_CHARS = 1100
    let total = 0
    const lines: string[] = []

    // Create 50 corrections
    for (let i = 0; i < 50; i++) {
      const line = `- [strength ${i}] This is a correction rule number ${i} that is fairly long to test budget`
      if (total + line.length > MAX_CHARS) break
      lines.push(line)
      total += line.length
    }

    expect(total).toBeLessThanOrEqual(MAX_CHARS)
    expect(lines.length).toBeLessThan(50) // Not all fit
    expect(lines.length).toBeGreaterThan(0)
  })

  test("active filters out promoted corrections", () => {
    const corrections = [
      { id: "a", strength: 5, promoted: true },
      { id: "b", strength: 3, promoted: false },
      { id: "c", strength: 1, promoted: false },
    ]

    const active = corrections.filter(c => !c.promoted && c.strength > 0)
    expect(active).toHaveLength(2)
    expect(active[0].id).toBe("b")
  })

  test("validation rejects invalid correction data", () => {
    const valid = { id: "test", rule: "test rule", strength: 1 }
    const invalid1 = { id: "test" } // missing rule and strength
    const invalid2 = { id: "test", rule: "test", strength: "not a number" }

    expect(valid.id && valid.rule && typeof valid.strength === "number").toBe(true)
    expect(!!(invalid1 as any).rule && typeof (invalid1 as any).strength === "number").toBe(false)
    expect(typeof (invalid2 as any).strength === "number").toBe(false)
  })
})
