/**
 * CyxCode Init for TUI
 *
 * Simplified init logic callable from within the TUI.
 * Creates .cyxcode/ directory structure without CLI output.
 */

import fs from "fs/promises"
import path from "path"
import { CyxPaths } from "./paths"

type InitResult = {
  success: boolean
  message: string
  created?: string[]
}

type ProjectType = "node" | "rust" | "go" | "python" | "java" | "unknown"

async function detectProjectType(dir: string): Promise<ProjectType> {
  const checks: Array<{ files: string[]; type: ProjectType }> = [
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

async function ensureDirs(base: string, dirs: string[]): Promise<string[]> {
  const created: string[] = []
  for (const dir of dirs) {
    const full = path.join(base, dir)
    try {
      await fs.access(full)
    } catch {
      await fs.mkdir(full, { recursive: true })
      created.push(dir)
    }
  }
  return created
}

async function ensureGitignoreEntry(gitignorePath: string, entry: string): Promise<boolean> {
  let content = ""
  try {
    content = await fs.readFile(gitignorePath, "utf-8")
  } catch {}

  if (content.split("\n").some(line => line.trim() === entry)) {
    return false
  }

  const newContent = content.endsWith("\n") || content === ""
    ? content + entry + "\n"
    : content + "\n" + entry + "\n"
  await fs.writeFile(gitignorePath, newContent)
  return true
}

/**
 * Initialize .cyxcode/ in the current project directory.
 * Called from the TUI /init command.
 */
export async function initProjectFromTUI(): Promise<InitResult> {
  const dir = process.cwd()
  const cyxDir = path.join(dir, ".cyxcode")

  // Check if already initialized
  try {
    await fs.access(cyxDir)
    return {
      success: false,
      message: ".cyxcode/ already exists",
    }
  } catch {}

  try {
    // Create directory structure
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
    const created = await ensureDirs(cyxDir, subdirs)

    // Detect project type
    const projectType = await detectProjectType(dir)

    // Write config.json
    const config = {
      version: 1,
      projectType,
      created: new Date().toISOString(),
    }
    await fs.writeFile(path.join(cyxDir, "config.json"), JSON.stringify(config, null, 2) + "\n")

    // Write .cyxcode/.gitignore
    await fs.writeFile(
      path.join(cyxDir, ".gitignore"),
      ["history/", "stats.json", ""].join("\n"),
    )

    // Add to project .gitignore
    const rootGitignore = path.join(dir, ".gitignore")
    await ensureGitignoreEntry(rootGitignore, ".cyxcode/history/")

    // Invalidate path cache
    CyxPaths.invalidateCache()

    // Run migration if needed
    let migrated = 0
    try {
      const { CyxMigration } = await import("./migration")
      if (await CyxMigration.needsMigration(dir)) {
        const report = await CyxMigration.migrate(dir)
        migrated = report.totalFiles
      }
    } catch {}

    const message = migrated > 0
      ? `Initialized .cyxcode/ (migrated ${migrated} files from .opencode/)`
      : `Initialized .cyxcode/ (${projectType} project)`

    return {
      success: true,
      message,
      created: [".cyxcode/", ...created.map(d => `.cyxcode/${d}/`)],
    }
  } catch (err) {
    return {
      success: false,
      message: `Init failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
