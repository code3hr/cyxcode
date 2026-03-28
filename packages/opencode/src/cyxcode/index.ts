/**
 * CyxCode - Pattern-First Skill System
 *
 * Deep skills, not 700 shallow ones.
 * Patterns over tokens.
 */

// Types
export * from "./types"

// Base skill class
export { BaseSkill } from "./base-skill"

// Skill router
export { SkillRouter } from "./router"

// Audit system
export { CyxAudit, CyxEvents, redactSecrets } from "./audit"
export type { CyxAuditEntry, CyxEventType } from "./audit"

// Report generation
export { CyxReport } from "./report"

// Skills
export { recoverySkill } from "./skills/recovery"
export { securitySkill } from "./skills/security"
export { devopsSkill } from "./skills/devops"

// Initialize: register all built-in skills
import { SkillRouter } from "./router"
import { recoverySkill } from "./skills/recovery"
import { securitySkill } from "./skills/security"
import { devopsSkill } from "./skills/devops"

export function initCyxCode() {
  // Prevent double initialization
  if ((globalThis as any).__cyxcode_router) return (globalThis as any).__cyxcode_router as typeof SkillRouter

  SkillRouter.register(recoverySkill)
  SkillRouter.register(securitySkill)
  SkillRouter.register(devopsSkill)

  // Store on globalThis to avoid module duplication issues with Bun conditions
  ;(globalThis as any).__cyxcode_router = SkillRouter

  // Load three-tier patterns — community > global > project
  ;(globalThis as any).__cyxcode_learned_ready = (async () => {
    try {
      // Tier 1: Community patterns (from ~/.cyxcode/community/)
      const { CommunityPatterns } = await import("./community")
      const { LearnedSkill } = await import("./learned")
      const community = await CommunityPatterns.loadAll()
      if (community.length > 0) {
        const skill = new LearnedSkill(community)
        skill.name = "community"
        skill.description = "Community-contributed patterns"
        SkillRouter.register(skill)
      }

      // Tier 2: Global learned patterns (from ~/.cyxcode/patterns/learned.json)
      const { CyxPaths } = await import("./paths")
      const { LearnedPatterns } = await import("./learned")
      const globalLearned = await LearnedPatterns.loadApproved(CyxPaths.globalLearnedPath())
      if (globalLearned.length > 0) {
        const skill = new LearnedSkill(globalLearned)
        skill.name = "global-learned"
        skill.description = "Global learned patterns"
        SkillRouter.register(skill)
      }

      // Tier 3: Project learned patterns (from .cyxcode/patterns/ or .opencode/)
      const approved = await LearnedPatterns.loadApproved()
      if (approved.length > 0) {
        SkillRouter.register(new LearnedSkill(approved))
      }
    } catch {}
  })().catch(() => {})

  // Initialize memory capture system
  import("./memory").then(({ initMemoryCapture }) => {
    initMemoryCapture()
  }).catch(() => {})

  // Run auto-dream consolidation (phases 1-4, code-only, no tokens)
  import("./dream").then(({ Dream }) => {
    Dream.initAutoDream()
  }).catch(() => {})

  return SkillRouter
}

/** Get the initialized SkillRouter (safe across module boundaries) */
export function getRouter() {
  return ((globalThis as any).__cyxcode_router || SkillRouter) as typeof SkillRouter
}
