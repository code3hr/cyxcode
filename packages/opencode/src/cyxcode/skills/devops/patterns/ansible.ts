/**
 * Ansible Error Patterns
 */

import type { Pattern } from "../../../types"

export const ansiblePatterns: Pattern[] = [
  // HOST UNREACHABLE
  {
    id: "ansible-unreachable",
    regex: /UNREACHABLE!|Failed to connect to the host|Connection refused.*ansible/i,
    category: "ansible",
    description: "Ansible host unreachable",
    fixes: [
      { id: "ping-host", command: "ansible $host -m ping", description: "Test host connectivity", priority: 1 },
      { id: "check-ssh", command: "ssh -v $host exit", description: "Test SSH connection", priority: 2 },
      { id: "check-inventory", command: "ansible-inventory --list | jq .", description: "Verify inventory", priority: 3 },
    ],
  },

  // MODULE NOT FOUND
  {
    id: "ansible-module-not-found",
    regex: /couldn't resolve module|MODULE FAILURE|The module.*was not found/i,
    category: "ansible",
    description: "Ansible module not found",
    fixes: [
      { id: "install-collection", command: "ansible-galaxy collection install $collection", description: "Install collection", priority: 1 },
      { id: "list-modules", command: "ansible-doc -l | grep $module", description: "Search for module", priority: 2 },
    ],
  },

  // SYNTAX ERROR
  {
    id: "ansible-syntax-error",
    regex: /Syntax Error|YAML syntax error|couldn't parse|AnsibleParserError/i,
    category: "ansible",
    description: "Ansible playbook syntax error",
    fixes: [
      { id: "syntax-check", command: "ansible-playbook --syntax-check $playbook", description: "Syntax check playbook", priority: 1 },
      { id: "lint-playbook", command: "ansible-lint $playbook", description: "Lint playbook", priority: 2 },
    ],
  },

  // PERMISSION DENIED
  {
    id: "ansible-permission-denied",
    regex: /Permission denied|sudo.*password|BECOME password/i,
    category: "ansible",
    description: "Ansible permission denied",
    fixes: [
      { id: "ask-become-pass", command: "ansible-playbook $playbook --ask-become-pass", description: "Prompt for sudo password", priority: 1 },
      { id: "check-sudoers", instructions: "Add NOPASSWD to sudoers for ansible user", description: "Configure sudoers", priority: 2 },
    ],
  },

  // VARIABLE UNDEFINED
  {
    id: "ansible-undefined-var",
    regex: /is undefined|AnsibleUndefinedVariable|'.*' is not defined/i,
    category: "ansible",
    description: "Ansible undefined variable",
    fixes: [
      { id: "debug-vars", command: "ansible-playbook $playbook -e 'debug=true' --check", description: "Debug mode check", priority: 1 },
      { id: "list-vars", command: "ansible $host -m debug -a 'var=hostvars[inventory_hostname]'", description: "List host vars", priority: 2 },
    ],
  },

  // TASK FAILED
  {
    id: "ansible-task-failed",
    regex: /fatal:.*FAILED!|failed=1|"failed": true|non-zero return code/i,
    category: "ansible",
    description: "Ansible task failed",
    fixes: [
      { id: "verbose-run", command: "ansible-playbook $playbook -vvv", description: "Run with verbose output", priority: 1 },
      { id: "ignore-errors", instructions: "Add 'ignore_errors: yes' to task if failure is acceptable", description: "Ignore errors", priority: 2 },
    ],
  },

  // VAULT ERROR
  {
    id: "ansible-vault-error",
    regex: /Decryption failed|Vault password.*required|vault.*decrypt/i,
    category: "ansible",
    description: "Ansible vault decryption error",
    fixes: [
      { id: "ask-vault-pass", command: "ansible-playbook $playbook --ask-vault-pass", description: "Prompt for vault password", priority: 1 },
      { id: "vault-password-file", command: "ansible-playbook $playbook --vault-password-file=.vault_pass", description: "Use password file", priority: 2 },
    ],
  },

  // INVENTORY ERROR
  {
    id: "ansible-inventory-error",
    regex: /Unable to parse.*inventory|Host not found|Could not match supplied host/i,
    category: "ansible",
    description: "Ansible inventory error",
    fixes: [
      { id: "list-inventory", command: "ansible-inventory --list", description: "List inventory", priority: 1 },
      { id: "graph-inventory", command: "ansible-inventory --graph", description: "Show inventory graph", priority: 2 },
    ],
  },
]
