/**
 * CyxCode Pattern-First Skill System
 * 
 * Unlike OpenCode's markdown-based skills (instructions for LLM),
 * PatternSkills are executable code that matches errors and applies fixes.
 * 
 * Flow: Error -> Pattern Match -> Fix (FREE) -> Success
 *       Error -> No Match -> LLM Fallback (costs tokens)
 */

import z from "zod"

// =============================================================================
// Fix Definition
// =============================================================================

export const FixSchema = z.object({
  /** Unique identifier for this fix */
  id: z.string(),
  
  /** Human-readable description */
  description: z.string(),
  
  /** Command to execute (supports $1, $2 for regex captures) */
  command: z.string().optional(),
  
  /** Manual instructions if no command */
  instructions: z.string().optional(),
  
  /** Priority (lower = try first) */
  priority: z.number().default(1),
  
  /** Success rate from history (0-1) */
  successRate: z.number().optional(),
})

export type Fix = z.infer<typeof FixSchema>

// =============================================================================
// Pattern Definition
// =============================================================================

export const PatternSchema = z.object({
  /** Unique identifier */
  id: z.string(),
  
  /** Regex pattern to match error output */
  regex: z.instanceof(RegExp),
  
  /** Category for grouping (build, git, docker, node, python, system) */
  category: z.string(),
  
  /** Human-readable description */
  description: z.string(),
  
  /** Available fixes, ordered by priority */
  fixes: z.array(FixSchema),
  
  /** Extract info from regex captures */
  extractors: z.record(z.string(), z.number()).optional(),
})

export type Pattern = z.infer<typeof PatternSchema>

// =============================================================================
// Pattern Match Result
// =============================================================================

export interface PatternMatch {
  pattern: Pattern
  captures: string[]
  extracted: Record<string, string>
}

// =============================================================================
// Skill Execution Context
// =============================================================================

export interface SkillContext {
  /** Current working directory */
  cwd: string
  
  /** The error output that triggered the skill */
  errorOutput: string
  
  /** The command that failed */
  failedCommand?: string
  
  /** Environment variables */
  env: Record<string, string>
  
  /** Request user approval for a fix */
  approve: (fix: Fix) => Promise<boolean>
  
  /** Execute a command */
  execute: (command: string) => Promise<ExecuteResult>
}

export interface ExecuteResult {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
}

// =============================================================================
// Skill Result
// =============================================================================

export interface SkillResult {
  /** Whether the skill handled the error */
  handled: boolean
  
  /** Whether the fix was successful */
  success: boolean
  
  /** The fix that was applied */
  fixApplied?: Fix
  
  /** Message to show user */
  message: string
  
  /** Should retry the original command? */
  shouldRetry: boolean
  
  /** Tokens saved by using pattern match */
  tokensSaved?: number
}

// =============================================================================
// Pattern Skill Interface
// =============================================================================

export interface PatternSkill {
  /** Skill identifier */
  name: string
  
  /** Human-readable description */
  description: string
  
  /** Version */
  version: string
  
  /** Keywords that might activate this skill */
  triggers: string[]
  
  /** All patterns in this skill */
  patterns: Pattern[]
  
  /** Match an error against patterns */
  match(error: string): PatternMatch | null
  
  /** Execute a fix */
  execute(ctx: SkillContext, match: PatternMatch): Promise<SkillResult>
}

// =============================================================================
// Skill Registry
// =============================================================================

export interface SkillRegistry {
  /** Register a skill */
  register(skill: PatternSkill): void
  
  /** Get all registered skills */
  all(): PatternSkill[]
  
  /** Find skills that might handle an error */
  findMatching(error: string): Array<{ skill: PatternSkill; match: PatternMatch }>
  
  /** Get pattern stats */
  stats(): {
    totalSkills: number
    totalPatterns: number
    byCategory: Record<string, number>
  }
}
