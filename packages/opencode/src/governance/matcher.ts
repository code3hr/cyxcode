/**
 * @fileoverview Governance Matcher Module
 *
 * This module is responsible for extracting and classifying network targets
 * from tool arguments. It analyzes tool inputs to identify potential network
 * endpoints (IPs, CIDRs, domains, URLs) that governance policies can then
 * evaluate.
 *
 * ## Target Extraction
 *
 * The matcher extracts targets differently based on tool type:
 *
 * - **bash**: Analyzes command strings for URLs, IPs, SSH patterns, and
 *   common networking tool invocations (curl, wget, ssh, etc.)
 * - **webfetch**: Extracts the URL argument directly
 * - **websearch**: No network targets (search queries don't target specific hosts)
 * - **Other tools**: Scans all string argument values for recognizable patterns
 *
 * ## Target Classification
 *
 * Each extracted string is classified into one of:
 * - `ip`: IPv4 address (e.g., "192.168.1.1")
 * - `cidr`: CIDR notation (e.g., "10.0.0.0/8")
 * - `domain`: Domain name (e.g., "example.com")
 * - `url`: Full URL (e.g., "https://example.com/path")
 * - `unknown`: Could not be classified
 *
 * ## Pattern Matching
 *
 * The module provides matching functions for governance checks:
 * - CIDR matching for IP addresses against network ranges
 * - Wildcard/glob matching for domain patterns (e.g., "*.example.com")
 *
 * @module governance/matcher
 */

import { GovernanceTypes } from "./types"
import { Wildcard } from "../util/wildcard"
import { Log } from "../util/log"

export namespace GovernanceMatcher {
  const log = Log.create({ service: "governance.matcher" })

  /**
   * Regular expression for matching IPv4 addresses.
   * Matches four octets separated by dots (e.g., "192.168.1.1").
   * Note: Does not validate octet values (0-255), that's done separately.
   */
  const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/

  /**
   * Regular expression for matching CIDR notation.
   * Matches IPv4 address followed by /prefix (e.g., "10.0.0.0/8").
   * Note: Does not validate prefix length (0-32), that's done separately.
   */
  const CIDR_REGEX = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/

  /**
   * Regular expression for matching domain names.
   * Allows alphanumeric characters, hyphens, and multiple subdomains.
   * Simplified pattern that covers most valid domain names.
   */
  const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/

  /**
   * Classify a string as IP, CIDR, domain, URL, or unknown.
   *
   * Classification order:
   * 1. Try to parse as URL (most specific)
   * 2. Check for CIDR notation
   * 3. Check for IPv4 address
   * 4. Check for domain name
   * 5. Fall back to unknown
   *
   * @param raw - The raw string to classify
   * @returns A Target object with type and normalized form
   *
   * @example
   * ```typescript
   * // URL classification
   * classifyTarget("https://api.example.com/v1")
   * // => { raw: "https://api.example.com/v1", type: "url", normalized: "api.example.com" }
   *
   * // IP classification
   * classifyTarget("192.168.1.1")
   * // => { raw: "192.168.1.1", type: "ip", normalized: "192.168.1.1" }
   *
   * // CIDR classification
   * classifyTarget("10.0.0.0/8")
   * // => { raw: "10.0.0.0/8", type: "cidr", normalized: "10.0.0.0/8" }
   *
   * // Domain classification
   * classifyTarget("example.com")
   * // => { raw: "example.com", type: "domain", normalized: "example.com" }
   * ```
   */
  export function classifyTarget(raw: string): GovernanceTypes.Target {
    const trimmed = raw.trim()

    // Check if URL and extract hostname
    try {
      const url = new URL(trimmed)
      return {
        raw: trimmed,
        type: "url",
        normalized: url.hostname.toLowerCase(),
      }
    } catch {
      // Not a valid URL, continue checking
    }

    // Check CIDR first (before IP since CIDR contains IP)
    if (CIDR_REGEX.test(trimmed)) {
      return { raw: trimmed, type: "cidr", normalized: trimmed }
    }

    // Check IP
    if (IPV4_REGEX.test(trimmed)) {
      // Validate each octet is 0-255
      const octets = trimmed.split(".").map(Number)
      if (octets.every((o) => o >= 0 && o <= 255)) {
        return { raw: trimmed, type: "ip", normalized: trimmed }
      }
      // Looks like an IP but invalid octets - return unknown to avoid
      // misclassifying "999.999.999.999" as a domain
      return { raw: trimmed, type: "unknown", normalized: trimmed }
    }

    // Check domain
    if (DOMAIN_REGEX.test(trimmed) && trimmed.includes(".")) {
      return { raw: trimmed, type: "domain", normalized: trimmed.toLowerCase() }
    }

    return { raw: trimmed, type: "unknown", normalized: trimmed }
  }

