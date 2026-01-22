# Phase 18: CI/CD Security Integration

## Overview

Phase 18 implements a comprehensive CI/CD pipeline security scanner module for the pentest framework. It provides security analysis for GitHub Actions, GitLab CI, and Jenkins pipelines with support for secret detection, permission analysis, injection vulnerability detection, supply chain security checks, and SAST tool integration.

## Features

### Pipeline Providers

- **GitHub Actions**: Full workflow YAML parsing with jobs, steps, permissions, triggers
- **GitLab CI/CD**: Pipeline parsing including stages, includes, variables, rules
- **Jenkins**: Declarative and scripted Jenkinsfile parsing with shared library detection

### Security Checks

| Check Category | Description | Severity Range |
|---------------|-------------|----------------|
| **Secrets** | Hardcoded API keys, tokens, passwords, private keys | Critical-Medium |
| **Permissions** | Overly permissive GITHUB_TOKEN, write-all access | Critical-Low |
| **Injection** | Command injection via PR titles/bodies, commit messages | Critical-High |
| **Supply Chain** | Unpinned actions, untrusted third-party dependencies | High-Medium |
| **Misconfiguration** | Self-hosted runner risks, missing security scans | High-Medium |

### SAST Integration

- **Semgrep**: Configurable rulesets for CI/CD security patterns
- **Gitleaks**: Secret detection with entropy analysis and git history scanning

### Security Gates

Configurable pass/fail criteria with:
- Severity thresholds (max critical, high, medium, low)
- Category-specific rules (fail on secrets, warn on supply chain)
- Custom rule definitions

## Module Structure

```
packages/opencode/src/pentest/cicd/
├── index.ts                    # Module exports
├── types.ts                    # Zod schemas (~450 lines)
├── events.ts                   # Bus events (~100 lines)
├── storage.ts                  # Persistence layer (~200 lines)
├── profiles.ts                 # Scan profiles (~180 lines)
├── orchestrator.ts             # Main scan coordination (~350 lines)
├── tool.ts                     # Agent tool definition (~280 lines)
├── gates.ts                    # Security gate enforcement (~250 lines)
│
├── providers/
│   ├── index.ts                # Provider exports
│   ├── base.ts                 # Base provider interface (~180 lines)
│   ├── github.ts               # GitHub Actions analyzer (~350 lines)
│   ├── gitlab.ts               # GitLab CI/CD analyzer (~300 lines)
│   └── jenkins.ts              # Jenkins pipeline analyzer (~575 lines)
│
├── checks/
│   ├── index.ts                # Check exports (~120 lines)
│   ├── secrets.ts              # Secret detection (~270 lines)
│   ├── permissions.ts          # Permission analysis (~280 lines)
│   ├── injection.ts            # Command injection risks (~320 lines)
│   └── supply-chain.ts         # Supply chain checks (~270 lines)
│
└── sast/
    ├── index.ts                # SAST orchestration (~280 lines)
    ├── semgrep.ts              # Semgrep integration (~410 lines)
    └── gitleaks.ts             # Gitleaks integration (~400 lines)

Total: ~21 files, ~5,300+ lines
```

## Tool Usage

### Actions

```bash
# Discover CI/CD pipelines
cicd discover target="/path/to/repo"

# Full security scan
cicd scan target="/path/to/repo" profile="standard"

# Secret detection only
cicd check-secrets target="/path/to/repo"

# Permission analysis only
cicd check-permissions target="/path/to/repo"

# SAST tools
cicd sast target="/path/to/repo" tools=["semgrep","gitleaks"]

# Security gate evaluation
cicd gate scanId="cicd_xxx"

# List profiles
cicd profiles
```

### Scan Profiles

| Profile | Checks | SAST | Gate | Use Case |
|---------|--------|------|------|----------|
| discovery | - | - | - | Enumerate pipelines only |
| quick | secrets, permissions | - | - | Fast assessment |
| standard | all checks | - | yes | Balanced scan |
| thorough | all checks | yes | yes | Full audit |
| compliance | all checks | - | yes | Regulatory checks |

## Key Types

### CICDScanResult

```typescript
interface CICDScanResult {
  id: string
  target: string
  profile: ProfileId
  status: Status
  pipelines: PipelineConfig[]
  findings: CICDFinding[]
  gateResult?: GateResult
  sastResults: SASTResult[]
  stats: ScanStats
}
```

### CICDFinding

```typescript
interface CICDFinding {
  id: string
  category: FindingCategory  // secrets | permissions | injection | supply-chain | ...
  severity: Severity         // critical | high | medium | low | info
  title: string
  description: string
  file: string
  line?: number
  pipeline?: string
  job?: string
  remediation?: string
  cwe?: string
}
```

### GateConfig

