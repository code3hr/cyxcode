import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { CommunityPatterns } from "../../src/cyxcode/community"
import { CyxPaths } from "../../src/cyxcode/paths"

/**
 * Community Patterns Tests
 *
 * Tests loading and validation of community pattern packs.
 */

describe("CommunityPatterns", () => {
  let tmpHome: string

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "cyxcommunity-test-"))
    process.env.CYXWIZ_TEST_HOME = tmpHome
    CyxPaths.invalidateCache()
  })

  afterEach(async () => {
    delete process.env.CYXWIZ_TEST_HOME
    CyxPaths.invalidateCache()
    await fs.rm(tmpHome, { recursive: true, force: true })
  })

  test("returns empty array when community dir doesn't exist", async () => {
    const patterns = await CommunityPatterns.loadAll()
    expect(patterns).toEqual([])
  })

  test("loads valid community pack", async () => {
    const communityDir = path.join(tmpHome, ".cyxcode", "community")
    await fs.mkdir(communityDir, { recursive: true })

    const pack = {
      name: "test-pack",
      version: "1.0.0",
      patterns: [
        {
          id: "err-1",
          regex: "Error: something broke",
          category: "test",
          description: "Something broke",
          fixes: [{ id: "fix-1", description: "Fix it", priority: 1 }],
        },
        {
          id: "err-2",
          regex: "Warning: deprecated",
          category: "test",
          description: "Deprecation warning",
          fixes: [{ id: "fix-2", description: "Update", priority: 1 }],
        },
      ],
    }

    await fs.writeFile(path.join(communityDir, "test-pack.json"), JSON.stringify(pack))

    const patterns = await CommunityPatterns.loadAll()

    expect(patterns).toHaveLength(2)
    expect(patterns[0].id).toBe("community-test-pack-err-1")
    expect(patterns[0].regex).toBe("Error: something broke")
    expect(patterns[0].category).toBe("test")
    expect(patterns[0].fixes).toHaveLength(1)
    expect(patterns[1].id).toBe("community-test-pack-err-2")
  })

  test("loads multiple packs", async () => {
    const communityDir = path.join(tmpHome, ".cyxcode", "community")
    await fs.mkdir(communityDir, { recursive: true })

    const pack1 = {
      name: "pack-a",
      version: "1.0.0",
      patterns: [{ id: "a1", regex: "err-a", category: "a", description: "A", fixes: [] }],
    }
    const pack2 = {
      name: "pack-b",
      version: "1.0.0",
      patterns: [{ id: "b1", regex: "err-b", category: "b", description: "B", fixes: [] }],
    }

    await fs.writeFile(path.join(communityDir, "pack-a.json"), JSON.stringify(pack1))
    await fs.writeFile(path.join(communityDir, "pack-b.json"), JSON.stringify(pack2))

    const patterns = await CommunityPatterns.loadAll()
    expect(patterns).toHaveLength(2)
  })

  test("skips invalid packs", async () => {
    const communityDir = path.join(tmpHome, ".cyxcode", "community")
    await fs.mkdir(communityDir, { recursive: true })

    // Invalid: missing name
    await fs.writeFile(path.join(communityDir, "bad.json"), '{"patterns":[]}')

    // Invalid: not JSON
    await fs.writeFile(path.join(communityDir, "broken.json"), "not json at all")

    // Valid
    const good = {
      name: "good",
      version: "1.0.0",
      patterns: [{ id: "g1", regex: "err", category: "g", description: "G", fixes: [] }],
    }
    await fs.writeFile(path.join(communityDir, "good.json"), JSON.stringify(good))

    const patterns = await CommunityPatterns.loadAll()
    expect(patterns).toHaveLength(1)
    expect(patterns[0].id).toBe("community-good-g1")
  })

  test("skips non-json files", async () => {
    const communityDir = path.join(tmpHome, ".cyxcode", "community")
    await fs.mkdir(communityDir, { recursive: true })

    await fs.writeFile(path.join(communityDir, "readme.md"), "# Patterns")
    await fs.writeFile(path.join(communityDir, ".gitkeep"), "")

    const patterns = await CommunityPatterns.loadAll()
    expect(patterns).toEqual([])
  })

  test("pattern ids are prefixed with community-{packname}-", async () => {
    const communityDir = path.join(tmpHome, ".cyxcode", "community")
    await fs.mkdir(communityDir, { recursive: true })

    const pack = {
      name: "bun-errors",
      version: "1.0.0",
      patterns: [{ id: "registry-404", regex: "404", category: "bun", description: "Not found", fixes: [] }],
    }
    await fs.writeFile(path.join(communityDir, "bun-errors.json"), JSON.stringify(pack))

    const patterns = await CommunityPatterns.loadAll()
    expect(patterns[0].id).toBe("community-bun-errors-registry-404")
  })
})
