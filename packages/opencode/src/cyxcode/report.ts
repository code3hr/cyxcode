/**
 * @fileoverview CyxCode Report Module
 *
 * Generates token savings reports in multiple formats.
 * Built on existing report patterns from pentest/reports.
 *
 * @module cyxcode/report
 */

import { CyxAudit, type CyxAuditEntry } from "./audit"
import { Log } from "../util/log"

const log = Log.create({ service: "cyxcode.report" })

export namespace CyxReport {
  /**
   * Report time periods.
   */
  export type Period = "1h" | "1d" | "7d" | "30d" | "all"

  /**
   * Token report structure.
   */
  export type TokenReport = {
    period: {
      name: Period
      start: string
      end: string
    }
    tokens: {
      saved: number
      used: number
      savingsPercent: number
      costSaved: number // USD at $0.002/1K tokens
    }
    patterns: {
      matches: number
      misses: number
      hitRate: number
      learned: number
      top: Array<{ id: string; matches: number; tokensSaved: number }>
    }
    corrections: {
      added: number
      reinforced: number
      promoted: number
      driftEvents: number
      complianceRate: number
    }
    memory: {
      loaded: number
      totalChars: number
    }
    sessions: number
  }

  /**
   * Convert period to timestamp.
   */
  function periodToTimestamp(period: Period): number {
    const now = Date.now()
    switch (period) {
      case "1h":
        return now - 60 * 60 * 1000
      case "1d":
        return now - 24 * 60 * 60 * 1000
      case "7d":
        return now - 7 * 24 * 60 * 60 * 1000
      case "30d":
        return now - 30 * 24 * 60 * 60 * 1000
      case "all":
        return 0
    }
  }

  /**
   * Aggregate entries into a report.
   */
  function aggregate(entries: CyxAuditEntry[], period: Period): TokenReport {
    const now = Date.now()
    const since = periodToTimestamp(period)

    let tokensSaved = 0
    let tokensUsed = 0
    let patternMatches = 0
    let patternMisses = 0
    let patternsLearned = 0
    let correctionsAdded = 0
    let correctionsReinforced = 0
    let correctionsPromoted = 0
    let driftEvents = 0
    let memoryLoaded = 0
    let memoryChars = 0
    let sessions = 0

    // Track top patterns
    const patternStats = new Map<string, { matches: number; tokensSaved: number }>()

    for (const entry of entries) {
      switch (entry.type) {
        case "cyxcode.pattern.match":
          patternMatches++
          tokensSaved += entry.data.tokensSaved || 0
          // Track pattern stats
          const patternId = entry.data.patternId || "unknown"
          const stats = patternStats.get(patternId) || { matches: 0, tokensSaved: 0 }
          stats.matches++
          stats.tokensSaved += entry.data.tokensSaved || 0
          patternStats.set(patternId, stats)
          break
        case "cyxcode.pattern.miss":
          patternMisses++
          tokensUsed += entry.data.tokensUsed || 0
          break
        case "cyxcode.pattern.learned":
          patternsLearned++
          break
        case "cyxcode.correction.added":
          correctionsAdded++
          break
        case "cyxcode.correction.reinforced":
          correctionsReinforced++
          break
        case "cyxcode.correction.promoted":
          correctionsPromoted++
          break
        case "cyxcode.drift.detected":
          driftEvents++
          break
        case "cyxcode.memory.loaded":
          memoryLoaded++
          memoryChars += entry.data.chars || 0
          break
        case "cyxcode.session.start":
          sessions++
          break
      }
    }

    // Calculate metrics
    const totalPatternEvents = patternMatches + patternMisses
    const hitRate = totalPatternEvents > 0 ? patternMatches / totalPatternEvents : 0
    const totalTokens = tokensSaved + tokensUsed
    const savingsPercent = totalTokens > 0 ? (tokensSaved / totalTokens) * 100 : 0
    const costSaved = (tokensSaved / 1000) * 0.002 // $0.002 per 1K tokens

    // Calculate correction compliance rate
    const totalCorrectionEvents = correctionsAdded + correctionsReinforced + driftEvents
    const complianceRate =
      totalCorrectionEvents > 0
        ? (correctionsAdded + correctionsReinforced) / totalCorrectionEvents
        : 1

    // Get top patterns
    const topPatterns = Array.from(patternStats.entries())
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.tokensSaved - a.tokensSaved)
      .slice(0, 5)

