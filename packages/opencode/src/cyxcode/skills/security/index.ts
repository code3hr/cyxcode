/**
 * Security Skill - Security error recovery and vulnerability detection
 * 
 * Handles SSL/TLS, authentication, SSH, network security, and security scan outputs.
 */

import { BaseSkill } from "../../base-skill"
import type { Pattern } from "../../types"

// Import pattern categories
import { sslPatterns } from "./patterns/ssl"
import { authPatterns } from "./patterns/auth"
import { sshPatterns } from "./patterns/ssh"
import { networkPatterns } from "./patterns/network"
import { scanPatterns } from "./patterns/scan"

export class SecuritySkill extends BaseSkill {
  name = "security"
  description = "Security error recovery - handles SSL/TLS, auth, SSH, network security, and vulnerability scan outputs"
  version = "1.0.0"
  
  triggers = [
    "ssl", "tls", "certificate", "cert",
    "auth", "401", "403", "token", "jwt", "oauth",
    "ssh", "publickey", "host key",
    "cors", "csp", "security",
    "vulnerability", "cve", "injection", "xss"
  ]

  patterns: Pattern[] = [
    ...sslPatterns,
    ...authPatterns,
    ...sshPatterns,
    ...networkPatterns,
    ...scanPatterns,
  ]
}

// Export singleton instance
export const securitySkill = new SecuritySkill()
