/**
 * SSH Error Patterns
 */

import type { Pattern } from "../../../types"

export const sshPatterns: Pattern[] = [
  // PERMISSION DENIED (PUBLICKEY)
  {
    id: "ssh-permission-denied",
    regex: /Permission denied \(publickey\)|no matching key exchange method|no matching host key/i,
    category: "ssh",
    description: "SSH authentication failed",
    fixes: [
      { id: "ssh-add", command: "ssh-add -l && ssh-add ~/.ssh/id_rsa", description: "Add SSH key to agent", priority: 1 },
      { id: "check-permissions", command: "ls -la ~/.ssh/ && chmod 600 ~/.ssh/id_rsa && chmod 644 ~/.ssh/id_rsa.pub", description: "Fix SSH key permissions", priority: 2 },
      { id: "ssh-verbose", command: "ssh -vvv user@host", description: "Debug SSH connection", priority: 3 },
    ],
  },

  // HOST KEY VERIFICATION FAILED
  {
    id: "ssh-host-key-failed",
    regex: /Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED|known_hosts/i,
    category: "ssh",
    description: "SSH host key verification failed",
    fixes: [
      { id: "remove-old-key", command: "ssh-keygen -R $host", description: "Remove old host key", priority: 1 },
      { id: "accept-new-key", command: "ssh-keyscan -H $host >> ~/.ssh/known_hosts", description: "Add new host key", priority: 2 },
      { id: "verify-fingerprint", instructions: "Verify the new host key fingerprint is legitimate before accepting", description: "Verify fingerprint", priority: 3 },
    ],
  },

  // CONNECTION REFUSED
  {
    id: "ssh-connection-refused",
    regex: /ssh.*Connection refused|port 22: Connection refused/i,
    category: "ssh",
    description: "SSH connection refused",
    fixes: [
      { id: "check-sshd", command: "sudo systemctl status sshd", description: "Check if SSH daemon is running", priority: 1 },
      { id: "check-port", command: "sudo netstat -tlnp | grep :22", description: "Check if SSH port is listening", priority: 2 },
      { id: "check-firewall", command: "sudo ufw status && sudo iptables -L -n | grep 22", description: "Check firewall rules", priority: 3 },
    ],
  },

  // SSH TIMEOUT
  {
    id: "ssh-timeout",
    regex: /ssh.*timed out|Connection timed out.*ssh|ssh.*Operation timed out/i,
    category: "ssh",
    description: "SSH connection timeout",
    fixes: [
      { id: "check-network", command: "ping -c 3 $host", description: "Check network connectivity", priority: 1 },
      { id: "check-route", command: "traceroute $host", description: "Trace network route", priority: 2 },
      { id: "ssh-timeout-option", command: "ssh -o ConnectTimeout=30 user@host", description: "Increase connection timeout", priority: 3 },
    ],
  },

  // TOO MANY AUTHENTICATION FAILURES
  {
    id: "ssh-too-many-failures",
    regex: /Too many authentication failures|Received disconnect.*too many authentication failures/i,
    category: "ssh",
    description: "Too many SSH authentication failures",
    fixes: [
      { id: "specify-key", command: "ssh -i ~/.ssh/specific_key user@host", description: "Specify exact key to use", priority: 1 },
      { id: "limit-keys", command: "ssh -o IdentitiesOnly=yes -i ~/.ssh/id_rsa user@host", description: "Use only specified identity", priority: 2 },
      { id: "clear-agent", command: "ssh-add -D", description: "Clear all keys from agent", priority: 3 },
    ],
  },

  // SSH KEY FORMAT ERROR
  {
    id: "ssh-key-format-error",
    regex: /invalid format|Load key.*invalid format|not a valid.*key/i,
    category: "ssh",
    description: "SSH key format error",
    fixes: [
      { id: "check-key-type", command: "file ~/.ssh/id_rsa && head -1 ~/.ssh/id_rsa", description: "Check key file type", priority: 1 },
      { id: "convert-key", command: "ssh-keygen -p -m PEM -f ~/.ssh/id_rsa", description: "Convert to PEM format", priority: 2 },
      { id: "generate-new", command: "ssh-keygen -t ed25519 -C 'your_email@example.com'", description: "Generate new key", priority: 3 },
    ],
  },

  // SSH AGENT NOT RUNNING
  {
    id: "ssh-agent-not-running",
    regex: /Could not open.*auth socket|SSH_AUTH_SOCK.*not set|Error connecting to agent/i,
    category: "ssh",
    description: "SSH agent not running",
    fixes: [
      { id: "start-agent", command: "eval $(ssh-agent -s)", description: "Start SSH agent", priority: 1 },
      { id: "add-to-shell", instructions: "Add 'eval $(ssh-agent -s)' to your shell profile", description: "Add to shell config", priority: 2 },
    ],
  },
]
