/**
 * Recovery Skill - Autonomous error recovery
 * 
 * Pattern source: CyxMake (104 patterns in C)
 * This is the TypeScript port for CyxCode.
 */

import { BaseSkill } from "../../base-skill"
import type { Pattern } from "../../types"

// Import pattern categories
import { nodePatterns } from "./patterns/node"
import { gitPatterns } from "./patterns/git"
import { buildPatterns } from "./patterns/build"
import { dockerPatterns } from "./patterns/docker"
import { pythonPatterns } from "./patterns/python"
import { systemPatterns } from "./patterns/system"

export class RecoverySkill extends BaseSkill {
  name = "recovery"
  description = "Autonomous error recovery - pattern matches build, git, docker, node, python, and system errors"
  version = "1.0.0"
  
  triggers = [
    "error", "failed", "failure", "cannot", "unable", 
    "not found", "missing", "denied", "rejected",
    "build", "compile", "npm", "pip", "cargo", "git"
  ]

  patterns: Pattern[] = [
    ...nodePatterns,
    ...gitPatterns,
    ...buildPatterns,
    ...dockerPatterns,
    ...pythonPatterns,
    ...systemPatterns,
  ]
}

// Export singleton instance
export const recoverySkill = new RecoverySkill()