  /**
   * Extract network targets from tool arguments based on tool type.
   *
   * Different tools have their network targets in different places:
   * - bash: Embedded in command strings (URLs, IPs, hostnames)
   * - webfetch: The `url` argument
   * - websearch: No network targets (search queries)
   * - Other: Scan all string values for recognizable patterns
   *
   * @param tool - The tool name (e.g., "bash", "webfetch")
   * @param args - The tool arguments to analyze
   * @returns Array of extracted and deduplicated targets
   *
   * @example
   * ```typescript
   * // Bash command with curl
   * extractTargets("bash", { command: "curl https://api.example.com" })
   * // => [{ raw: "https://api.example.com", type: "url", normalized: "api.example.com" }]
   *
   * // WebFetch tool
   * extractTargets("webfetch", { url: "https://example.com/data" })
   * // => [{ raw: "https://example.com/data", type: "url", normalized: "example.com" }]
   *
   * // SSH command
   * extractTargets("bash", { command: "ssh user@server.internal.com" })
   * // => [{ raw: "server.internal.com", type: "domain", normalized: "server.internal.com" }]
   * ```
   */
  export function extractTargets(tool: string, args: Record<string, any>): GovernanceTypes.Target[] {
    const targets: GovernanceTypes.Target[] = []

    switch (tool) {
      case "bash":
        // Bash commands require deep analysis of the command string
        targets.push(...extractFromBash(args.command || ""))
        break

      case "webfetch":
        // WebFetch has a direct URL argument
        if (args.url) {
          targets.push(classifyTarget(args.url))
        }
        break

      case "websearch":
        // websearch queries don't have specific network targets
        break

      default:
        // For MCP tools and custom tools, scan all string values
        for (const value of Object.values(args)) {
          if (typeof value === "string") {
            const classified = classifyTarget(value)
            if (classified.type !== "unknown") {
              targets.push(classified)
            }
          }
        }
    }

    // Deduplicate by normalized value
    const seen = new Set<string>()
    return targets.filter((t) => {
      if (seen.has(t.normalized)) return false
      seen.add(t.normalized)
      return true
    })
  }

