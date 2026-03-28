/**
 * CyxCode Prompt Utilities
 *
 * Simple Y/n confirmation prompts for fix execution.
 */

import * as readline from "readline"
import { Log } from "@/util/log"

const log = Log.create({ service: "cyxcode-prompt" })

export namespace CyxPrompt {
  /**
   * Check if running in interactive mode (TTY).
   * Returns false for headless/server/CI environments.
   */
  export function isInteractive(): boolean {
    return Boolean(
      process.stdin.isTTY &&
      process.stdout.isTTY &&
      !process.env.CI &&
      !process.env.CYXCODE_HEADLESS
    )
  }

  /**
   * Prompt user for Y/n confirmation.
   *
   * @param message - The prompt message to display
   * @returns true if user confirms (Y/y/Enter), false otherwise
   */
  export async function confirm(message: string): Promise<boolean> {
    // Non-interactive mode: don't prompt, return false
    if (!isInteractive()) {
      log.debug("Non-interactive mode, skipping prompt")
      return false
    }

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      // Handle Ctrl+C gracefully
      rl.on("SIGINT", () => {
        rl.close()
        resolve(false)
      })

      rl.question(message, (answer) => {
        rl.close()

        const normalized = answer.trim().toLowerCase()

        // Y, y, or Enter = approve
        // N, n, or anything else = reject
        if (normalized === "" || normalized === "y" || normalized === "yes") {
          resolve(true)
        } else {
          resolve(false)
        }
      })
    })
  }

  /**
   * Get the auto-fix mode from environment.
   *
   * @returns "prompt" | "always" | "never"
   */
  export function getAutoFixMode(): "prompt" | "always" | "never" {
    const mode = process.env.CYXCODE_AUTO_FIX?.toLowerCase()

    if (mode === "always") return "always"
    if (mode === "never") return "never"

    return "prompt" // default
  }

  /**
   * Determine if fix should be executed based on mode and user input.
   *
   * @param fixCommand - The command that would be executed
   * @returns true if fix should execute, false otherwise
   */
  export async function shouldExecuteFix(fixCommand: string): Promise<boolean> {
    const mode = getAutoFixMode()

    if (mode === "never") {
      log.debug("Auto-fix disabled, skipping execution")
      return false
    }

    if (mode === "always") {
      log.debug("Auto-fix enabled, executing without prompt")
      return true
    }

    // mode === "prompt"
    return confirm(`[CyxCode] Execute fix: ${fixCommand}? [Y/n]: `)
  }
}