    return {
      period: {
        name: period,
        start: new Date(since || now - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(now).toISOString(),
      },
      tokens: {
        saved: tokensSaved,
        used: tokensUsed,
        savingsPercent,
        costSaved,
      },
      patterns: {
        matches: patternMatches,
        misses: patternMisses,
        hitRate,
        learned: patternsLearned,
        top: topPatterns,
      },
      corrections: {
        added: correctionsAdded,
        reinforced: correctionsReinforced,
        promoted: correctionsPromoted,
        driftEvents,
        complianceRate,
      },
      memory: {
        loaded: memoryLoaded,
        totalChars: memoryChars,
      },
      sessions,
    }
  }

  /**
   * Generate a token report for a time period.
   *
   * @param period - Time period to report on
   * @returns Token report with aggregated metrics
   */
  export async function generate(period: Period = "7d"): Promise<TokenReport> {
    const since = periodToTimestamp(period)
    const entries = await CyxAudit.list({ since, limit: 50000 })
    log.info("Generating report", { period, entries: entries.length })
    return aggregate(entries, period)
  }

  /**
   * Format report as plain text for CLI.
   */
  export function formatText(report: TokenReport): string {
    const lines: string[] = []
    const { period, tokens, patterns, corrections, memory, sessions } = report

    lines.push(`CyxCode Token Report: ${period.name}`)
    lines.push(`Period: ${period.start.slice(0, 10)} to ${period.end.slice(0, 10)}`)
    lines.push("")
    lines.push("TOKEN SAVINGS")
    lines.push(`  Saved:      ${tokens.saved.toLocaleString()} tokens ($${tokens.costSaved.toFixed(2)})`)
    lines.push(`  Used:       ${tokens.used.toLocaleString()} tokens`)
    lines.push(`  Efficiency: ${tokens.savingsPercent.toFixed(1)}%`)
    lines.push("")
    lines.push("PATTERNS")
    lines.push(`  Matches:  ${patterns.matches}`)
    lines.push(`  Misses:   ${patterns.misses}`)
    lines.push(`  Hit Rate: ${(patterns.hitRate * 100).toFixed(1)}%`)
    lines.push(`  Learned:  ${patterns.learned}`)
    if (patterns.top.length > 0) {
      lines.push("  Top Patterns:")
      for (const p of patterns.top.slice(0, 3)) {
        lines.push(`    - ${p.id}: ${p.matches} matches, ${p.tokensSaved.toLocaleString()} tokens`)
      }
    }
    lines.push("")
    lines.push("CORRECTIONS")
    lines.push(`  Added:      ${corrections.added}`)
    lines.push(`  Reinforced: ${corrections.reinforced}`)
    lines.push(`  Promoted:   ${corrections.promoted}`)
    lines.push(`  Drift:      ${corrections.driftEvents}`)
    lines.push(`  Compliance: ${(corrections.complianceRate * 100).toFixed(0)}%`)
    lines.push("")
    lines.push("MEMORY")
    lines.push(`  Loaded:     ${memory.loaded} memories`)
    lines.push(`  Chars:      ${memory.totalChars.toLocaleString()}`)
    lines.push("")
    lines.push(`Sessions: ${sessions}`)

    return lines.join("\n")
  }

  /**
   * Format report as JSON.
   */
  export function formatJSON(report: TokenReport): string {
    return JSON.stringify(report, null, 2)
  }

  /**
   * Format report as Markdown.
   */
  export function formatMarkdown(report: TokenReport): string {
    const { period, tokens, patterns, corrections, memory, sessions } = report
    const lines: string[] = []

    lines.push(`# CyxCode Token Report`)
    lines.push("")
    lines.push(`**Period:** ${period.start.slice(0, 10)} to ${period.end.slice(0, 10)} (${period.name})`)
    lines.push("")
    lines.push("## Token Savings")
    lines.push("")
    lines.push("| Metric | Value |")
    lines.push("|--------|-------|")
    lines.push(`| Saved | ${tokens.saved.toLocaleString()} tokens |`)
    lines.push(`| Cost Saved | $${tokens.costSaved.toFixed(2)} |`)
    lines.push(`| Used | ${tokens.used.toLocaleString()} tokens |`)
    lines.push(`| Efficiency | ${tokens.savingsPercent.toFixed(1)}% |`)
    lines.push("")
    lines.push("## Patterns")
    lines.push("")
    lines.push("| Metric | Value |")
    lines.push("|--------|-------|")
    lines.push(`| Matches | ${patterns.matches} |`)
    lines.push(`| Misses | ${patterns.misses} |`)
    lines.push(`| Hit Rate | ${(patterns.hitRate * 100).toFixed(1)}% |`)
    lines.push(`| Learned | ${patterns.learned} |`)
    lines.push("")
    if (patterns.top.length > 0) {
      lines.push("### Top Patterns")
      lines.push("")
      lines.push("| Pattern | Matches | Tokens Saved |")
      lines.push("|---------|---------|--------------|")
      for (const p of patterns.top) {
        lines.push(`| ${p.id} | ${p.matches} | ${p.tokensSaved.toLocaleString()} |`)
      }
      lines.push("")
    }
    lines.push("## Corrections")
    lines.push("")
    lines.push("| Metric | Value |")
    lines.push("|--------|-------|")
    lines.push(`| Added | ${corrections.added} |`)
    lines.push(`| Reinforced | ${corrections.reinforced} |`)
    lines.push(`| Promoted | ${corrections.promoted} |`)
    lines.push(`| Drift Events | ${corrections.driftEvents} |`)
    lines.push(`| Compliance | ${(corrections.complianceRate * 100).toFixed(0)}% |`)
    lines.push("")
    lines.push("## Memory")
    lines.push("")
    lines.push("| Metric | Value |")
    lines.push("|--------|-------|")
    lines.push(`| Loaded | ${memory.loaded} |`)
    lines.push(`| Characters | ${memory.totalChars.toLocaleString()} |`)
    lines.push("")
    lines.push(`**Sessions:** ${sessions}`)
    lines.push("")
    lines.push("---")
    lines.push("*Generated by CyxCode Audit System*")

    return lines.join("\n")
  }

