/**
 * Network Security Error Patterns
 */

import type { Pattern } from "../../../types"

export const networkPatterns: Pattern[] = [
  // FIREWALL BLOCKED
  {
    id: "net-firewall-blocked",
    regex: /firewall.*blocked|iptables.*DROP|connection.*filtered|No route to host/i,
    category: "network",
    description: "Connection blocked by firewall",
    fixes: [
      { id: "check-ufw", command: "sudo ufw status verbose", description: "Check UFW firewall rules", priority: 1 },
      { id: "check-iptables", command: "sudo iptables -L -n -v", description: "List iptables rules", priority: 2 },
      { id: "allow-port", command: "sudo ufw allow $port", description: "Allow port in UFW", priority: 3 },
    ],
  },

  // PORT SCAN DETECTED
  {
    id: "net-port-scan-detected",
    regex: /possible.*scan|Nmap scan report|port scan detected/i,
    category: "network",
    description: "Port scan activity detected",
    fixes: [
      { id: "check-open-ports", command: "sudo netstat -tlnp", description: "List open ports", priority: 1 },
      { id: "fail2ban-status", command: "sudo fail2ban-client status", description: "Check fail2ban status", priority: 2 },
      { id: "block-ip", command: "sudo iptables -A INPUT -s $ip -j DROP", description: "Block suspicious IP", priority: 3 },
    ],
  },

  // DNS RESOLUTION FAILED SECURELY
  {
    id: "net-dnssec-failed",
    regex: /DNSSEC validation failed|SERVFAIL.*DNSSEC|DNS.*signature.*invalid/i,
    category: "network",
    description: "DNSSEC validation failed",
    fixes: [
      { id: "check-dnssec", command: "dig +dnssec $domain", description: "Check DNSSEC records", priority: 1 },
      { id: "use-different-dns", command: "dig @8.8.8.8 $domain", description: "Try different DNS server", priority: 2 },
    ],
  },

  // VPN CONNECTION FAILED
  {
    id: "net-vpn-failed",
    regex: /VPN.*failed|OpenVPN.*error|WireGuard.*failed|tunnel.*failed/i,
    category: "network",
    description: "VPN connection failed",
    fixes: [
      { id: "check-vpn-service", command: "sudo systemctl status openvpn", description: "Check VPN service status", priority: 1 },
      { id: "check-vpn-config", instructions: "Verify VPN configuration file and credentials", description: "Check VPN config", priority: 2 },
      { id: "restart-vpn", command: "sudo systemctl restart openvpn", description: "Restart VPN service", priority: 3 },
    ],
  },

  // PROXY AUTHENTICATION REQUIRED
  {
    id: "net-proxy-auth",
    regex: /407 Proxy Authentication|Proxy.*requires authentication|CONNECT.*407/i,
    category: "network",
    description: "Proxy authentication required",
    fixes: [
      { id: "set-proxy-auth", command: "export https_proxy=http://user:pass@proxy:port", description: "Set proxy with auth", priority: 1 },
      { id: "git-proxy", command: "git config --global http.proxy http://user:pass@proxy:port", description: "Set git proxy", priority: 2 },
    ],
  },

  // MIXED CONTENT BLOCKED
  {
    id: "net-mixed-content",
    regex: /Mixed Content|blocked.*insecure|loading mixed.*content/i,
    category: "network",
    description: "Mixed content blocked",
    fixes: [
      { id: "use-https", instructions: "Change all HTTP URLs to HTTPS", description: "Use HTTPS URLs", priority: 1 },
      { id: "upgrade-insecure", instructions: "Add Content-Security-Policy: upgrade-insecure-requests header", description: "Upgrade insecure requests", priority: 2 },
    ],
  },

  // CSP VIOLATION
  {
    id: "net-csp-violation",
    regex: /Content Security Policy|CSP.*violation|Refused to.*CSP directive/i,
    category: "network",
    description: "Content Security Policy violation",
    fixes: [
      { id: "check-csp", instructions: "Review CSP header and add required sources to whitelist", description: "Review CSP policy", priority: 1 },
      { id: "csp-report", instructions: "Use Content-Security-Policy-Report-Only to test changes", description: "Use report-only mode", priority: 2 },
    ],
  },

  // HSTS ERROR
  {
    id: "net-hsts-error",
    regex: /HSTS.*failure|Strict-Transport-Security|HTTP.*not allowed.*HSTS/i,
    category: "network",
    description: "HSTS policy error",
    fixes: [
      { id: "use-https", instructions: "Use HTTPS - the site requires secure connections", description: "Use HTTPS", priority: 1 },
      { id: "clear-hsts", instructions: "Clear HSTS cache in browser (chrome://net-internals/#hsts)", description: "Clear HSTS cache", priority: 2 },
    ],
  },
]