```typescript
interface GateConfig {
  enabled: boolean
  blockOnCritical: boolean  // Any critical = fail
  blockOnHigh: boolean      // Any high = fail
  maxCritical: number       // Threshold
  maxHigh: number
  maxMedium: number
  rules: GateRule[]
}
```

## Security Check Details

### Secret Detection Patterns

| Pattern | Example | Severity |
|---------|---------|----------|
| GitHub Token | `ghp_xxxx...` | Critical |
| AWS Access Key | `AKIA...` | Critical |
| Private Key | `-----BEGIN PRIVATE KEY-----` | Critical |
| Generic API Key | `api_key: xxx` | Medium |
| High Entropy | Long random strings | Medium |

### Dangerous GitHub Contexts (Injection)

```
github.event.pull_request.title
github.event.pull_request.body
github.event.issue.title
github.event.issue.body
github.event.comment.body
github.head_ref
github.event.head_commit.message
```

### Supply Chain Checks

- Unpinned actions (using tags instead of SHA)
- Untrusted third-party actions
- `curl | bash` patterns
- Unpinned Docker images

## Events

| Event | Description |
|-------|-------------|
| `pentest.cicd.discovery_started` | Pipeline discovery begins |
| `pentest.cicd.pipeline_discovered` | Pipeline config found |
| `pentest.cicd.scan_started` | Security scan begins |
| `pentest.cicd.secret_detected` | Hardcoded secret found |
| `pentest.cicd.injection_risk` | Injection vulnerability found |
| `pentest.cicd.sast_completed` | SAST tools finished |
| `pentest.cicd.gate_evaluated` | Security gate result |
| `pentest.cicd.scan_completed` | Scan finished |

## Default Security Gate Rules

```typescript
{
  blockOnCritical: true,
  blockOnHigh: false,
  maxCritical: 0,
  maxHigh: 5,
  maxMedium: 20,
  rules: [
    { id: "no-secrets", category: "secrets", action: "fail" },
    { id: "no-injection", category: "injection", action: "fail" },
    { id: "pin-actions", category: "supply-chain", action: "warn" },
  ]
}
```

## Integration with External Tools

### Semgrep

Requires installation: `pip install semgrep`

Rulesets used:
- `p/github-actions`
- `p/gitlab`
- `p/supply-chain`
- `p/secrets`

### Gitleaks

Requires installation: `brew install gitleaks` or download from GitHub

Features:
- Current state scanning (default)
- Git history scanning (optional)
- Custom configuration support

## Code Examples

### Basic Pipeline Discovery

```typescript
import { CICDOrchestrator } from "./pentest/cicd"

// Discover all CI/CD pipelines in a repository
const discovery = await CICDOrchestrator.discover("/path/to/repo")

console.log(`Found ${discovery.pipelines.length} pipelines:`)
for (const pipeline of discovery.pipelines) {
  console.log(`  - ${pipeline.provider}: ${pipeline.path}`)
}
```

### Full Security Scan

```typescript
import { CICDOrchestrator } from "./pentest/cicd"

// Run a comprehensive security scan
const result = await CICDOrchestrator.scan({
  target: "/path/to/repo",
  profile: "standard",
})

console.log(`Scan completed: ${result.status}`)
console.log(`Findings: ${result.findings.length}`)
console.log(`  Critical: ${result.stats.bySeverity.critical}`)
console.log(`  High: ${result.stats.bySeverity.high}`)

// Check gate result
if (result.gateResult) {
  console.log(`Gate: ${result.gateResult.status}`)
  if (!result.gateResult.passed) {
    console.log(`Blocked by: ${result.gateResult.failedRules.join(", ")}`)
  }
}
```

### Secret Detection Only

```typescript
import { SecretsCheck } from "./pentest/cicd/checks/secrets"
import { promises as fs } from "fs"

const content = await fs.readFile(".github/workflows/ci.yml", "utf-8")
const result = SecretsCheck.detect(content, ".github/workflows/ci.yml")

for (const finding of result.findings) {
  console.log(`[${finding.severity}] ${finding.patternName}`)
  console.log(`  File: ${finding.file}:${finding.line}`)
  console.log(`  Value: ${finding.redacted}`)
}
```

### Check for Injection Vulnerabilities

```typescript
import { InjectionCheck } from "./pentest/cicd/checks/injection"
import { GitHubProvider } from "./pentest/cicd/providers/github"

const content = `
name: PR Check
on: pull_request

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - run: echo "PR Title: \${{ github.event.pull_request.title }}"
`

const parseResult = GitHubProvider.parse(content, ".github/workflows/pr.yml")
if (parseResult.success && parseResult.pipeline) {
  const injection = InjectionCheck.detect(parseResult.pipeline)

  for (const finding of injection.findings) {
    console.log(`[${finding.severity}] ${finding.title}`)
    console.log(`  ${finding.description}`)
    console.log(`  Remediation: ${finding.remediation}`)
  }
}
```

