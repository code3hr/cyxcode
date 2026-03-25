# Contributing Patterns to CyxCode

CyxCode's power comes from its pattern library. The more patterns we have, the more errors we catch for free. Here's how to contribute.

## What Makes a Good Pattern?

- **Common**: The error happens frequently across projects
- **Deterministic**: The fix is the same every time (no project-specific knowledge needed)
- **Specific**: The regex matches the target error without false positives
- **Actionable**: The fix is a concrete command or clear instruction

## Pattern File Structure

Each skill has pattern files organized by category:

```
src/cyxcode/skills/
  recovery/
    patterns/
      node.ts      # Node/npm/bun errors
      git.ts       # Git errors
      python.ts    # Python/pip errors
      docker.ts    # Docker errors
      build.ts     # Build/compile errors (CMake, Make, Cargo, Go)
      system.ts    # System errors (permissions, disk, network)
  security/
    patterns/
      ssl.ts       # SSL/TLS certificate errors
      auth.ts      # Authentication/authorization errors
      ssh.ts       # SSH connection errors
      network.ts   # Network/firewall errors
      scan.ts      # Vulnerability scan output
  devops/
    patterns/
      kubernetes.ts  # Kubernetes/kubectl errors
      terraform.ts   # Terraform errors
      cicd.ts        # CI/CD pipeline errors
      cloud.ts       # AWS/GCP/Azure errors
      ansible.ts     # Ansible errors
```

## How to Contribute

### 1. Find an error that's not covered

Run into an error that CyxCode didn't catch? Perfect. Copy the exact error output.

```bash
# Enable debug mode to see what CyxCode checked
CYXCODE_DEBUG=1 bun run dev
```

If you see `total matches=0`, that error isn't covered yet.

### 2. Write the pattern

```typescript
{
  id: "category-short-description",    // e.g., "node-esbuild-target"
  regex: /the actual error regex/i,    // match the error output
  category: "category",                // must match the file's category
  description: "What the error means",
  fixes: [
    {
      id: "fix-name",
      command: "the fix command",
      description: "What the fix does",
      priority: 1,
    },
  ],
}
```

### 3. Test it

```bash
# Start CyxCode with debug mode
CYXCODE_DEBUG=1 bun run dev

# Trigger the error using shell mode (zero tokens)
# Type ! to enter shell mode, then the command that produces the error
```

### 4. Submit a PR

Include in your PR:
- The pattern(s) you added
- The exact error output that triggers each pattern
- What tool/version produces the error
- How you tested it

## Regex Tips

### Be specific but flexible

```typescript
// Too specific - only matches one version
regex: /npm ERR! code E404 at registry.npmjs.org/

// Too broad - false positives
regex: /404/

// Just right
regex: /npm ERR! code E(404|500|503)|registry.*not found/i
```

### Use capture groups for dynamic values

```typescript
regex: /Cannot find module ['"](@?[\w\/-]+)['"]/
//                          ^^^^^^^^^^^^^^^^^ captures the module name

fixes: [
  { command: "npm install $1", ... }  // $1 = captured module name
]
```

### Common regex patterns for errors

| Error type | Regex pattern |
|------------|---------------|
| "X not found" | `/(\w+).*not found/i` |
| Exit codes | `/exit(ed with)? (code\|status) (\d+)/` |
| Permission errors | `/permission denied\|EACCES\|unauthorized/i` |
| Connection errors | `/ECONNREFUSED\|connection refused\|ETIMEDOUT/i` |
| Version mismatches | `/requires.*version\|incompatible.*version/i` |

## Priority Guidelines

| Priority | When to use |
|----------|-------------|
| 1 | The most common fix for this error. Works 80%+ of the time |
| 2 | Common alternative. Different package manager or approach |
| 3 | Less common but valid. Platform-specific or edge case |
| 4+ | Rare fixes. Last resort options |

## Categories We Want More Patterns For

- **Bun** - Bun-specific error formats (not just npm format)
- **Rust/Cargo** - Common borrow checker and lifetime errors
- **Go** - Module and build errors
- **Ruby/Rails** - Gem and Rails-specific errors
- **Java/Gradle/Maven** - Build and dependency errors
- **Swift/Xcode** - iOS/macOS build errors
- **.NET/NuGet** - C# and .NET errors

## Questions?

Open an issue with the `pattern-request` label if you have an error you'd like covered but aren't sure how to write the regex.
