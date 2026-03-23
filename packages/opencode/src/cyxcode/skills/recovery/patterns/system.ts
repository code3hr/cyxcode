/**
 * System Error Patterns (permissions, disk, memory, network)
 * 
 * Ported from CyxMake error_patterns.c
 */

import type { Pattern } from "../../../types"

export const systemPatterns: Pattern[] = [
  // PERMISSION DENIED
  {
    id: "system-permission-denied",
    regex: /Permission denied|EACCES|Operation not permitted/i,
    category: "system",
    description: "Permission denied",
    fixes: [
      { id: "sudo", instructions: "Run with sudo if appropriate", description: "Use elevated privileges", priority: 1 },
      { id: "chown", command: "sudo chown -R $(whoami) .", description: "Change ownership to current user", priority: 2 },
      { id: "chmod", command: "chmod +x <file>", description: "Make file executable", priority: 3 },
    ],
  },

  // DISK FULL
  {
    id: "system-disk-full",
    regex: /No space left on device|ENOSPC|Disk quota exceeded/i,
    category: "system",
    description: "Disk full or quota exceeded",
    fixes: [
      { id: "check-disk", command: "df -h", description: "Check disk usage", priority: 1 },
      { id: "find-large", command: "du -sh * | sort -hr | head -20", description: "Find large files/directories", priority: 2 },
      { id: "clean-apt", command: "sudo apt autoremove && sudo apt clean", description: "Clean apt cache", priority: 3 },
    ],
  },

  // OUT OF MEMORY
  {
    id: "system-oom",
    regex: /Cannot allocate memory|ENOMEM|Out of memory|Killed.*memory/i,
    category: "system",
    description: "Out of memory",
    fixes: [
      { id: "check-memory", command: "free -h", description: "Check memory usage", priority: 1 },
      { id: "find-memory-hogs", command: "ps aux --sort=-%mem | head -10", description: "Find memory-heavy processes", priority: 2 },
    ],
  },

  // COMMAND NOT FOUND
  {
    id: "system-command-not-found",
    regex: /command not found: (\w+)|(\w+): not found/i,
    category: "system",
    description: "Command not found",
    extractors: { command: 0 },
    fixes: [
      { id: "apt-install", command: "sudo apt install $1", description: "Install with apt (Debian/Ubuntu)", priority: 1 },
      { id: "brew-install", command: "brew install $1", description: "Install with Homebrew (macOS)", priority: 2 },
      { id: "check-path", command: "echo $PATH", description: "Check PATH variable", priority: 3 },
    ],
  },

  // NETWORK UNREACHABLE
  {
    id: "system-network-unreachable",
    regex: /Network is unreachable|Could not resolve host|ENETUNREACH|Connection refused/i,
    category: "system",
    description: "Network connectivity issue",
    fixes: [
      { id: "ping-test", command: "ping -c 4 8.8.8.8", description: "Test internet connectivity", priority: 1 },
      { id: "dns-test", command: "nslookup google.com", description: "Test DNS resolution", priority: 2 },
      { id: "restart-network", command: "sudo systemctl restart NetworkManager", description: "Restart network (Linux)", priority: 3 },
    ],
  },

  // FILE NOT FOUND
  {
    id: "system-file-not-found",
    regex: /No such file or directory|ENOENT/i,
    category: "system",
    description: "File or directory not found",
    fixes: [
      { id: "check-path", instructions: "Verify the file path is correct", description: "Check file path", priority: 1 },
      { id: "find-file", command: "find . -name '<filename>'", description: "Search for file", priority: 2 },
    ],
  },

  // TOO MANY OPEN FILES
  {
    id: "system-too-many-files",
    regex: /Too many open files|EMFILE|ulimit/i,
    category: "system",
    description: "Too many open files",
    fixes: [
      { id: "check-ulimit", command: "ulimit -n", description: "Check file descriptor limit", priority: 1 },
      { id: "increase-ulimit", command: "ulimit -n 65535", description: "Increase limit (temporary)", priority: 2 },
    ],
  },

  // TIMEOUT
  {
    id: "system-timeout",
    regex: /Connection timed out|ETIMEDOUT|Operation timed out/i,
    category: "system",
    description: "Connection timeout",
    fixes: [
      { id: "retry", instructions: "Retry the operation - may be temporary network issue", description: "Retry operation", priority: 1 },
      { id: "check-firewall", command: "sudo iptables -L", description: "Check firewall rules", priority: 2 },
    ],
  },

  // PROCESS ALREADY RUNNING
  {
    id: "system-process-running",
    regex: /Address already in use|Another instance is running|lock file exists/i,
    category: "system",
    description: "Process already running",
    fixes: [
      { id: "find-process", command: "ps aux | grep <process>", description: "Find running process", priority: 1 },
      { id: "kill-process", command: "pkill -f <process>", description: "Kill process", priority: 2 },
    ],
  },
]
