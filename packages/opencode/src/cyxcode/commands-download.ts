/**
 * CyxCode Command Bundle
 *
 * Copies bundled slash command .md files to project .cyxcode/command/
 * Commands are embedded in the package - no network required.
 */

import fs from "fs/promises"
import path from "path"
import { Log } from "@/util/log"
import { CyxPaths } from "./paths"

const log = Log.create({ service: "cyxcode-commands" })

// Path to embedded commands (relative to this file)
const EMBEDDED_DIR = path.join(import.meta.dir, "commands")

// List of bundled commands to copy
const BUNDLED_COMMANDS = [
  "dream.md",
  "correct.md",
  "remember.md",
  "learn-patterns.md",
  "learn.md",
  "diagnose.md",
  "commit.md",
]

export namespace CommandsDownload {
  /**
   * Check if commands need to be copied
   */
  export async function needsDownload(): Promise<boolean> {
    const commandDir = CyxPaths.commandDir()

    try {
      const files = await fs.readdir(commandDir)
      const mdFiles = files.filter(f => f.endsWith(".md"))
      // If we have less than half the bundled commands, copy them
      return mdFiles.length < BUNDLED_COMMANDS.length / 2
    } catch {
      return true
    }
  }

  /**
   * Copy all bundled commands from embedded package files
   */
  export async function downloadAll(): Promise<{
    downloaded: number
    failed: string[]
  }> {
    const commandDir = CyxPaths.commandDir()

    // Ensure directory exists
    await fs.mkdir(commandDir, { recursive: true })

    let downloaded = 0
    const failed: string[] = []

    for (const filename of BUNDLED_COMMANDS) {
      try {
        const srcPath = path.join(EMBEDDED_DIR, filename)
        const destPath = path.join(commandDir, filename)

        // Don't overwrite existing commands (user may have customized)
        try {
          await fs.access(destPath)
          log.debug("Command already exists, skipping", { filename })
          continue
        } catch {}

        // Copy from embedded file
        await fs.copyFile(srcPath, destPath)
        downloaded++
        log.debug("Copied command", { filename })
      } catch (err) {
        log.warn("Error copying command", { filename, error: err })
        failed.push(filename)
      }
    }

    return { downloaded, failed }
  }

  /**
   * Copy commands if needed, with user feedback
   */
  export async function ensureCommands(silent = false): Promise<boolean> {
    if (!(await needsDownload())) {
      return true
    }

    if (!silent) {
      console.log("  Copying CyxCode commands...")
    }

    const result = await downloadAll()

    if (result.downloaded > 0 && !silent) {
      console.log(`  Copied ${result.downloaded} command(s)`)
    }

    if (result.failed.length > 0 && !silent) {
      console.log(`  Failed to copy: ${result.failed.join(", ")}`)
    }

    return result.failed.length === 0
  }
}
