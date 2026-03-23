/**
 * Security Scan/Tool Output Patterns
 */

import type { Pattern } from "../../../types"

export const scanPatterns: Pattern[] = [
  // SQL INJECTION DETECTED
  {
    id: "scan-sqli-detected",
    regex: /SQL injection|sqlmap.*vulnerable|injectable parameter|error-based injection/i,
    category: "scan",
    description: "SQL injection vulnerability detected",
    fixes: [
      { id: "use-prepared", instructions: "Use prepared statements/parameterized queries", description: "Use prepared statements", priority: 1 },
      { id: "input-validation", instructions: "Implement input validation and sanitization", description: "Validate input", priority: 2 },
      { id: "waf-rule", instructions: "Add WAF rule to block SQL injection patterns", description: "Add WAF protection", priority: 3 },
    ],
  },

  // XSS DETECTED
  {
    id: "scan-xss-detected",
    regex: /XSS.*vulnerable|Cross-site scripting|reflected.*XSS|stored.*XSS/i,
    category: "scan",
    description: "Cross-site scripting vulnerability detected",
    fixes: [
      { id: "encode-output", instructions: "HTML encode all user input before rendering", description: "Encode output", priority: 1 },
      { id: "csp-header", instructions: "Add Content-Security-Policy header to prevent inline scripts", description: "Add CSP header", priority: 2 },
      { id: "sanitize-input", instructions: "Use a sanitization library like DOMPurify", description: "Sanitize input", priority: 3 },
    ],
  },

  // VULNERABLE DEPENDENCY
  {
    id: "scan-vuln-dependency",
    regex: /CVE-\d{4}-\d+|vulnerable.*package|security vulnerability.*dependency|npm audit|snyk.*vulnerability/i,
    category: "scan",
    description: "Vulnerable dependency detected",
    fixes: [
      { id: "npm-audit-fix", command: "npm audit fix", description: "Auto-fix npm vulnerabilities", priority: 1 },
      { id: "npm-update", command: "npm update", description: "Update all packages", priority: 2 },
      { id: "check-advisories", command: "npm audit", description: "View detailed advisories", priority: 3 },
    ],
  },

  // EXPOSED SECRETS
  {
    id: "scan-exposed-secrets",
    regex: /secret.*exposed|API key.*committed|credential.*found|password.*in.*code|gitleaks|trufflehog/i,
    category: "scan",
    description: "Exposed secrets detected",
    fixes: [
      { id: "rotate-secret", instructions: "Immediately rotate the exposed secret/credential", description: "Rotate secret", priority: 1 },
      { id: "git-filter", command: "git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch $file' HEAD", description: "Remove from git history", priority: 2 },
      { id: "add-gitignore", instructions: "Add sensitive files to .gitignore", description: "Update .gitignore", priority: 3 },
    ],
  },

  // INSECURE CONFIGURATION
  {
    id: "scan-insecure-config",
    regex: /insecure configuration|misconfiguration|debug.*enabled.*production|default.*credentials/i,
    category: "scan",
    description: "Insecure configuration detected",
    fixes: [
      { id: "disable-debug", instructions: "Disable debug mode in production", description: "Disable debug", priority: 1 },
      { id: "change-defaults", instructions: "Change default credentials and settings", description: "Change defaults", priority: 2 },
      { id: "security-headers", instructions: "Add security headers (X-Frame-Options, X-Content-Type-Options, etc.)", description: "Add security headers", priority: 3 },
    ],
  },

  // OUTDATED SOFTWARE
  {
    id: "scan-outdated-software",
    regex: /outdated.*version|end.of.life|EOL.*software|unsupported.*version/i,
    category: "scan",
    description: "Outdated/EOL software detected",
    fixes: [
      { id: "upgrade-software", instructions: "Upgrade to a supported version", description: "Upgrade software", priority: 1 },
      { id: "check-compatibility", instructions: "Review changelog for breaking changes before upgrading", description: "Check compatibility", priority: 2 },
    ],
  },

  // WEAK CRYPTO
  {
    id: "scan-weak-crypto",
    regex: /weak.*cipher|MD5|SHA-?1.*deprecated|DES.*insecure|weak.*encryption/i,
    category: "scan",
    description: "Weak cryptography detected",
    fixes: [
      { id: "use-strong-hash", instructions: "Use SHA-256 or better for hashing, bcrypt/argon2 for passwords", description: "Use strong algorithms", priority: 1 },
      { id: "use-aes256", instructions: "Use AES-256-GCM for symmetric encryption", description: "Use AES-256", priority: 2 },
    ],
  },

  // DIRECTORY TRAVERSAL
  {
    id: "scan-directory-traversal",
    regex: /directory traversal|path traversal|\.\.\/|LFI.*vulnerable/i,
    category: "scan",
    description: "Directory traversal vulnerability detected",
    fixes: [
      { id: "validate-path", instructions: "Validate and sanitize file paths, use realpath() and check prefix", description: "Validate paths", priority: 1 },
      { id: "chroot", instructions: "Use chroot or containerization to limit file access", description: "Restrict file access", priority: 2 },
    ],
  },

  // SSRF DETECTED
  {
    id: "scan-ssrf-detected",
    regex: /SSRF.*vulnerable|Server-Side Request Forgery|internal.*endpoint.*accessible/i,
    category: "scan",
    description: "SSRF vulnerability detected",
    fixes: [
      { id: "whitelist-urls", instructions: "Implement URL whitelist for external requests", description: "Whitelist URLs", priority: 1 },
      { id: "block-internal", instructions: "Block requests to internal IP ranges (10.x, 172.16.x, 192.168.x, 127.x)", description: "Block internal IPs", priority: 2 },
    ],
  },
]
