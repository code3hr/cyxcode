/**
 * CyxCode State Versioning — Resume
 *
 * Load HEAD commit into system prompt on session start.
 * AI picks up where it left off.
 */

import { Log } from "@/util/log"
import { Commits } from "./commit"
import { Corrections } from "./corrections"

const log = Log.create({ service: "cyxcode-versioning-resume" })

const MAX_RESUME_CHARS = 800 // ~200 tokens

export namespace Resume {
  /**
   * Format HEAD commit + corrections for system prompt injection.
   * Returns string array for system prompt (empty if no HEAD).
   */
  export async function forSystemPrompt(): Promise<string[]> {
    const parts: string[] = []

    // Load corrections (high priority)
    const corrections = await Corrections.forSystemPrompt()
    parts.push(...corrections)

    // Load resume context from HEAD
    const commit = await Commits.latest()
    if (commit) {
      const lines: string[] = []

      if (commit.state.goal) {
        lines.push(`Previous session goal: ${commit.state.goal}`)
      }
      if (commit.state.inProgress) {
        lines.push(`In progress: ${commit.state.inProgress}`)
      }
      if (commit.state.workingFiles.length > 0) {
        lines.push(`Active files: ${commit.state.workingFiles.slice(0, 10).join(", ")}`)
      }
      if (commit.state.completed.length > 0) {
        lines.push(`Completed: ${commit.state.completed.join(", ")}`)
      }
      if (commit.state.discoveries.length > 0) {
        lines.push(`Discoveries: ${commit.state.discoveries.slice(0, 5).join("; ")}`)
      }

      if (lines.length > 0) {
        // Enforce budget — truncate by dropping lines from bottom, not mid-line
        let content = ""
        for (const line of lines) {
          if (content.length + line.length + 1 > MAX_RESUME_CHARS) break
          content += (content ? "\n" : "") + line
        }

        parts.push(`<cyxcode-resume>\nContext from previous session (${commit.session.slug}):\n${content}\n</cyxcode-resume>`)

        log.debug("Resume loaded", {
          session: commit.session.slug,
          corrections: corrections.length > 0,
          files: commit.state.workingFiles.length,
        })
      }
    }

    return parts
  }
}