  /**
   * Extract URLs, IPs, and domains from bash commands.
   *
   * This function uses multiple strategies to find network targets:
   *
   * 1. **URL patterns**: Matches http:// and https:// URLs
   * 2. **IP/CIDR patterns**: Matches IPv4 addresses and CIDR ranges
   * 3. **SSH patterns**: Matches user@host patterns
   * 4. **Tool patterns**: Matches hostnames after common networking tools
   *    (curl, wget, nc, nmap, ssh, scp, ping, etc.)
   *
   * @param command - The bash command string to analyze
   * @returns Array of extracted targets (may contain duplicates)
   *
   * @example
   * ```typescript
   * extractFromBash("curl -X POST https://api.example.com/data")
   * // => [{ raw: "https://api.example.com/data", type: "url", normalized: "api.example.com" }]
   *
   * extractFromBash("ping 192.168.1.1 && ssh admin@server.local")
   * // => [
   * //   { raw: "192.168.1.1", type: "ip", normalized: "192.168.1.1" },
   * //   { raw: "server.local", type: "domain", normalized: "server.local" }
   * // ]
   * ```
   */
  function extractFromBash(command: string): GovernanceTypes.Target[] {
    const targets: GovernanceTypes.Target[] = []

    // URL patterns in command
    const urlMatches = command.match(/https?:\/\/[^\s'"<>]+/g) || []
    for (const url of urlMatches) {
      // Clean trailing punctuation
      const cleaned = url.replace(/[),;]+$/, "")
      targets.push(classifyTarget(cleaned))
    }

    // IP addresses and CIDR ranges
    const ipMatches = command.match(/\b(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?\b/g) || []
    for (const ip of ipMatches) {
      const classified = classifyTarget(ip)
      if (classified.type !== "unknown") {
        targets.push(classified)
      }
    }

    // SSH-style user@host patterns
    const sshMatches = command.match(/@([a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9])/g) || []
    for (const match of sshMatches) {
      const host = match.slice(1) // Remove @
      const classified = classifyTarget(host)
      if (classified.type !== "unknown") {
        targets.push(classified)
      }
    }

    // Common tool patterns: curl/wget/nc/nmap followed by hostname
    // This catches patterns like "curl example.com" or "ssh -p 22 server.local"
    const toolPatterns = [
      /\b(?:curl|wget|nc|ncat|netcat|nmap|ssh|scp|sftp|rsync|ping|traceroute|telnet)\s+(?:-[^\s]+\s+)*([a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,})/g,
    ]
    for (const pattern of toolPatterns) {
      let match
      while ((match = pattern.exec(command)) !== null) {
        if (match[1]) {
          const classified = classifyTarget(match[1])
          if (classified.type !== "unknown") {
            targets.push(classified)
          }
        }
      }
    }

    return targets
  }

  /**
   * Check if an IP address falls within a CIDR range.
   *
   * Uses bitwise operations for efficient subnet matching:
   * 1. Convert both IP and range base to 32-bit integers
   * 2. Create a bitmask from the prefix length
   * 3. Compare masked values
   *
   * @param ip - IPv4 address to check (e.g., "192.168.1.100")
   * @param cidr - CIDR range to check against (e.g., "192.168.0.0/16")
   * @returns true if the IP is within the CIDR range
   *
   * @example
   * ```typescript
   * ipInCidr("192.168.1.100", "192.168.0.0/16")  // true
   * ipInCidr("192.168.1.100", "192.168.1.0/24") // true
   * ipInCidr("192.168.1.100", "10.0.0.0/8")     // false
   * ipInCidr("10.0.0.1", "10.0.0.0/8")          // true
   * ```
   */
  export function ipInCidr(ip: string, cidr: string): boolean {
    const [range, bitsStr] = cidr.split("/")
    const bits = parseInt(bitsStr, 10)

    // Validate prefix length
    if (bits < 0 || bits > 32) return false

    const ipNum = ipToNumber(ip)
    const rangeNum = ipToNumber(range)

    if (ipNum === null || rangeNum === null) return false

    // Create mask: for /24, mask = 0xFFFFFF00 (first 24 bits set)
    // For /0, mask = 0 (match everything)
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0

    return (ipNum & mask) === (rangeNum & mask)
  }

  /**
   * Convert IPv4 string to 32-bit unsigned integer.
   *
   * @param ip - IPv4 address string (e.g., "192.168.1.1")
   * @returns 32-bit unsigned integer, or null if invalid
   *
   * @example
   * ```typescript
   * ipToNumber("192.168.1.1")   // 3232235777
   * ipToNumber("0.0.0.0")       // 0
   * ipToNumber("255.255.255.255") // 4294967295
   * ipToNumber("invalid")       // null
   * ```
   */
  function ipToNumber(ip: string): number | null {
    const parts = ip.split(".")
    if (parts.length !== 4) return null

    let result = 0
    for (const part of parts) {
      const num = parseInt(part, 10)
      if (isNaN(num) || num < 0 || num > 255) return null
      result = (result << 8) + num
    }
    return result >>> 0 // Convert to unsigned
  }

  /**
   * Match a target against a pattern.
   *
   * Matching strategy depends on pattern and target types:
   *
   * - **CIDR pattern + IP target**: Uses CIDR subnet matching
   * - **CIDR pattern + CIDR target**: Exact string match only
   * - **All other cases**: Uses wildcard/glob matching
   *
   * Wildcard patterns support:
   * - `*` matches any sequence of characters
   * - `?` matches any single character
   * - Example: `*.example.com` matches `api.example.com`
   *
   * @param target - The target to match
   * @param pattern - The pattern to match against
   * @returns true if the target matches the pattern
   *
   * @example
   * ```typescript
   * // CIDR matching
   * matchTarget({ type: "ip", normalized: "192.168.1.1" }, "192.168.0.0/16")  // true
   * matchTarget({ type: "ip", normalized: "10.0.0.1" }, "192.168.0.0/16")     // false
   *
   * // Wildcard matching
   * matchTarget({ type: "domain", normalized: "api.example.com" }, "*.example.com")  // true
   * matchTarget({ type: "domain", normalized: "example.com" }, "*.example.com")      // false
   *
   * // Exact matching
   * matchTarget({ type: "domain", normalized: "example.com" }, "example.com")  // true
   * ```
   */
  export function matchTarget(target: GovernanceTypes.Target, pattern: string): boolean {
    // If pattern is CIDR and target is IP
    if (CIDR_REGEX.test(pattern) && target.type === "ip") {
      return ipInCidr(target.normalized, pattern)
    }

    // If target is CIDR (unusual but possible) - exact match only
    if (target.type === "cidr" && CIDR_REGEX.test(pattern)) {
      return target.normalized === pattern
    }

    // Use wildcard matching for domains and other patterns
    return Wildcard.match(target.normalized, pattern)
  }
}
