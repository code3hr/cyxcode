import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { CyxPaths } from "../../src/cyxcode/paths"

/**
 * CyxPaths Tests
 *
 * Tests centralized path resolution for .cyxcode/ and .opencode/ modes.
 */

describe("CyxPaths", () => {
  let tmpDir: string
  let origCwd: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxpaths-test-"))
    origCwd = process.cwd()
    CyxPaths.invalidateCache()
  })

  afterEach(async () => {
    process.chdir(origCwd)
    CyxPaths.invalidateCache()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  describe("detectMode", () => {
    test("returns 'opencode' when only .opencode/ exists", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true })
      process.chdir(tmpDir)
      CyxPaths.invalidateCache()

      expect(CyxPaths.detectMode()).toBe("opencode")
    })

    test("returns 'cyxcode' when .cyxcode/ exists", async () => {
      await fs.mkdir(path.join(tmpDir, ".cyxcode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true })
      process.chdir(tmpDir)
      CyxPaths.invalidateCache()

      expect(CyxPaths.detectMode()).toBe("cyxcode")
    })

    test("prefers .cyxcode/ over .opencode/ when both exist", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true })
      process.chdir(tmpDir)
      CyxPaths.invalidateCache()

      expect(CyxPaths.detectMode()).toBe("cyxcode")
    })

    test("defaults to 'opencode' when neither exists", async () => {
      process.chdir(tmpDir)
      CyxPaths.invalidateCache()

      expect(CyxPaths.detectMode()).toBe("opencode")
    })
  })

  describe("project paths — cyxcode mode", () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(tmpDir, ".cyxcode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true })
      process.chdir(tmpDir)
      CyxPaths.invalidateCache()
    })

    test("projectDir points to .cyxcode/", () => {
      expect(CyxPaths.projectDir()).toBe(path.join(tmpDir, ".cyxcode"))
    })

    test("learnedPath points to .cyxcode/patterns/learned.json", () => {
      expect(CyxPaths.learnedPath()).toBe(path.join(tmpDir, ".cyxcode", "patterns", "learned.json"))
    })

    test("memoryDir points to .cyxcode/memory/", () => {
      expect(CyxPaths.memoryDir()).toBe(path.join(tmpDir, ".cyxcode", "memory"))
    })

    test("historyDir points to .cyxcode/history/", () => {
      expect(CyxPaths.historyDir()).toBe(path.join(tmpDir, ".cyxcode", "history"))
    })

    test("statsPath points to .cyxcode/stats.json", () => {
      expect(CyxPaths.statsPath()).toBe(path.join(tmpDir, ".cyxcode", "stats.json"))
    })

    test("correctionsDir points to .cyxcode/history/corrections/", () => {
      expect(CyxPaths.correctionsDir()).toBe(path.join(tmpDir, ".cyxcode", "history", "corrections"))
    })
  })

  describe("project paths — opencode mode", () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true })
      process.chdir(tmpDir)
      CyxPaths.invalidateCache()
    })

    test("projectDir points to .opencode/", () => {
      expect(CyxPaths.projectDir()).toBe(path.join(tmpDir, ".opencode"))
    })

    test("learnedPath points to .opencode/cyxcode-learned.json", () => {
      expect(CyxPaths.learnedPath()).toBe(path.join(tmpDir, ".opencode", "cyxcode-learned.json"))
    })

    test("memoryDir points to .opencode/memory/", () => {
      expect(CyxPaths.memoryDir()).toBe(path.join(tmpDir, ".opencode", "memory"))
    })

    test("historyDir points to .opencode/history/", () => {
      expect(CyxPaths.historyDir()).toBe(path.join(tmpDir, ".opencode", "history"))
    })

    test("statsPath points to .opencode/cyxcode-stats.json", () => {
      expect(CyxPaths.statsPath()).toBe(path.join(tmpDir, ".opencode", "cyxcode-stats.json"))
    })
  })

  describe("global paths", () => {
    test("globalDir points to ~/.cyxcode/", () => {
      const home = process.env.CYXWIZ_TEST_HOME || os.homedir()
      expect(CyxPaths.globalDir()).toBe(path.join(home, ".cyxcode"))
    })

    test("globalLearnedPath points to ~/.cyxcode/patterns/learned.json", () => {
      const home = process.env.CYXWIZ_TEST_HOME || os.homedir()
      expect(CyxPaths.globalLearnedPath()).toBe(path.join(home, ".cyxcode", "patterns", "learned.json"))
    })

    test("globalMemoryDir points to ~/.cyxcode/memory/", () => {
      const home = process.env.CYXWIZ_TEST_HOME || os.homedir()
      expect(CyxPaths.globalMemoryDir()).toBe(path.join(home, ".cyxcode", "memory"))
    })

    test("globalCorrectionsDir points to ~/.cyxcode/corrections/", () => {
      const home = process.env.CYXWIZ_TEST_HOME || os.homedir()
      expect(CyxPaths.globalCorrectionsDir()).toBe(path.join(home, ".cyxcode", "corrections"))
    })

    test("globalCommunityDir points to ~/.cyxcode/community/", () => {
      const home = process.env.CYXWIZ_TEST_HOME || os.homedir()
      expect(CyxPaths.globalCommunityDir()).toBe(path.join(home, ".cyxcode", "community"))
    })
  })

  describe("invalidateCache", () => {
    test("mode changes after invalidation", async () => {
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true })
      process.chdir(tmpDir)
      CyxPaths.invalidateCache()

      expect(CyxPaths.detectMode()).toBe("opencode")

      // Create .cyxcode/ and invalidate
      await fs.mkdir(path.join(tmpDir, ".cyxcode"), { recursive: true })
      CyxPaths.invalidateCache()

      expect(CyxPaths.detectMode()).toBe("cyxcode")
    })
  })

  describe("walk-up resolution", () => {
    test("finds .cyxcode/ in parent directory", async () => {
      const subDir = path.join(tmpDir, "src", "components")
      await fs.mkdir(subDir, { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".cyxcode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true })
      process.chdir(subDir)
      CyxPaths.invalidateCache()

      expect(CyxPaths.detectMode()).toBe("cyxcode")
      expect(CyxPaths.projectRoot()).toBe(tmpDir)
    })

    test("finds .opencode/ in parent directory", async () => {
      const subDir = path.join(tmpDir, "src", "deep", "nested")
      await fs.mkdir(subDir, { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".opencode"), { recursive: true })
      await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true })
      process.chdir(subDir)
      CyxPaths.invalidateCache()

      expect(CyxPaths.detectMode()).toBe("opencode")
      expect(CyxPaths.projectRoot()).toBe(tmpDir)
    })
  })
})
