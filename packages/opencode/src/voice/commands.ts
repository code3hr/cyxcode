/**
 * @fileoverview Voice Command Parser
 *
 * Parses transcribed text into executable commands.
 */

import { VoiceTypes } from "./types"
import { Log } from "../util/log"

const log = Log.create({ name: "voice-commands" })

export namespace VoiceCommands {
  /** Default command aliases for voice shortcuts */
  const DEFAULT_ALIASES: VoiceTypes.CommandAlias[] = [
    // Scanning commands
    {
      phrases: ["scan network", "network scan", "scan the network"],
      command: "netscan scan",
      description: "Run network scan",
    },
    {
      phrases: ["scan ports", "port scan", "scan for ports"],
      command: "netscan ports",
      description: "Run port scan",
    },
    {
      phrases: ["scan api", "api scan", "scan the api"],
      command: "apiscan scan",
      description: "Run API scan",
    },
    {
      phrases: ["scan web", "web scan", "scan website"],
      command: "webscan scan",
      description: "Run web scan",
    },
    {
      phrases: ["scan container", "container scan", "scan containers"],
      command: "containerscan scan",
      description: "Run container scan",
    },
    {
      phrases: ["scan mobile", "mobile scan", "scan app"],
      command: "mobilescan scan",
      description: "Run mobile scan",
    },
    {
      phrases: ["scan cloud", "cloud scan", "scan cloud resources"],
      command: "cloudscan scan",
      description: "Run cloud scan",
    },
    {
      phrases: ["scan cicd", "ci cd scan", "pipeline scan"],
      command: "cicd scan",
      description: "Run CI/CD scan",
    },

    // Discovery commands
    {
      phrases: ["discover services", "find services", "service discovery"],
      command: "netscan discover",
      description: "Discover network services",
    },
    {
      phrases: ["discover hosts", "find hosts", "host discovery"],
      command: "netscan hosts",
      description: "Discover hosts",
    },

    // Credential commands
    {
      phrases: ["test credentials", "credential test", "test passwords"],
      command: "credscan test",
      description: "Test credentials",
    },
    {
      phrases: ["spray passwords", "password spray"],
      command: "credscan spray",
      description: "Password spray attack",
    },

    // Active Directory
    {
      phrases: ["scan active directory", "ad scan", "scan a d"],
      command: "adscan scan",
      description: "Scan Active Directory",
    },
    {
      phrases: ["enumerate domain", "domain enumeration"],
      command: "adscan enumerate",
      description: "Enumerate AD domain",
    },

    // Report commands
    {
      phrases: ["generate report", "create report", "make report"],
      command: "report generate",
      description: "Generate security report",
    },
    {
      phrases: ["show findings", "list findings", "display findings"],
      command: "report findings",
      description: "Show scan findings",
    },

    // Control commands
    {
      phrases: ["stop scan", "stop scanning", "cancel scan"],
      command: "scan stop",
      description: "Stop current scan",
    },
    {
      phrases: ["show status", "scan status", "check status"],
      command: "status",
      description: "Show scan status",
    },
    {
      phrases: ["show help", "help me", "what can you do"],
      command: "help",
      description: "Show help",
    },
    {
      phrases: ["clear screen", "clear console", "clear"],
      command: "clear",
      description: "Clear screen",
    },
    {
      phrases: ["exit", "quit", "goodbye", "bye"],
      command: "exit",
      description: "Exit application",
    },
  ]

  let customAliases: VoiceTypes.CommandAlias[] = []

