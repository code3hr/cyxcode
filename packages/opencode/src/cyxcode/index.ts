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
export { CyxWatch } from "./watch"
export { Wiki } from "./wiki"
export { Codegraph } from "./codegraph"
export { Graph } from "./graph"
export type { WatchAlert, WatchAlertKind, WatchEntry, WatchKind, WatchReport } from "./watch"
export type { WikiPage, WikiIndex, WikiGraph } from "./wiki"
export type { CodeFile, CodeIndex, CodeGraph, CodeSymbol } from "./codegraph"
export type { GraphData, GraphEdge, GraphKind, GraphNode } from "./graph"

// Skills
export { recoverySkill } from "./skills/recovery"
export { securitySkill } from "./skills/security"
export { devopsSkill } from "./skills/devops"

import { initialize } from "./patterns"
export { getRouter } from "./router"

let initialized = false

export function initCyxCode() {
  const router = initialize()
  if (initialized) return router
  initialized = true

  // Initialize memory capture system
  import("./memory").then(({ initMemoryCapture }) => {
    initMemoryCapture()
  }).catch(() => {})

  // Initialize recall layer (passive semantic index over memory + learned patterns)
  import("./recall").then(({ Recall }) => {
    Recall.initRecall().catch(() => {})
  }).catch(() => {})

  // Run auto-dream consolidation (phases 1-4, code-only, no tokens)
  import("./dream").then(({ Dream }) => {
    Dream.initAutoDream()
  }).catch(() => {})

  return router
}
