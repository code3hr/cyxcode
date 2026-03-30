/**
 * cyxcode init — Initialize .cyxcode/ directory for AI state tracking
 *
 * Like `git init` but for AI state.
 */

import type { Argv } from "yargs"
import fs from "fs/promises"
import path from "path"
import { cmd } from "./cmd"
import { CyxPaths } from "../../cyxcode/paths"

export const InitCommand = cmd({
  command: "init",
  describe: "initialize .cyxcode/ directory for AI state tracking",
  builder: (yargs: Argv) => {
    return yargs
      .option("global", {
        type: "boolean",
        describe: "initialize global ~/.cyxcode/ directory",
        default: false,
      })
      .option("migrate", {
        type: "boolean",
        describe: "migrate existing .opencode/ data to .cyxcode/",
        default: true,
      })
  },
  handler: async (args) => {
    if (args.global) {
      await initGlobal()
    } else {
      await initProject(process.cwd(), args.migrate)
    }
  },
})

// --- Project type detection ---

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

// --- Directory creation helper ---

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

// --- Gitignore management ---

async function ensureGitignoreEntry(gitignorePath: string, entry: string): Promise<boolean> {
  let content = ""
  try {
    content = await fs.readFile(gitignorePath, "utf-8")
  } catch {}

  if (content.split("\n").some(line => line.trim() === entry)) {
    return false // already present
  }

  const newContent = content.endsWith("\n") || content === ""
    ? content + entry + "\n"
    : content + "\n" + entry + "\n"
  await fs.writeFile(gitignorePath, newContent)
  return true
}

// --- Project init ---

async function initProject(dir: string, migrate: boolean): Promise<void> {
  const cyxDir = path.join(dir, ".cyxcode")

  // Check if already initialized
  try {
    await fs.access(cyxDir)
    console.log("\n  .cyxcode/ already exists. Already initialized.\n")
    return
  } catch {}

  console.log("\nInitializing CyxCode...\n")

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

  // Write .cyxcode/.gitignore (keep history/ and stats.json private)
  await fs.writeFile(
    path.join(cyxDir, ".gitignore"),
    ["history/", "stats.json", ""].join("\n"),
  )

  // Add .cyxcode/history/ to project root .gitignore
  const rootGitignore = path.join(dir, ".gitignore")
  await ensureGitignoreEntry(rootGitignore, ".cyxcode/history/")

  // Copy global corrections if they exist
  await copyGlobalCorrections(cyxDir)

  // Print what we created
  console.log("  Created .cyxcode/")
  console.log("  Created .cyxcode/config.json")
  for (const sub of created) {
    console.log(`  Created .cyxcode/${sub}/`)
  }
  console.log("  Added .cyxcode/history/ to .gitignore")

  // Migration
  if (migrate) {
    const { CyxMigration } = await import("../../cyxcode/migration")
    if (await CyxMigration.needsMigration(dir)) {
      console.log("")
      const report = await CyxMigration.migrate(dir)
      if (report.totalFiles > 0) {
        console.log(`  Migrated ${report.totalFiles} files from .opencode/`)
        if (report.patterns > 0) console.log(`    patterns: ${report.patterns}`)
        if (report.memories > 0) console.log(`    memories: ${report.memories}`)
        if (report.history > 0) console.log(`    history: ${report.history}`)
        if (report.stats > 0) console.log(`    stats: ${report.stats}`)
        if (report.commands > 0) console.log(`    commands: ${report.commands}`)
        if (report.agents > 0) console.log(`    agents: ${report.agents}`)
      }
    }
  }

  // Invalidate path cache so future calls use .cyxcode/
  CyxPaths.invalidateCache()

  // Download bundled commands from GitHub
  const { CommandsDownload } = await import("../../cyxcode/commands-download")
  await CommandsDownload.ensureCommands()

  // Print project type and tips
  if (projectType !== "unknown") {
    console.log(`\n  Detected project type: ${projectType}`)
  }

  console.log("\nCyxCode initialized. Ready to track AI state.\n")
  console.log("Tips:")
  console.log("  /correct \"rule\"     \u2014 Save a behavioral correction")
  console.log("  /remember \"info\"    \u2014 Save a project memory")
  console.log("  /dream              \u2014 Consolidate memories and patterns")
  console.log("  /resume             \u2014 Load previous session context")
  console.log("")
}

// --- Global init ---

async function initGlobal(): Promise<void> {
  const globalDir = CyxPaths.globalDir()

  console.log("\nInitializing global CyxCode...\n")

  const subdirs = [
    "corrections",
    "memory",
    "patterns",
    "community",
  ]

  await fs.mkdir(globalDir, { recursive: true })
  const created = await ensureDirs(globalDir, subdirs)

  // Write config.json if missing
  const configPath = CyxPaths.globalConfigPath()
  try {
    await fs.access(configPath)
  } catch {
    const config = {
      version: 1,
      created: new Date().toISOString(),
    }
    await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n")
  }

  console.log(`  Created ${globalDir}/`)
  for (const sub of created) {
    console.log(`  Created ${sub}/`)
  }
  console.log(`  Created config.json`)

  console.log(`\nGlobal CyxCode initialized at ${globalDir}\n`)
  console.log("Tips:")
  console.log("  /correct --global \"rule\"   \u2014 Save a global correction")
  console.log("  /remember --global \"info\"  \u2014 Save a global memory")
  console.log("")
}

// --- Copy global corrections ---

async function copyGlobalCorrections(cyxDir: string): Promise<number> {
  const globalCorr = CyxPaths.globalCorrectionsDir()
  let copied = 0

  try {
    const files = await fs.readdir(globalCorr)
    const destDir = path.join(cyxDir, "history", "corrections")

    for (const file of files) {
      if (!file.endsWith(".json")) continue
      try {
        await fs.copyFile(
          path.join(globalCorr, file),
          path.join(destDir, file),
        )
        copied++
      } catch {}
    }
  } catch {}

  if (copied > 0) {
    console.log(`  Copied ${copied} global correction(s)`)
  }

  return copied
}