  /**
   * Parse transcribed text into a command
   */
  export function parse(
    text: string,
    aliases: VoiceTypes.CommandAlias[] = []
  ): VoiceTypes.VoiceCommand | null {
    const normalizedText = text.toLowerCase().trim()
    const allAliases = [...DEFAULT_ALIASES, ...customAliases, ...aliases]

    log.debug("Parsing voice command", { text: normalizedText })

    // Try exact phrase match first
    for (const alias of allAliases) {
      for (const phrase of alias.phrases) {
        if (normalizedText === phrase.toLowerCase()) {
          return {
            raw: text,
            command: alias.command,
            args: {},
            confidence: 1.0,
            timestamp: Date.now(),
          }
        }
      }
    }

    // Try fuzzy match
    for (const alias of allAliases) {
      for (const phrase of alias.phrases) {
        const similarity = calculateSimilarity(normalizedText, phrase.toLowerCase())
        if (similarity > 0.8) {
          return {
            raw: text,
            command: alias.command,
            args: {},
            confidence: similarity,
            timestamp: Date.now(),
          }
        }
      }
    }

    // Try to extract command and target from natural language
    const extracted = extractCommandFromNaturalLanguage(normalizedText)
    if (extracted) {
      return extracted
    }

    // Return raw text as command if no alias matched
    return {
      raw: text,
      command: normalizedText,
      args: {},
      confidence: 0.5,
      timestamp: Date.now(),
    }
  }

  /**
   * Extract command from natural language
   */
  function extractCommandFromNaturalLanguage(text: string): VoiceTypes.VoiceCommand | null {
    // Pattern: "scan [target] for [type]"
    const scanMatch = text.match(/scan\s+(.+?)\s+(?:for|with)\s+(.+)/i)
    if (scanMatch) {
      const target = scanMatch[1]
      const type = scanMatch[2]
      return {
        raw: text,
        command: `scan --target "${target}" --type "${type}"`,
        args: { target, type },
        confidence: 0.7,
        timestamp: Date.now(),
      }
    }

    // Pattern: "scan [target]"
    const simpleMatch = text.match(/scan\s+(.+)/i)
    if (simpleMatch) {
      const target = simpleMatch[1]
      return {
        raw: text,
        command: `scan --target "${target}"`,
        args: { target },
        confidence: 0.6,
        timestamp: Date.now(),
      }
    }

    // Pattern: "check [target] for [vulnerability]"
    const checkMatch = text.match(/check\s+(.+?)\s+for\s+(.+)/i)
    if (checkMatch) {
      const target = checkMatch[1]
      const vulnerability = checkMatch[2]
      return {
        raw: text,
        command: `check --target "${target}" --vuln "${vulnerability}"`,
        args: { target, vulnerability },
        confidence: 0.7,
        timestamp: Date.now(),
      }
    }

    return null
  }

  /**
   * Calculate similarity between two strings (Levenshtein-based)
   */
  function calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1
    if (a.length === 0 || b.length === 0) return 0

    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    const maxLen = Math.max(a.length, b.length)
    return 1 - matrix[b.length][a.length] / maxLen
  }

  /**
   * Add custom command aliases
   */
  export function addAlias(alias: VoiceTypes.CommandAlias): void {
    customAliases.push(alias)
  }

  /**
   * Add multiple custom aliases
   */
  export function addAliases(aliases: VoiceTypes.CommandAlias[]): void {
    customAliases.push(...aliases)
  }

  /**
   * Clear custom aliases
   */
  export function clearCustomAliases(): void {
    customAliases = []
  }

  /**
   * Get all available aliases
   */
  export function getAliases(): VoiceTypes.CommandAlias[] {
    return [...DEFAULT_ALIASES, ...customAliases]
  }

  /**
   * Get help text for voice commands
   */
  export function getHelp(): string {
    const lines = ["Available voice commands:", ""]

    const categories: Record<string, VoiceTypes.CommandAlias[]> = {}
    for (const alias of DEFAULT_ALIASES) {
      const category = alias.command.split(" ")[0]
      if (!categories[category]) {
        categories[category] = []
      }
      categories[category].push(alias)
    }

    for (const [category, aliases] of Object.entries(categories)) {
      lines.push(`## ${category.toUpperCase()}`)
      for (const alias of aliases) {
        lines.push(`  "${alias.phrases[0]}" → ${alias.command}`)
      }
      lines.push("")
    }

    return lines.join("\n")
  }
}
