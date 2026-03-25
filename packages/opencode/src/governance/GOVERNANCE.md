# Governance Engine Documentation

The Governance Engine provides centralized control over AI tool executions in cyxcode. It enforces scope restrictions, evaluates policy-based rules, and maintains comprehensive audit logs for all tool operations.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration Reference](#configuration-reference)
- [Module Reference](#module-reference)
- [Usage Examples](#usage-examples)
- [Integration Guide](#integration-guide)
- [Troubleshooting](#troubleshooting)

---

## Overview

### What is the Governance Engine?

The Governance Engine is a security layer that intercepts all tool executions before they run. It provides:

- **Scope Enforcement**: Restrict which IPs and domains tools can access
- **Policy Rules**: Define what actions to take for specific tools/commands
- **Audit Logging**: Complete audit trail of all tool executions
- **Real-time Events**: Bus events for monitoring and alerting

### When to Use Governance

Enable governance when you need to:

- Restrict AI access to internal networks only
- Block access to production systems
- Auto-approve safe, read-only operations
- Maintain compliance audit trails
- Monitor tool usage patterns

---

## Quick Start

### 1. Enable Governance

Add to your `opencode.jsonc` or project config:

```jsonc
{
  "governance": {
    "enabled": true,
    "default_action": "require-approval"
  }
}
```

### 2. Add Scope Restrictions

Limit which networks the AI can access:

```jsonc
{
  "governance": {
    "enabled": true,
    "scope": {
      "ip": {
        "allow": ["10.0.0.0/8", "192.168.0.0/16"]
      },
      "domain": {
        "allow": ["*.company.com", "github.com"],
        "deny": ["*.prod.company.com"]
      }
    }
  }
}
```

### 3. Add Policy Rules

Define actions for specific tools:

```jsonc
{
  "governance": {
    "enabled": true,
    "policies": [
      {
        "description": "Auto-approve read-only tools",
        "action": "auto-approve",
        "tools": ["read", "glob", "grep"]
      },
      {
        "description": "Block dangerous commands",
        "action": "blocked",
        "tools": ["bash"],
        "commands": ["rm -rf *", "sudo *"]
      }
    ],
    "default_action": "require-approval"
  }
}
```

---

## Architecture

### Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Tool Execution Request                      │
│                   (bash, read, webfetch, etc.)                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      1. Target Extraction                       │
│         Analyze tool arguments for IPs, domains, URLs           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       2. Scope Check                            │
│            Verify targets against allow/deny lists              │
│                                                                 │
│   ┌─────────────┐         ┌─────────────┐                      │
│   │ IP/CIDR     │         │  Domain     │                      │
│   │ Matching    │         │  Wildcards  │                      │
│   └─────────────┘         └─────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
              Scope Passed            Scope Failed
                    │                       │
                    ▼                       ▼
┌───────────────────────────┐    ┌───────────────────────┐
│   3. Policy Evaluation    │    │   DENIED              │
│   Match against rules     │    │   (Scope Violation)   │
│   First match wins        │    └───────────────────────┘
└───────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│   auto-   │ │  require- │ │  blocked  │
│  approve  │ │  approval │ │           │
└───────────┘ └───────────┘ └───────────┘
        │           │           │
        ▼           ▼           ▼
   Execute      Ask User     DENIED
   Directly     Permission   (Policy)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      4. Audit Logging                           │
│              Record outcome, publish bus events                 │
└─────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/governance/
├── index.ts      # Main entry point, orchestration
├── types.ts      # Zod schemas, TypeScript types
├── matcher.ts    # Target extraction and pattern matching
├── scope.ts      # IP/domain scope enforcement
├── policy.ts     # Policy rule evaluation
└── audit.ts      # Audit logging and events
```

---

## Configuration Reference

### Full Schema

```typescript
interface GovernanceConfig {
  // Master switch - governance is disabled by default
  enabled?: boolean  // default: false

  // Network scope restrictions
  scope?: {
    ip?: {
      allow?: string[]  // CIDR patterns: ["10.0.0.0/8"]
      deny?: string[]   // Deny takes precedence
    }
    domain?: {
      allow?: string[]  // Wildcards: ["*.company.com"]
      deny?: string[]   // Deny takes precedence
    }
  }

  // Policy rules (evaluated in order, first match wins)
  policies?: Array<{
    action: "auto-approve" | "require-approval" | "blocked"
    tools?: string[]      // Tool name patterns
    commands?: string[]   // Bash command patterns
    targets?: string[]    // Network target patterns
    description?: string  // For logs and auditing
  }>

  // Action when no policy matches
  default_action?: "auto-approve" | "require-approval" | "blocked"
  // default: "require-approval"

  // Audit logging configuration
  audit?: {
    enabled?: boolean        // default: true
    storage?: "file" | "memory"  // default: "file"
    retention?: number       // Days to keep logs
    include_args?: boolean   // Log tool arguments (privacy)
  }
}
```

### Configuration Options

#### `enabled`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Master switch for governance. Must be explicitly set to `true`.

#### `scope.ip.allow` / `scope.ip.deny`
- **Type**: `string[]`
- **Format**: CIDR notation (`10.0.0.0/8`, `192.168.1.0/24`)
- **Description**: IP address restrictions. Deny rules are checked first.

#### `scope.domain.allow` / `scope.domain.deny`
- **Type**: `string[]`
- **Format**: Wildcard patterns (`*.example.com`, `api.github.com`)
- **Description**: Domain restrictions. Deny rules are checked first.

#### `policies[].action`
- **Type**: `"auto-approve" | "require-approval" | "blocked"`
- **Description**:
  - `auto-approve`: Execute without user confirmation
  - `require-approval`: Ask user for permission (existing behavior)
  - `blocked`: Deny execution entirely

#### `policies[].tools`
- **Type**: `string[]`
- **Format**: Wildcard patterns (`bash`, `read`, `mcp_*`)
- **Description**: Match tool names

#### `policies[].commands`
- **Type**: `string[]`
- **Format**: Wildcard patterns (`ssh *`, `curl *`, `rm -rf *`)
- **Description**: Match bash command strings (only applies when tool is `bash`)

#### `policies[].targets`
- **Type**: `string[]`
- **Format**: CIDR or wildcard patterns
- **Description**: Match extracted network targets

#### `default_action`
- **Type**: `"auto-approve" | "require-approval" | "blocked"`
- **Default**: `"require-approval"`
- **Description**: Action when no policy matches

#### `audit.storage`
- **Type**: `"file" | "memory"`
- **Default**: `"file"`
- **Description**: Where to store audit entries

#### `audit.include_args`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Include tool arguments in audit logs (may contain sensitive data)

---

## Module Reference

### Types (`types.ts`)

Core type definitions using Zod schemas.

| Type | Description |
|------|-------------|
| `Outcome` | `"allowed"` \| `"denied"` \| `"pending-approval"` \| `"error"` |
| `TargetType` | `"ip"` \| `"cidr"` \| `"domain"` \| `"url"` \| `"unknown"` |
| `Target` | `{ raw: string, type: TargetType, normalized: string }` |
| `AuditEntry` | Complete audit record with id, timestamp, tool, outcome, etc. |
| `CheckRequest` | Input to `Governance.check()` |
| `CheckResult` | Output from `Governance.check()` |

**Bus Events:**
- `governance.checked` - Published after every governance check
- `governance.policy_violation` - Published when a tool is denied

### Matcher (`matcher.ts`)

Target extraction and pattern matching utilities.

| Function | Description |
|----------|-------------|
| `classifyTarget(raw)` | Classify string as IP, CIDR, domain, URL, or unknown |
| `extractTargets(tool, args)` | Extract network targets from tool arguments |
| `ipInCidr(ip, cidr)` | Check if IP falls within CIDR range |
| `matchTarget(target, pattern)` | Match target against pattern |

**Tool-specific extraction:**
- `bash`: Analyzes command for URLs, IPs, SSH patterns (`user@host`), and common tools (curl, wget, ssh, etc.)
- `webfetch`: Extracts the `url` argument directly
- `websearch`: No network targets (search queries)
- Other tools: Scans all string argument values

### Scope (`scope.ts`)

Network scope enforcement.

| Function | Description |
|----------|-------------|
| `check(targets, scope)` | Validate all targets against scope configuration |

**Evaluation order:**
1. Check deny list first - if matches, immediately deny
2. Check allow list - if exists and doesn't match, deny
3. Default to allow

### Policy (`policy.ts`)

Policy rule evaluation.

| Function | Description |
|----------|-------------|
| `evaluate(tool, args, targets, policies, defaultAction)` | Evaluate policies, return action |
| `describe(policy)` | Get human-readable policy description |

**Matching rules (AND logic):**
- `tools`: Tool name must match at least one pattern
- `commands`: Bash command must match at least one pattern
- `targets`: At least one target must match at least one pattern

**First match wins** - policy order matters!

### Audit (`audit.ts`)

Audit logging and querying.

| Function | Description |
|----------|-------------|
| `record(entry, config)` | Record an audit entry |
| `list(config, options)` | Query audit entries with filters |
| `get(id)` | Get single audit entry by ID |
| `clearMemory()` | Clear in-memory buffer (testing) |
| `memoryCount()` | Get count of entries in memory |

### Main (`index.ts`)

Main entry point and orchestration.

| Export | Description |
|--------|-------------|
| `Governance.check(request, config)` | Main governance check function |
| `Governance.isEnabled(config)` | Check if governance is enabled |
| `Governance.DeniedError` | Error thrown when tool is blocked |
| `Governance.Types` | Re-export of types namespace |
| `Governance.Scope` | Re-export of scope namespace |
| `Governance.Policy` | Re-export of policy namespace |
| `Governance.Audit` | Re-export of audit namespace |
| `Governance.Matcher` | Re-export of matcher namespace |

---

## Usage Examples

### Basic Governance Check

```typescript
import { Governance } from "./governance"
import { Config } from "./config/config"

const config = await Config.get()

const result = await Governance.check(
  {
    sessionID: "session_abc",
    callID: "call_123",
    tool: "bash",
    args: { command: "curl https://api.example.com/data" }
  },
  config.governance
)

if (!result.allowed) {
  console.log(`Blocked: ${result.reason}`)
  console.log(`Policy: ${result.matchedPolicy}`)
}
```

### Subscribe to Governance Events

```typescript
import { Bus } from "./bus"
import { Governance } from "./governance"

// Monitor all governance checks
Bus.subscribe(Governance.Types.Event.Checked, ({ entry }) => {
  console.log(`[${entry.outcome}] ${entry.tool}`)
  if (entry.targets.length > 0) {
    console.log(`  Targets: ${entry.targets.map(t => t.normalized).join(", ")}`)
  }
})

// Alert on policy violations
Bus.subscribe(Governance.Types.Event.PolicyViolation, ({ entry, policy }) => {
  sendAlert({
    title: "Governance Policy Violation",
    tool: entry.tool,
    policy: policy,
    reason: entry.reason,
    timestamp: entry.timestamp
  })
})
```

### Query Audit Logs

```typescript
import { Governance } from "./governance"

// Get recent denied entries
const denied = await Governance.Audit.list(config.audit, {
  limit: 50,
  outcome: "denied"
})

for (const entry of denied) {
  console.log(`${new Date(entry.timestamp).toISOString()} - ${entry.tool}`)
  console.log(`  Reason: ${entry.reason}`)
  console.log(`  Policy: ${entry.policy || "scope violation"}`)
}

// Get all entries for a specific session
const sessionLogs = await Governance.Audit.list(config.audit, {
  sessionID: "session_abc"
})
```

### Custom Target Classification

```typescript
import { Governance } from "./governance"

// Classify a string
const target = Governance.Matcher.classifyTarget("192.168.1.100")
console.log(target)
// { raw: "192.168.1.100", type: "ip", normalized: "192.168.1.100" }

// Check CIDR membership
const inRange = Governance.Matcher.ipInCidr("192.168.1.100", "192.168.0.0/16")
console.log(inRange) // true

// Extract targets from bash command
const targets = Governance.Matcher.extractTargets("bash", {
  command: "ssh admin@server.prod.company.com && curl https://api.example.com"
})
// [
//   { raw: "server.prod.company.com", type: "domain", normalized: "server.prod.company.com" },
//   { raw: "https://api.example.com", type: "url", normalized: "api.example.com" }
// ]
```

---

## Integration Guide

### How Governance Integrates with cyxcode

The governance engine hooks into the plugin system:

```
User Request → AI generates tool call → Plugin.trigger("tool.execute.before")
                                                      ↓
                                              Governance.check()
                                                      ↓
                                         ┌───────────┴───────────┐
                                         ↓                       ↓
                                      Allowed                 Denied
                                         ↓                       ↓
                                   Execute tool         Return error message
                                         ↓                       ↓
                               Plugin.trigger("tool.execute.after")
                                         ↓
                                   Return result to AI
```

### Files Modified for Integration

| File | Integration Point |
|------|-------------------|
| `src/plugin/index.ts` | Governance check in `trigger()` function |
| `src/session/prompt.ts` | `GovernanceDeniedError` handling |
| `src/config/config.ts` | Governance schema in config |

### Plugin Integration (`plugin/index.ts`)

```typescript
export async function trigger(name, input, output) {
  // Governance check before tool execution
  if (name === "tool.execute.before") {
    const config = await Config.get()
    if (Governance.isEnabled(config.governance)) {
      const result = await Governance.check(
        {
          tool: input.tool,
          args: input.args,
          sessionID: input.sessionID,
          callID: input.callID,
        },
        config.governance
      )

      if (!result.allowed) {
        throw new Governance.DeniedError(result)
      }
    }
  }

  // Continue with plugin hooks...
}
```

### Error Handling (`session/prompt.ts`)

```typescript
async execute(args, options) {
  try {
    await Plugin.trigger("tool.execute.before", { tool, args, ... })
  } catch (err) {
    if (err instanceof Governance.DeniedError) {
      return {
        output: `[GOVERNANCE DENIED] Tool "${tool}" was blocked.
Reason: ${err.result.reason}
Policy: ${err.result.matchedPolicy || "scope violation"}`,
        metadata: { governance: { denied: true, ...err.result } }
      }
    }
    throw err
  }

  // Execute the tool...
}
```

---

## Troubleshooting

### Common Issues

#### "Governance disabled" in logs
**Cause**: Governance is not enabled in config.
**Solution**: Set `"enabled": true` in your governance config.

#### Tools blocked unexpectedly
**Cause**: Scope or policy rules are too restrictive.
**Solution**:
1. Check audit logs: `Governance.Audit.list(config.audit, { outcome: "denied" })`
2. Review the `reason` field to understand why
3. Adjust scope or policies accordingly

#### Policies not matching as expected
**Cause**: Policy order matters - first match wins.
**Solution**: Place more specific policies before general ones.

```jsonc
// WRONG - general policy matches first
{
  "policies": [
    { "action": "require-approval", "tools": ["bash"] },
    { "action": "blocked", "tools": ["bash"], "commands": ["rm -rf *"] }
  ]
}

// CORRECT - specific policy first
{
  "policies": [
    { "action": "blocked", "tools": ["bash"], "commands": ["rm -rf *"] },
    { "action": "require-approval", "tools": ["bash"] }
  ]
}
```

#### Targets not being extracted from bash commands
**Cause**: The command pattern isn't recognized.
**Solution**: The matcher looks for:
- URLs (`http://`, `https://`)
- IP addresses (`192.168.1.1`)
- CIDR notation (`10.0.0.0/8`)
- SSH patterns (`user@host`)
- Common tool invocations (`curl`, `wget`, `ssh`, etc.)

If your command uses a different pattern, the target may not be extracted.

### Debug Logging

Enable debug logging to see governance decisions:

```typescript
// In your config or environment
LOG_LEVEL=debug
```

This will show:
- Target extraction results
- Scope check details
- Policy matching process
- Audit entry creation

### Testing Governance

```typescript
// Test scope checking
const targets = [
  { raw: "10.0.0.5", type: "ip", normalized: "10.0.0.5" }
]
const scopeResult = Governance.Scope.check(targets, {
  ip: { allow: ["10.0.0.0/8"] }
})
console.log(scopeResult) // { allowed: true }

// Test policy evaluation
const policyResult = Governance.Policy.evaluate(
  "bash",
  { command: "ls -la" },
  [],
  [{ action: "auto-approve", tools: ["bash"], commands: ["ls *"] }],
  "require-approval"
)
console.log(policyResult) // { action: "auto-approve", matchedPolicy: "Policy #1", ... }
```

---

## Appendix

### Pattern Matching Reference

| Pattern | Matches | Does Not Match |
|---------|---------|----------------|
| `*.example.com` | `api.example.com`, `www.example.com` | `example.com` |
| `example.com` | `example.com` | `api.example.com` |
| `10.0.0.0/8` | `10.1.2.3`, `10.255.255.255` | `11.0.0.0` |
| `192.168.1.0/24` | `192.168.1.1`, `192.168.1.255` | `192.168.2.1` |
| `ssh *` | `ssh user@host`, `ssh -p 22 host` | `sshd`, `openssh` |
| `curl *` | `curl https://api.com`, `curl -X POST` | `curling` |

### Outcome Reference

| Outcome | Description | Tool Executes? |
|---------|-------------|----------------|
| `allowed` | Auto-approved by policy | Yes |
| `pending-approval` | Requires user permission | If user approves |
| `denied` | Blocked by scope or policy | No |
| `error` | Error during governance check | No |

### Event Reference

| Event | When Published | Payload |
|-------|----------------|---------|
| `governance.checked` | After every check | `{ entry: AuditEntry }` |
| `governance.policy_violation` | When denied | `{ entry: AuditEntry, policy: string }` |
