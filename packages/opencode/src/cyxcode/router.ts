/**
 * Skill Router - Routes errors to matching pattern skills
 *
 * This is the core of CyxCode's pattern-first approach:
 * 1. Error occurs
 * 2. Router checks all skills for pattern match
 * 3. If match found -> execute fix (FREE, no LLM tokens)
 * 4. If no match -> fall through to LLM (costs tokens)
 */

import type { PatternSkill, PatternMatch, SkillContext, SkillResult, SkillRegistry } from "./types"
import { Log } from "../util/log"

const log = Log.create({ service: "cyxcode-router" })

class SkillRouterImpl implements SkillRegistry {
  private skills: Map<string, PatternSkill> = new Map()

  // Stats tracking
  private matchCount = 0
  private missCount = 0
  private tokensSaved = 0

  /**
   * Register a skill
   */
  register(skill: PatternSkill): void {
    if (this.skills.has(skill.name)) {
      log.warn("Overwriting existing skill", { name: skill.name })
    }
    this.skills.set(skill.name, skill)
    log.debug("Registered skill", {
      name: skill.name,
      patterns: skill.patterns.length,
    })
  }

  /**
   * Get all registered skills
   */
  all(): PatternSkill[] {
    return Array.from(this.skills.values())
  }

  /**
   * Get a skill by name
   */
  get(name: string): PatternSkill | undefined {
    return this.skills.get(name)
  }

  /**
   * Find all skills that match an error
   */
  findMatching(error: string): Array<{ skill: PatternSkill; match: PatternMatch }> {
    const matches: Array<{ skill: PatternSkill; match: PatternMatch }> = []

    for (const skill of this.skills.values()) {
      const match = skill.match(error)
      if (match) {
        matches.push({ skill, match })
      }
    }

    return matches
  }

  /**
   * Route an error to the best matching skill and execute fix
   */
  async route(ctx: SkillContext): Promise<SkillResult | null> {
    const matches = this.findMatching(ctx.errorOutput)

    if (matches.length === 0) {
      this.missCount++
      log.debug("No pattern match", {
        errorLength: ctx.errorOutput.length,
        totalPatterns: this.totalPatterns(),
      })
      return null // Fall through to LLM
    }

    this.matchCount++

    // Use first match (could rank by confidence later)
    const { skill, match } = matches[0]

    log.info("Pattern matched", {
      skill: skill.name,
      pattern: match.pattern.id,
      category: match.pattern.category,
      captures: match.captures,
    })

    const result = await skill.execute(ctx, match)

    if (result.success && result.tokensSaved) {
      this.tokensSaved += result.tokensSaved
    }

    return result
  }

  /**
   * Record a pattern match (for stats tracking from bash tool)
   */
  recordMatch(skillName: string): void {
    this.matchCount++
    log.debug("Recorded match", { skill: skillName, total: this.matchCount })
  }

  /**
   * Record a pattern miss (for stats tracking and learning from bash tool)
   */
  recordMiss(messageID?: string, errorOutput?: string, failedCommand?: string, exitCode?: number): void {
    this.missCount++
    if (messageID && errorOutput) {
      // Use globalThis buffer directly to avoid module instance issues
      const g = globalThis as any
      if (!g.__cyxcode_capture_buffer) g.__cyxcode_capture_buffer = new Map()
      if (!g.__cyxcode_capture_order) g.__cyxcode_capture_order = []
      const buf: Map<string, any[]> = g.__cyxcode_capture_buffer
      const order: string[] = g.__cyxcode_capture_order
      if (!buf.has(messageID)) {
        order.push(messageID)
        while (order.length > 50) { buf.delete(order.shift()!) }
      }
      const entries = buf.get(messageID) || []
      entries.push({ errorOutput: errorOutput.slice(0, 2000), failedCommand: failedCommand ?? "", exitCode: exitCode ?? 1 })
      buf.set(messageID, entries)
      log.debug("Captured miss for learning", { messageID, bufferSize: buf.size })
    }
    log.debug("Recorded miss", { total: this.missCount })
  }

  /**
   * Get statistics
   */
  stats(): {
    totalSkills: number
    totalPatterns: number
    byCategory: Record<string, number>
  } {
    const byCategory: Record<string, number> = {}
    let totalPatterns = 0

    for (const skill of this.skills.values()) {
      for (const pattern of skill.patterns) {
        totalPatterns++
        byCategory[pattern.category] = (byCategory[pattern.category] || 0) + 1
      }
    }

    return {
      totalSkills: this.skills.size,
      totalPatterns,
      byCategory,
    }
  }

  /**
   * Get router stats
   */
  routerStats(): {
    matches: number
    misses: number
    hitRate: number
    tokensSaved: number
  } {
    const total = this.matchCount + this.missCount
    return {
      matches: this.matchCount,
      misses: this.missCount,
      hitRate: total > 0 ? this.matchCount / total : 0,
      tokensSaved: this.tokensSaved,
    }
  }

  private totalPatterns(): number {
    return this.stats().totalPatterns
  }
}

// Singleton instance
export const SkillRouter = new SkillRouterImpl()