### Supply Chain Analysis

```typescript
import { SupplyChainCheck } from "./pentest/cicd/checks/supply-chain"

const result = SupplyChainCheck.check(pipeline, {
  requirePinning: true,
  trustedPrefixes: ["actions/", "github/", "my-org/"],
})

console.log(`Actions analyzed: ${result.actionsAnalyzed}`)
console.log(`Unpinned: ${result.unpinnedActions}`)
console.log(`Untrusted: ${result.untrustedActions}`)

for (const finding of result.findings) {
  if (finding.severity === "high") {
    console.log(`⚠️  ${finding.title}`)
    console.log(`   ${finding.remediation}`)
  }
}
```

### SAST Integration

```typescript
import { SASTOrchestrator } from "./pentest/cicd/sast"

// Check tool availability
const available = await SASTOrchestrator.checkAvailability()
console.log("Available tools:", Object.entries(available)
  .filter(([_, v]) => v).map(([k]) => k))

// Run SAST scan
const result = await SASTOrchestrator.run({
  tools: ["semgrep", "gitleaks"],
  target: "/path/to/repo",
  gitleaks: {
    history: true,
    depth: 50,
  },
})

console.log(`SAST completed in ${result.stats.duration}ms`)
console.log(`Total findings: ${result.stats.totalFindings}`)
```

### Custom Security Gate

```typescript
import { SecurityGates } from "./pentest/cicd/gates"

const gateConfig = {
  enabled: true,
  blockOnCritical: true,
  blockOnHigh: true,
  maxCritical: 0,
  maxHigh: 0,
  maxMedium: 10,
  rules: [
    { id: "no-secrets", category: "secrets", action: "fail" },
    { id: "no-injection", category: "injection", action: "fail" },
    { id: "pin-actions", category: "supply-chain", action: "fail" },
    { id: "check-permissions", category: "permissions", action: "warn" },
  ],
}

const gateResult = SecurityGates.evaluate(scanResult.findings, gateConfig)

if (gateResult.passed) {
  console.log("✅ Security gate PASSED")
} else {
  console.log("❌ Security gate FAILED")
  console.log(`  Failed rules: ${gateResult.failedRules.length}`)
  console.log(`  Warnings: ${gateResult.warnedRules.length}`)
}
```

### Event Subscription

```typescript
import { Bus } from "./bus"
import { CICDEvents } from "./pentest/cicd/events"

// Subscribe to findings in real-time
Bus.subscribe(CICDEvents.SecretDetected, (event) => {
  console.log(`🔐 Secret found: ${event.patternName}`)
  console.log(`   File: ${event.file}:${event.line}`)
})

Bus.subscribe(CICDEvents.InjectionRisk, (event) => {
  console.log(`💉 Injection risk: ${event.type}`)
  console.log(`   Source: ${event.source}`)
})

Bus.subscribe(CICDEvents.GateEvaluated, (event) => {
  const icon = event.passed ? "✅" : "❌"
  console.log(`${icon} Gate ${event.status}: ${event.message}`)
})
```

### Parsing Different Providers

```typescript
import { GitHubProvider, GitLabProvider, JenkinsProvider } from "./pentest/cicd/providers"

// GitHub Actions
const ghResult = GitHubProvider.parse(workflowYaml, ".github/workflows/ci.yml")

// GitLab CI
const glResult = GitLabProvider.parse(gitlabCiYaml, ".gitlab-ci.yml")

// Jenkins
const jkResult = JenkinsProvider.parse(jenkinsfile, "Jenkinsfile")

// All providers implement the same interface
for (const result of [ghResult, glResult, jkResult]) {
  if (result.success && result.pipeline) {
    console.log(`Provider: ${result.pipeline.provider}`)
    console.log(`Jobs: ${result.pipeline.jobs.length}`)
    console.log(`Secrets referenced: ${result.pipeline.secrets.length}`)
  }
}
```

## Future Enhancements

- Azure DevOps pipeline support
- CircleCI pipeline support
- Tekton pipeline support
- ArgoCD security analysis
- GitHub Advanced Security integration
- Custom Semgrep rule authoring
- SARIF export format
- Integration with security dashboards

## References

- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [GitLab CI/CD Security](https://docs.gitlab.com/ee/ci/pipelines/pipeline_security.html)
- [Jenkins Security](https://www.jenkins.io/doc/book/security/)
- [GitHub Security Lab - Script Injection](https://securitylab.github.com/research/github-actions-untrusted-input/)
- [OWASP CI/CD Security](https://owasp.org/www-project-devsecops-guideline/)