  /**
   * Format report as a box for TUI display.
   */
  export function formatBox(report: TokenReport): string {
    const { period, tokens, patterns, corrections } = report
    const width = 61
    const lines: string[] = []

    const pad = (s: string, w: number) => s.padEnd(w)
    const center = (s: string, w: number) => {
      const padding = Math.max(0, w - s.length)
      const left = Math.floor(padding / 2)
      return " ".repeat(left) + s + " ".repeat(padding - left)
    }

    const periodStr = `${period.start.slice(5, 10)} to ${period.end.slice(5, 10)}`

    lines.push("+" + "-".repeat(width) + "+")
    lines.push("|" + center(`CyxCode Token Report: ${periodStr}`, width) + "|")
    lines.push("+" + "-".repeat(width) + "+")
    lines.push("|" + " ".repeat(width) + "|")
    lines.push("|  TOKEN SAVINGS" + " ".repeat(width - 16) + "|")
    lines.push(`|  +-- Saved:     ${tokens.saved.toLocaleString().padStart(10)} tokens ($${tokens.costSaved.toFixed(2)})`.padEnd(width + 1) + "|")
    lines.push(`|  +-- Used:      ${tokens.used.toLocaleString().padStart(10)} tokens`.padEnd(width + 1) + "|")
    lines.push(`|  +-- Efficiency: ${tokens.savingsPercent.toFixed(1)}%`.padEnd(width + 1) + "|")
    lines.push("|" + " ".repeat(width) + "|")
    lines.push("|  PATTERNS" + " ".repeat(20) + "CORRECTIONS" + " ".repeat(19) + "|")
    lines.push(`|  +-- Matches: ${patterns.matches.toString().padStart(4)}          +-- Added:    ${corrections.added.toString().padStart(4)}`.padEnd(width + 1) + "|")
    lines.push(`|  +-- Misses:  ${patterns.misses.toString().padStart(4)}          +-- Promoted: ${corrections.promoted.toString().padStart(4)}`.padEnd(width + 1) + "|")
    lines.push(`|  +-- Hit Rate: ${(patterns.hitRate * 100).toFixed(1)}%        +-- Drift:    ${corrections.driftEvents.toString().padStart(4)}`.padEnd(width + 1) + "|")
    lines.push(`|  +-- Learned: ${patterns.learned.toString().padStart(4)}          +-- Compliance: ${(corrections.complianceRate * 100).toFixed(0)}%`.padEnd(width + 1) + "|")
    lines.push("|" + " ".repeat(width) + "|")
    if (patterns.top.length > 0) {
      lines.push("|  TOP PATTERNS" + " ".repeat(width - 14) + "|")
      for (let i = 0; i < Math.min(3, patterns.top.length); i++) {
        const p = patterns.top[i]
        const line = `|  ${i + 1}. ${p.id.padEnd(20)} ${p.matches.toString().padStart(4)} matches  ${p.tokensSaved.toLocaleString().padStart(8)} tokens`
        lines.push(line.padEnd(width + 1) + "|")
      }
      lines.push("|" + " ".repeat(width) + "|")
    }
    lines.push("+" + "-".repeat(width) + "+")

    return lines.join("\n")
  }
}
