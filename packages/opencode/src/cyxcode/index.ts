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

  // Load learned patterns — store promise so first bash call can await it
  ;(globalThis as any).__cyxcode_learned_ready = import("./learned").then(async ({ LearnedPatterns, LearnedSkill }) => {
    try {
      const approved = await LearnedPatterns.loadApproved()
      if (approved.length > 0) {
        SkillRouter.register(new LearnedSkill(approved))
      }
    } catch {}
  }).catch(() => {})

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
