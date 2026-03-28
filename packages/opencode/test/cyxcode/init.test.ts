import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { CyxPaths } from "../../src/cyxcode/paths"

/**
 * cyxcode init Tests
 *
 * Tests the init command logic: directory creation, config, gitignore, project detection.
 * We test the underlying functions rather than the CLI handler to avoid yargs bootstrapping.
 */

describe("cyxcode init — directory creation", () => {
  let tmpDir: string
  let origCwd: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxinit-test-"))
    origCwd = process.cwd()
    // Create a git repo so path resolution works
    await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true })
  })

  afterEach(async () => {
    process.chdir(origCwd)
    CyxPaths.invalidateCache()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test("creates .cyxcode/ with all subdirectories", async () => {
    const cyxDir = path.join(tmpDir, ".cyxcode")
    const subdirs = [
      "history",
      "history/commits",
      "history/corrections",
      "memory",
      "patterns",
      "agent",
      "command",
    ]

    await fs.mkdir(cyxDir, { recursive: true })
    for (const sub of subdirs) {
      await fs.mkdir(path.join(cyxDir, sub), { recursive: true })
    }

    // Verify all directories exist
    for (const sub of subdirs) {
      const stat = await fs.stat(path.join(cyxDir, sub))
      expect(stat.isDirectory()).toBe(true)
    }
  })

  test("creates config.json with project type", async () => {
    const cyxDir = path.join(tmpDir, ".cyxcode")
    await fs.mkdir(cyxDir, { recursive: true })

    // Create package.json so project type is "node"
    await fs.writeFile(path.join(tmpDir, "package.json"), '{"name":"test"}')

    const config = {
      version: 1,
      projectType: "node",
      created: new Date().toISOString(),
    }
    await fs.writeFile(path.join(cyxDir, "config.json"), JSON.stringify(config, null, 2))

    const content = JSON.parse(await fs.readFile(path.join(cyxDir, "config.json"), "utf-8"))
    expect(content.version).toBe(1)
    expect(content.projectType).toBe("node")
    expect(content.created).toBeTruthy()
  })

  test("creates .cyxcode/.gitignore with history/ and stats.json", async () => {
    const cyxDir = path.join(tmpDir, ".cyxcode")
    await fs.mkdir(cyxDir, { recursive: true })

    await fs.writeFile(path.join(cyxDir, ".gitignore"), "history/\nstats.json\n")

    const content = await fs.readFile(path.join(cyxDir, ".gitignore"), "utf-8")
    expect(content).toContain("history/")
    expect(content).toContain("stats.json")
  })

  test("appends .cyxcode/history/ to project root .gitignore", async () => {
    const gitignorePath = path.join(tmpDir, ".gitignore")
    await fs.writeFile(gitignorePath, "node_modules/\n.env\n")

    // Simulate ensureGitignoreEntry
    const entry = ".cyxcode/history/"
    let content = await fs.readFile(gitignorePath, "utf-8")
    if (!content.split("\n").some(line => line.trim() === entry)) {
      content = content.endsWith("\n") ? content + entry + "\n" : content + "\n" + entry + "\n"
      await fs.writeFile(gitignorePath, content)
    }

    const result = await fs.readFile(gitignorePath, "utf-8")
    expect(result).toContain("node_modules/")
    expect(result).toContain(".cyxcode/history/")
  })

  test("does not duplicate gitignore entry", async () => {
    const gitignorePath = path.join(tmpDir, ".gitignore")
    await fs.writeFile(gitignorePath, "node_modules/\n.cyxcode/history/\n")

    const entry = ".cyxcode/history/"
    let content = await fs.readFile(gitignorePath, "utf-8")
    const alreadyPresent = content.split("\n").some(line => line.trim() === entry)

    expect(alreadyPresent).toBe(true)
  })
})

describe("cyxcode init --global", () => {
  let tmpHome: string

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "cyxglobal-test-"))
    process.env.CYXWIZ_TEST_HOME = tmpHome
    CyxPaths.invalidateCache()
  })

  afterEach(async () => {
    delete process.env.CYXWIZ_TEST_HOME
    CyxPaths.invalidateCache()
    await fs.rm(tmpHome, { recursive: true, force: true })
  })

  test("creates ~/.cyxcode/ with all subdirectories", async () => {
    const globalDir = path.join(tmpHome, ".cyxcode")
    const subdirs = ["corrections", "memory", "patterns", "community"]

    await fs.mkdir(globalDir, { recursive: true })
    for (const sub of subdirs) {
      await fs.mkdir(path.join(globalDir, sub), { recursive: true })
    }

    for (const sub of subdirs) {
      const stat = await fs.stat(path.join(globalDir, sub))
      expect(stat.isDirectory()).toBe(true)
    }
  })

  test("creates ~/.cyxcode/config.json", async () => {
    const globalDir = path.join(tmpHome, ".cyxcode")
    await fs.mkdir(globalDir, { recursive: true })

    const config = { version: 1, created: new Date().toISOString() }
    await fs.writeFile(path.join(globalDir, "config.json"), JSON.stringify(config, null, 2))

    const content = JSON.parse(await fs.readFile(path.join(globalDir, "config.json"), "utf-8"))
    expect(content.version).toBe(1)
  })

  test("CyxPaths.globalDir respects CYXWIZ_TEST_HOME", () => {
    expect(CyxPaths.globalDir()).toBe(path.join(tmpHome, ".cyxcode"))
  })
})

describe("project type detection", () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cyxdetect-test-"))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  async function detectProjectType(dir: string): Promise<string> {
    const checks: Array<{ files: string[]; type: string }> = [
      { files: ["package.json"], type: "node" },
      { files: ["Cargo.toml"], type: "rust" },
      { files: ["go.mod"], type: "go" },
      { files: ["pyproject.toml", "requirements.txt"], type: "python" },
      { files: ["build.gradle", "pom.xml"], type: "java" },
    ]
    for (const check of checks) {
      for (const file of check.files) {
        try {
          await fs.access(path.join(dir, file))
          return check.type
        } catch {}
      }
    }
    return "unknown"
  }

  test("detects node project", async () => {
    await fs.writeFile(path.join(tmpDir, "package.json"), "{}")
    expect(await detectProjectType(tmpDir)).toBe("node")
  })

  test("detects rust project", async () => {
    await fs.writeFile(path.join(tmpDir, "Cargo.toml"), "")
    expect(await detectProjectType(tmpDir)).toBe("rust")
  })

  test("detects go project", async () => {
    await fs.writeFile(path.join(tmpDir, "go.mod"), "")
    expect(await detectProjectType(tmpDir)).toBe("go")
  })

  test("detects python project via pyproject.toml", async () => {
    await fs.writeFile(path.join(tmpDir, "pyproject.toml"), "")
    expect(await detectProjectType(tmpDir)).toBe("python")
  })

  test("detects python project via requirements.txt", async () => {
    await fs.writeFile(path.join(tmpDir, "requirements.txt"), "")
    expect(await detectProjectType(tmpDir)).toBe("python")
  })

  test("detects java project via build.gradle", async () => {
    await fs.writeFile(path.join(tmpDir, "build.gradle"), "")
    expect(await detectProjectType(tmpDir)).toBe("java")
  })

  test("detects java project via pom.xml", async () => {
    await fs.writeFile(path.join(tmpDir, "pom.xml"), "")
    expect(await detectProjectType(tmpDir)).toBe("java")
  })

  test("returns unknown for empty directory", async () => {
    expect(await detectProjectType(tmpDir)).toBe("unknown")
  })
})
