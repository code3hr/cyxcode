/**
 * CyxCode Command Downloader
 *
 * Downloads slash command .md files from GitHub on first use.
 * Stores them in .cyxcode/command/ or .opencode/command/
 */

import fs from "fs/promises"
import path from "path"
import { Log } from "@/util/log"
import { CyxPaths } from "./paths"

const log = Log.create({ service: "cyxcode-commands" })

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/code3hr/cyxcode/dev/.opencode/command"

// List of bundled commands to download
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
   * Check if commands need to be downloaded
   */
  export async function needsDownload(): Promise<boolean> {
    const commandDir = CyxPaths.commandDir()

    try {
      const files = await fs.readdir(commandDir)
      const mdFiles = files.filter(f => f.endsWith(".md"))
      // If we have less than half the bundled commands, download
      return mdFiles.length < BUNDLED_COMMANDS.length / 2
    } catch {
      return true
    }
  }

  /**
   * Download all bundled commands from GitHub
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
        const url = `${GITHUB_RAW_BASE}/${filename}`
        const response = await fetch(url, {
          headers: {
            "User-Agent": "cyxcode-cli",
          },
        })

        if (!response.ok) {
          log.warn("Failed to download command", { filename, status: response.status })
          failed.push(filename)
          continue
        }

        const content = await response.text()
        const destPath = path.join(commandDir, filename)

        // Don't overwrite existing commands (user may have customized)
        try {
          await fs.access(destPath)
          log.debug("Command already exists, skipping", { filename })
          continue
        } catch {}

        await fs.writeFile(destPath, content)
        downloaded++
        log.debug("Downloaded command", { filename })
      } catch (err) {
        log.warn("Error downloading command", { filename, error: err })
        failed.push(filename)
      }
    }

    return { downloaded, failed }
  }

  /**
   * Download commands if needed, with user feedback
   */
  export async function ensureCommands(silent = false): Promise<boolean> {
    if (!(await needsDownload())) {
      return true
    }

    if (!silent) {
      console.log("  Downloading CyxCode commands from GitHub...")
    }

    const result = await downloadAll()

    if (result.downloaded > 0 && !silent) {
      console.log(`  Downloaded ${result.downloaded} command(s)`)
    }

    if (result.failed.length > 0 && !silent) {
      console.log(`  Failed to download: ${result.failed.join(", ")}`)
    }

    return result.failed.length === 0
  }
}
