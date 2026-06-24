/**
 * CyxCode State Versioning - Resume
 *
 * Load HEAD commit into system prompt on session start.
 * AI picks up where it left off.
 */

import { Log } from "@/util/log"
import { Commits } from "./commit"
import { Corrections } from "./corrections"
import type { Commit } from "./types"

const log = Log.create({ service: "cyxcode-versioning-resume" })

const MAX_RESUME_CHARS = 800

function format(commit: Commit): string | null {
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

  if (lines.length === 0) return null

  let content = ""
  for (const line of lines) {
    if (content.length + line.length + 1 > MAX_RESUME_CHARS) break
    content += (content ? "\n" : "") + line
  }

  return `Context from previous session (${commit.session.slug}):\n${content}`
}

export namespace Resume {
  export function summary(commit: Commit): string | null {
    return format(commit)
  }

  export async function latestSummary(): Promise<string | null> {
    const commit = await Commits.latest()
    if (!commit) return null
    return format(commit)
  }

  /**
   * Format HEAD commit + corrections for system prompt injection.
   * Returns string array for system prompt (empty if no HEAD).
   */
  export async function forSystemPrompt(): Promise<string[]> {
    const parts: string[] = []

    const corrections = await Corrections.forSystemPrompt()
    parts.push(...corrections)

    const commit = await Commits.latest()
    if (commit) {
      const text = format(commit)
      if (text) {
        parts.push(`<cyxcode-resume>\n${text}\n</cyxcode-resume>`)

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
