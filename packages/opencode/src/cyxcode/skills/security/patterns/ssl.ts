/**
 * SSL/TLS Error Patterns
 */

import type { Pattern } from "../../../types"

export const sslPatterns: Pattern[] = [
  // CERTIFICATE EXPIRED
  {
    id: "ssl-cert-expired",
    regex: /certificate has expired|SSL_ERROR_EXPIRED_CERT_ALERT|CERT_HAS_EXPIRED/i,
    category: "ssl",
    description: "SSL certificate expired",
    fixes: [
      { id: "check-cert", command: "openssl s_client -connect $host:443 2>/dev/null | openssl x509 -noout -dates", description: "Check certificate dates", priority: 1 },
      { id: "renew-letsencrypt", command: "sudo certbot renew", description: "Renew Let's Encrypt certificate", priority: 2 },
      { id: "skip-verify", instructions: "Use --insecure or NODE_TLS_REJECT_UNAUTHORIZED=0 (dev only)", description: "Skip verification (dev)", priority: 3 },
    ],
  },

  // CERTIFICATE NOT TRUSTED
  {
    id: "ssl-cert-untrusted",
    regex: /unable to get local issuer certificate|self.signed certificate|UNABLE_TO_VERIFY_LEAF_SIGNATURE|DEPTH_ZERO_SELF_SIGNED_CERT/i,
    category: "ssl",
    description: "SSL certificate not trusted",
    fixes: [
      { id: "install-ca", command: "sudo apt install ca-certificates && sudo update-ca-certificates", description: "Update CA certificates", priority: 1 },
      { id: "node-ca", command: "export NODE_EXTRA_CA_CERTS=/path/to/cert.pem", description: "Add custom CA for Node.js", priority: 2 },
      { id: "curl-cacert", command: "curl --cacert /path/to/cert.pem", description: "Specify CA cert for curl", priority: 3 },
    ],
  },

  // CERTIFICATE HOSTNAME MISMATCH
  {
    id: "ssl-hostname-mismatch",
    regex: /Hostname.*mismatch|SSL_ERROR_BAD_CERT_DOMAIN|certificate.*not match/i,
    category: "ssl",
    description: "SSL certificate hostname mismatch",
    fixes: [
      { id: "check-san", command: "openssl s_client -connect $host:443 2>/dev/null | openssl x509 -noout -text | grep -A1 'Subject Alternative Name'", description: "Check certificate SANs", priority: 1 },
      { id: "use-correct-host", instructions: "Use the hostname that matches the certificate", description: "Use correct hostname", priority: 2 },
    ],
  },

  // SSL HANDSHAKE FAILED
  {
    id: "ssl-handshake-failed",
    regex: /SSL handshake failed|SSL_ERROR_HANDSHAKE|handshake_failure|SSL routines.*failed/i,
    category: "ssl",
    description: "SSL handshake failed",
    fixes: [
      { id: "check-tls-version", command: "openssl s_client -connect $host:443 -tls1_2", description: "Test TLS 1.2 connection", priority: 1 },
      { id: "check-ciphers", command: "nmap --script ssl-enum-ciphers -p 443 $host", description: "Enumerate supported ciphers", priority: 2 },
      { id: "force-tls12", instructions: "Force TLS 1.2: --tlsv1.2 for curl, or set min TLS version in code", description: "Force TLS version", priority: 3 },
    ],
  },

  // CERTIFICATE REVOKED
  {
    id: "ssl-cert-revoked",
    regex: /certificate revoked|CERT_REVOKED|CRL.*revoked/i,
    category: "ssl",
    description: "SSL certificate revoked",
    fixes: [
      { id: "check-ocsp", command: "openssl s_client -connect $host:443 -status 2>/dev/null | grep -A 1 'OCSP Response'", description: "Check OCSP status", priority: 1 },
      { id: "reissue-cert", instructions: "Reissue the certificate from your CA", description: "Reissue certificate", priority: 2 },
    ],
  },

  // SSL PROTOCOL ERROR
  {
    id: "ssl-protocol-error",
    regex: /SSL_ERROR_PROTOCOL|wrong version number|unsupported protocol/i,
    category: "ssl",
    description: "SSL protocol error",
    fixes: [
      { id: "test-protocols", command: "for v in tls1 tls1_1 tls1_2 tls1_3; do echo \"Testing $v:\"; openssl s_client -connect $host:443 -$v 2>&1 | head -5; done", description: "Test all TLS versions", priority: 1 },
      { id: "upgrade-openssl", command: "openssl version && sudo apt update && sudo apt install openssl", description: "Upgrade OpenSSL", priority: 2 },
    ],
  },

  // NO SSL SUPPORT
  {
    id: "ssl-not-supported",
    regex: /SSL support not available|SSL module.*not found|ssl module in Python is not available/i,
    category: "ssl",
    description: "SSL support not available",
    fixes: [
      { id: "install-openssl", command: "sudo apt install libssl-dev", description: "Install OpenSSL dev libraries", priority: 1 },
      { id: "python-ssl", command: "pip install pyopenssl", description: "Install Python OpenSSL", priority: 2 },
    ],
  },
]
