/**
 * Base Skill - Common implementation for pattern-based skills
 */

import type { Pattern, PatternMatch, PatternSkill, SkillContext, SkillResult, Fix } from "./types"

export abstract class BaseSkill implements PatternSkill {
  abstract name: string
  abstract description: string
  abstract version: string
  abstract triggers: string[]
  abstract patterns: Pattern[]

  /**
   * Match an error against all patterns in this skill
   */
  match(error: string): PatternMatch | null {
    for (const pattern of this.patterns) {
      const regexMatch = pattern.regex.exec(error)
      if (regexMatch) {
        const captures = regexMatch.slice(1)
        const extracted: Record<string, string> = {}
        
        // Extract named captures if extractors defined
        if (pattern.extractors) {
          for (const [name, index] of Object.entries(pattern.extractors)) {
            if (captures[index]) {
              extracted[name] = captures[index]
            }
          }
        }
        
        return {
          pattern,
          captures,
          extracted,
        }
      }
    }
    return null
  }

  /**
   * Execute a fix for a matched pattern
   */
  async execute(ctx: SkillContext, match: PatternMatch): Promise<SkillResult> {
    const { pattern, captures } = match
    
    // Sort fixes by success rate (if known) then priority
    const sortedFixes = [...pattern.fixes].sort((a, b) => {
      // Prefer fixes with higher success rate
      const aRate = a.successRate ?? 0.5
      const bRate = b.successRate ?? 0.5
      if (aRate !== bRate) return bRate - aRate
      // Then by priority
      return a.priority - b.priority
    })

    for (const fix of sortedFixes) {
      // Substitute captures into command
      const command = this.substituteCaptures(fix.command, captures)
      
      if (!command) {
        // Manual fix - just show instructions
        return {
          handled: true,
          success: false,
          message: fix.instructions || fix.description,
          shouldRetry: false,
        }
      }

      // Ask for approval
      const approved = await ctx.approve(fix)
      if (!approved) {
        continue // Try next fix
      }

      // Execute the fix
      const result = await ctx.execute(command)
      
      if (result.success) {
        return {
          handled: true,
          success: true,
          fixApplied: fix,
          message: `Fix applied: ${fix.description}`,
          shouldRetry: true,
          tokensSaved: this.estimateTokensSaved(ctx.errorOutput),
        }
      }
      
      // Fix failed, try next one
    }

    return {
      handled: true,
      success: false,
      message: "All fixes failed or were declined",
      shouldRetry: false,
    }
  }

  /**
   * Substitute regex captures into a command template
   * $1 -> first capture, $2 -> second, etc.
   */
  protected substituteCaptures(template: string | undefined, captures: string[]): string | undefined {
    if (!template) return undefined
    
    let result = template
    for (let i = 0; i < captures.length; i++) {
      result = result.replace(new RegExp(`\$${i + 1}`, "g"), captures[i])
    }
    return result
  }

  /**
   * Estimate tokens saved by using pattern match instead of LLM
   * Rough estimate: ~4 chars = 1 token, LLM would need error + context + response
   */
  protected estimateTokensSaved(errorOutput: string): number {
    const errorTokens = Math.ceil(errorOutput.length / 4)
    const contextTokens = 500 // Approximate system prompt / context
    const responseTokens = 200 // Approximate LLM response
    return errorTokens + contextTokens + responseTokens
  }

  /**
   * Get stats for this skill
   */
  stats(): { patterns: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {}
    for (const pattern of this.patterns) {
      byCategory[pattern.category] = (byCategory[pattern.category] || 0) + 1
    }
    return {
      patterns: this.patterns.length,
      byCategory,
    }
  }
}
