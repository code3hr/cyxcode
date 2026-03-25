# Adding Custom Patterns to CyxCode

CyxCode's pattern matching system is fully extensible. You can add your own error patterns to catch project-specific or tool-specific errors.

## Quick Start

1. Pick the right skill for your pattern
2. Add a pattern object to the appropriate file
3. Test with `CYXCODE_DEBUG=1`

## Pattern Structure

Every pattern follows this TypeScript interface:

```typescript
{
  id: "unique-pattern-id",              // Unique identifier
  regex: /error message regex (.+)/i,   // Regex to match error output
  category: "node",                      // Category grouping
  description: "Human-readable description",
  extractors: { variable: 0 },          // Optional: name capture groups
  fixes: [
    {
      id: "fix-id",
      command: "fix-command $1",         // $1 = first capture group
      description: "What this fix does",
      priority: 1,                       // Lower = tried first
    },
    {
      id: "manual-fix",
      instructions: "Do this manually",  // For non-command fixes
      description: "Manual fix",
      priority: 2,
    },
  ],
}
```

## Where to Add Patterns

| Skill | Category | File |
|-------|----------|------|
| Recovery | `node` | `src/cyxcode/skills/recovery/patterns/node.ts` |
| Recovery | `git` | `src/cyxcode/skills/recovery/patterns/git.ts` |
| Recovery | `python` | `src/cyxcode/skills/recovery/patterns/python.ts` |
| Recovery | `docker` | `src/cyxcode/skills/recovery/patterns/docker.ts` |
| Recovery | `build` | `src/cyxcode/skills/recovery/patterns/build.ts` |
| Recovery | `system` | `src/cyxcode/skills/recovery/patterns/system.ts` |
| Security | `ssl` | `src/cyxcode/skills/security/patterns/ssl.ts` |
| Security | `auth` | `src/cyxcode/skills/security/patterns/auth.ts` |
| Security | `ssh` | `src/cyxcode/skills/security/patterns/ssh.ts` |
| Security | `network` | `src/cyxcode/skills/security/patterns/network.ts` |
| Security | `scan` | `src/cyxcode/skills/security/patterns/scan.ts` |
| DevOps | `kubernetes` | `src/cyxcode/skills/devops/patterns/kubernetes.ts` |
| DevOps | `terraform` | `src/cyxcode/skills/devops/patterns/terraform.ts` |
| DevOps | `cicd` | `src/cyxcode/skills/devops/patterns/cicd.ts` |
| DevOps | `cloud` | `src/cyxcode/skills/devops/patterns/cloud.ts` |
| DevOps | `ansible` | `src/cyxcode/skills/devops/patterns/ansible.ts` |

All pattern files are under `packages/opencode/src/cyxcode/skills/`.

## Step-by-Step Example

Let's add a pattern for Bun's 404 error when installing a nonexistent package.

**1. The error we want to catch:**
```
error: GET https://registry.npmjs.org/nonexistent-package-xyz - 404
```

**2. Open the right file:**

This is a Node/package manager error, so: `src/cyxcode/skills/recovery/patterns/node.ts`

**3. Add the pattern to the `nodePatterns` array:**

```typescript
// BUN REGISTRY 404
{
  id: "bun-registry-404",
  regex: /error: GET https:\/\/registry\.npmjs\.org\/(\S+)\s*-\s*404/,
  category: "node",
  description: "Package not found in npm registry",
  extractors: { package: 0 },
  fixes: [
    {
      id: "check-name",
      instructions: "Check the package name for typos",
      description: "Verify package name is correct",
      priority: 1,
    },
    {
      id: "search-npm",
      command: "npm search $1",
      description: "Search npm for similar packages",
      priority: 2,
    },
  ],
},
```

**4. Test it:**

```bash
CYXCODE_DEBUG=1 bun run dev
# In the TUI, try:
# !bun install nonexistent-package-xyz
```

You should see:
```
[CyxCode] Pattern matched: bun-registry-404 (recovery)
[CyxCode] Package not found in npm registry
[CyxCode] Suggested fixes:
1. Verify package name is correct
  (manual)
2. Search npm for similar packages
  npm search nonexistent-package-xyz
```

## Capture Groups and $1 Substitution

Regex capture groups `()` are extracted and available as `$1`, `$2`, etc. in fix commands:

```typescript
regex: /Cannot find module ['"](@?[\w\/-]+)['"]/,
//                         ^^^^^^^^^^^^^^^^^ $1

fixes: [
  { command: "npm install $1", ... },  // becomes: npm install express
]
```

## Tips

- **Test your regex** on the actual error output. Copy the exact error string and test in a JS console: `yourRegex.exec(errorString)`
- **Use `i` flag** for case-insensitive matching when the error format varies
- **Keep regexes specific** enough to avoid false positives but general enough to catch variations
- **Priority matters**: lower numbers are suggested first. Put the most common fix at priority 1
- **`command` vs `instructions`**: Use `command` when the fix is a single shell command. Use `instructions` for manual steps or multi-step fixes
- Patterns are matched in order within a skill. **First match wins** across all skills

## Submitting Your Pattern

1. Fork the repo
2. Add your pattern(s) to the appropriate file
3. Test with `CYXCODE_DEBUG=1`
4. Submit a PR with:
   - The error message your pattern catches
   - Which tools/versions produce this error
   - How you tested it
