# Phase 11: Cloud Security Scanner

## Overview

The Cloud Security Scanner module (`pentest/cloudscan`) provides comprehensive cloud infrastructure security testing capabilities across major cloud providers:

- **AWS**: IAM analysis, S3 bucket security, Security Groups, EC2 instances, Lambda functions
- **Azure**: RBAC analysis, Storage accounts, Network Security Groups, VMs, Function Apps
- **GCP**: IAM/Service accounts, Cloud Storage, Firewall rules, GCE instances, Cloud Functions
- **Compliance**: CIS Benchmarks, NIST, PCI-DSS, HIPAA, SOC2, GDPR, ISO27001
- **External Tools**: Prowler, ScoutSuite integration

## Module Structure

```
src/pentest/cloudscan/
├── index.ts              # Module exports
├── types.ts              # Zod schemas (40+ types)
├── events.ts             # BusEvent definitions (25+ events)
├── storage.ts            # Scan persistence
├── profiles.ts           # Scan profile definitions
├── tool.ts               # CloudScanTool for agent
├── orchestrator.ts       # Scan workflow coordination
├── discovery.ts          # Cloud resource enumeration
├── compliance.ts         # Compliance framework checker
├── parsers/
│   ├── index.ts          # Parser exports
│   ├── aws-cli.ts        # AWS CLI JSON parser
│   ├── azure-cli.ts      # Azure CLI JSON parser
│   ├── gcloud.ts         # gcloud CLI JSON parser
│   ├── prowler.ts        # Prowler output parser
│   └── scoutsuite.ts     # ScoutSuite output parser
├── aws/
│   ├── index.ts          # AWS module exports
│   ├── iam.ts            # IAM enumeration & analysis
│   ├── s3.ts             # S3 bucket security
│   ├── security-groups.ts # Security group analysis
│   ├── ec2.ts            # EC2 instance security
│   └── lambda.ts         # Lambda function security
├── azure/
│   ├── index.ts          # Azure module exports
│   ├── rbac.ts           # RBAC analysis
│   ├── storage.ts        # Storage account security
│   ├── nsg.ts            # Network Security Groups
│   └── vm.ts             # VM and Function App security
└── gcp/
    ├── index.ts          # GCP module exports
    ├── iam.ts            # IAM & service accounts
    ├── gcs.ts            # Cloud Storage security
    ├── firewall.ts       # Firewall rule analysis
    └── compute.ts        # GCE & Cloud Functions
```

## Usage

### AWS Security Scanning

```typescript
import { AWSIAM, AWSS3, AWSSecurityGroups, AWSEC2, AWSLambda } from "./pentest/cloudscan"

// IAM enumeration and analysis
const iamResult = await AWSIAM.enumerate("scan_123", {
  profile: "production",
  region: "us-east-1",
})

console.log(`Users: ${iamResult.users.length}`)
console.log(`Roles: ${iamResult.roles.length}`)
console.log(`Policies: ${iamResult.policies.length}`)
console.log(`Issues: ${iamResult.issues.length}`)

// Check for users without MFA
const noMFA = await AWSIAM.getUsersWithoutMFA({ profile: "production" })
console.log(`Users without MFA: ${noMFA.length}`)

// Check for old access keys
const oldKeys = await AWSIAM.getUsersWithOldAccessKeys(90, { profile: "production" })

// S3 bucket security analysis
const s3Result = await AWSS3.enumerate("scan_123", { profile: "production" })

// Get public buckets
const publicBuckets = await AWSS3.getPublicBuckets({ profile: "production" })
console.log(`Public buckets: ${publicBuckets.length}`)

// Get unencrypted buckets
const unencrypted = await AWSS3.getUnencryptedBuckets({ profile: "production" })

// Security group analysis
const sgResult = await AWSSecurityGroups.enumerate("scan_123", {
  profile: "production",
  region: "us-east-1",
})

// Get groups with public SSH
const publicSSH = await AWSSecurityGroups.getGroupsWithPublicPort(22, {
  profile: "production",
  region: "us-east-1",
})

// EC2 instance analysis
const ec2Result = await AWSEC2.enumerate("scan_123", {
  profile: "production",
  region: "us-east-1",
})

// Get instances without IMDSv2
const noIMDSv2 = await AWSEC2.getInstancesWithoutIMDSv2({
  profile: "production",
  region: "us-east-1",
})

// Lambda function analysis
const lambdaResult = await AWSLambda.enumerate("scan_123", {
  profile: "production",
  region: "us-east-1",
})

// Get public Lambda functions
const publicFunctions = await AWSLambda.getPublicFunctions({
  profile: "production",
  region: "us-east-1",
})
```

### Azure Security Scanning

```typescript
import { AzureRBAC, AzureStorage, AzureNSG, AzureVM } from "./pentest/cloudscan"

// RBAC analysis
const rbacResult = await AzureRBAC.enumerate("scan_123", {
  subscriptionId: "sub-123",
})

console.log(`Users: ${rbacResult.users.length}`)
console.log(`Service Principals: ${rbacResult.servicePrincipals.length}`)
console.log(`Role Assignments: ${rbacResult.roleAssignments.length}`)

// Get high-privilege assignments
const highPriv = await AzureRBAC.getHighPrivilegeAssignments({
  subscriptionId: "sub-123",
})

// Storage account analysis
const storageResult = await AzureStorage.enumerate("scan_123", {
  subscriptionId: "sub-123",
})

// Get storage accounts with public access
const publicStorage = await AzureStorage.getPublicStorageAccounts({
  subscriptionId: "sub-123",
})

// NSG analysis
const nsgResult = await AzureNSG.enumerate("scan_123", {
  subscriptionId: "sub-123",
})

// Get NSGs with unrestricted ingress
const publicNSGs = await AzureNSG.getNSGsWithPublicIngress({
  subscriptionId: "sub-123",
})

// VM analysis
const vmResult = await AzureVM.enumerate("scan_123", {
  subscriptionId: "sub-123",
})

// Get VMs without managed identity
const noIdentity = await AzureVM.getVMsWithoutManagedIdentity({
  subscriptionId: "sub-123",
})
```

### GCP Security Scanning

```typescript
import { GCPIAM, GCPGCS, GCPFirewall, GCPCompute } from "./pentest/cloudscan"

// IAM analysis
const iamResult = await GCPIAM.enumerate("scan_123", {
  projectId: "my-project",
})

console.log(`Service Accounts: ${iamResult.serviceAccounts.length}`)
console.log(`Custom Roles: ${iamResult.customRoles.length}`)
console.log(`IAM Bindings: ${iamResult.iamBindings.length}`)

// Get service accounts with user-managed keys
const withKeys = await GCPIAM.getServiceAccountsWithKeys({
  projectId: "my-project",
})

// Get public IAM bindings
const publicBindings = await GCPIAM.getPublicBindings({
  projectId: "my-project",
})

// GCS bucket analysis
const gcsResult = await GCPGCS.enumerate("scan_123", {
  projectId: "my-project",
})

// Get public buckets
const publicBuckets = await GCPGCS.getPublicBuckets({
  projectId: "my-project",
})

// Firewall analysis
const fwResult = await GCPFirewall.enumerate("scan_123", {
  projectId: "my-project",
})

// Get rules with public ingress
const publicRules = await GCPFirewall.getRulesWithPublicIngress({
  projectId: "my-project",
})

// Compute analysis
const computeResult = await GCPCompute.enumerate("scan_123", {
  projectId: "my-project",
})

// Get instances with default service account
const defaultSA = await GCPCompute.getInstancesWithDefaultSA({
  projectId: "my-project",
})

// Get public Cloud Functions
const publicFunctions = await GCPCompute.getPublicFunctions({
  projectId: "my-project",
})
```

### Running Full Scans

```typescript
import { CloudScanOrchestrator, CloudScanProfiles } from "./pentest/cloudscan"

// Quick scan
const result = await CloudScanOrchestrator.quickScan({
  provider: "aws",
  regions: ["us-east-1", "us-west-2"],
  awsProfile: "production",
})

// Standard scan with compliance
const result = await CloudScanOrchestrator.scan({
  provider: "aws",
  profile: "standard",
  regions: ["us-east-1"],
  complianceFrameworks: ["cis", "pci-dss"],
  awsProfile: "production",
})

// Thorough scan with external tools
const result = await CloudScanOrchestrator.thoroughScan({
  provider: "aws",
  regions: ["us-east-1"],
  awsProfile: "production",
  useProwler: true,
  useScoutSuite: true,
})

// Focused scans
const iamResult = await CloudScanOrchestrator.iamScan({
  provider: "azure",
  azureSubscription: "sub-123",
})

const storageResult = await CloudScanOrchestrator.storageScan({
  provider: "gcp",
  gcpProject: "my-project",
})

const networkResult = await CloudScanOrchestrator.networkScan({
  provider: "aws",
  regions: ["us-east-1"],
  awsProfile: "production",
})

// Compliance-only scan
const complianceResult = await CloudScanOrchestrator.complianceScan({
  provider: "aws",
  frameworks: ["cis", "nist", "hipaa"],
  awsProfile: "production",
})
```

### Compliance Checking

```typescript
import { ComplianceChecker } from "./pentest/cloudscan"

// Evaluate findings against CIS benchmarks
const cisResult = ComplianceChecker.evaluate(
  "scan_123",
  "aws",
  "cis",
  findings
)

console.log(`Pass Rate: ${cisResult.summary.passRate}%`)
console.log(`Failed Checks: ${cisResult.summary.failed}`)

// Evaluate multiple frameworks
const results = ComplianceChecker.evaluateAll(
  "scan_123",
  "aws",
  ["cis", "nist", "pci-dss", "hipaa"],
  findings
)

// Get framework info
const info = ComplianceChecker.getFrameworkInfo("cis")
console.log(`${info.name} v${info.version}`)
```

### Discovery

```typescript
import { CloudDiscovery } from "./pentest/cloudscan"

// Check prerequisites
const prereqs = await CloudDiscovery.checkPrerequisites("aws")
console.log(`CLI Installed: ${prereqs.cliInstalled}`)
console.log(`Authenticated: ${prereqs.authenticated}`)

// Get available regions
const regions = await CloudDiscovery.getRegions("aws")

// Discover resources
const discovery = await CloudDiscovery.discover("scan_123", {
  provider: "aws",
  regions: ["us-east-1"],
  awsProfile: "production",
})

console.log(`Total Resources: ${discovery.summary.totalResources}`)
console.log(`Users: ${discovery.resources.iam.users.length}`)
console.log(`Buckets: ${discovery.resources.storage.length}`)
console.log(`Security Groups: ${discovery.resources.network.securityGroups.length}`)
console.log(`Instances: ${discovery.resources.compute.instances.length}`)
```

### Tool Actions

The `cloudscan` tool supports the following actions:

| Action | Description |
|--------|-------------|
| `discover` | Enumerate cloud resources |
| `scan` | Run security scan with profile |
| `quick-scan` | Fast assessment |
| `full-scan` | Comprehensive scan with external tools |
| `iam-scan` | IAM/RBAC focused scan |
| `storage-scan` | Storage bucket focused scan |
| `network-scan` | Security group focused scan |
| `compliance` | Compliance framework check |
| `prowler` | Run Prowler tool |
| `scoutsuite` | Run ScoutSuite tool |
| `status` | Get scan status |
| `profiles` | List available scan profiles |
| `prerequisites` | Check CLI tools and auth |
| `regions` | List available regions |

## Scan Profiles

| Profile | Discovery | Security | Compliance | External Tools | Use Case |
|---------|-----------|----------|------------|----------------|----------|
| `discovery` | yes | no | no | no | Resource enumeration only |
| `quick` | yes | yes | no | no | Fast assessment |
| `standard` | yes | yes | yes (CIS) | no | Normal assessment |
| `thorough` | yes | yes | yes (all) | yes | Comprehensive audit |
| `compliance` | yes | yes | yes | no | Compliance-focused |
| `iam-focused` | yes | yes | yes | no | IAM-specific |
| `storage-focused` | yes | yes | yes | no | Storage-specific |
| `network-focused` | yes | yes | yes | no | Network-specific |
| `custom` | configurable | configurable | configurable | configurable | Custom configuration |

## Security Checks

### IAM Checks

| Check | Provider | Severity | Description |
|-------|----------|----------|-------------|
| MFA Enabled | AWS/Azure | High | Users should have MFA enabled |
| No Root Access Keys | AWS | Critical | Root account should not have access keys |
| Access Key Rotation | All | Medium | Access keys should be rotated regularly |
| Least Privilege | All | Medium | Overly permissive policies detected |
| Public IAM Bindings | GCP | Critical | allUsers or allAuthenticatedUsers bindings |
| Service Account Keys | GCP | Medium | User-managed keys instead of workload identity |

### Storage Checks

| Check | Provider | Severity | Description |
|-------|----------|----------|-------------|
| No Public Access | All | High | Public access prevention not enforced |
| Encryption Enabled | All | High | Server-side encryption required |
| Versioning Enabled | All | Low | Object versioning for recovery |
| Access Logging | All | Medium | Access logging for audit |
| HTTPS Only | AWS/Azure | Medium | Require secure transport |
| Uniform Access | GCP | Medium | Uniform bucket-level access instead of ACLs |

### Network Checks

| Check | Provider | Severity | Description |
|-------|----------|----------|-------------|
| No Unrestricted Ingress | All | Critical | 0.0.0.0/0 on all ports |
| No SSH from Internet | All | High | Port 22 exposed to 0.0.0.0/0 |
| No RDP from Internet | All | High | Port 3389 exposed to 0.0.0.0/0 |
| No Database from Internet | All | Critical | MySQL/PostgreSQL/MongoDB exposed |
| VPC Flow Logs | All | Medium | Network flow logging enabled |

### Compute Checks

| Check | Provider | Severity | Description |
|-------|----------|----------|-------------|
| No Public IP | All | Medium | Instances without public IPs preferred |
| IMDSv2 Required | AWS | Medium | Instance metadata service v2 |
| Managed Identity | Azure | Medium | VMs using managed identity |
| No Default SA | GCP | Medium | Custom service account instead of default |
| No Secrets in Env | All | High | Secrets in function environment variables |

## Compliance Frameworks

| Framework | Description | Version |
|-----------|-------------|---------|
| `cis` | CIS Benchmarks | 2.0 |
| `nist` | NIST Cybersecurity Framework | 1.1 |
| `pci-dss` | Payment Card Industry DSS | 4.0 |
| `hipaa` | Health Insurance Portability | 2023 |
| `soc2` | Service Organization Control 2 | 2017 |
| `gdpr` | General Data Protection Regulation | 2018 |
| `iso27001` | Information Security Management | 2022 |
| `aws-foundational-security` | AWS Security Best Practices | 1.0 |
| `azure-security-benchmark` | Azure Security Benchmark | 3.0 |
| `gcp-security-foundations` | GCP Security Foundations | 1.0 |

## Events

The module emits the following events:

| Event | Description |
|-------|-------------|
| `pentest.cloudscan.scan_started` | Cloud scan began |
| `pentest.cloudscan.scan_completed` | Scan finished |
| `pentest.cloudscan.scan_failed` | Scan failed |
| `pentest.cloudscan.discovery_started` | Resource discovery began |
| `pentest.cloudscan.discovery_completed` | Discovery finished |
| `pentest.cloudscan.bucket_found` | Storage bucket discovered |
| `pentest.cloudscan.public_bucket_found` | Public bucket detected |
| `pentest.cloudscan.iam_user_found` | IAM user enumerated |
| `pentest.cloudscan.iam_role_found` | IAM role enumerated |
| `pentest.cloudscan.iam_policy_issue` | IAM policy issue detected |
| `pentest.cloudscan.security_group_found` | Security group discovered |
| `pentest.cloudscan.insecure_rule_found` | Insecure firewall rule detected |
| `pentest.cloudscan.instance_found` | Compute instance discovered |
| `pentest.cloudscan.function_found` | Serverless function discovered |
| `pentest.cloudscan.finding_detected` | Security finding generated |
| `pentest.cloudscan.compliance_violation` | Compliance check failed |
| `pentest.cloudscan.compliance_complete` | Compliance evaluation finished |
| `pentest.cloudscan.external_tool_completed` | External tool finished |

## Storage

Cloud scan data is persisted in:

```
pentest/cloudscan/
  scans/
    cloudscan_abc123.json     # Scan results
```

## Data Types

### CloudScanResult

```typescript
{
  id: string
  provider: "aws" | "azure" | "gcp"
  profile: string
  status: "running" | "completed" | "failed"
  startTime: number
  endTime?: number
  discovery: DiscoveryResult
  findings: CloudFinding[]
  compliance: ComplianceResult[]
  summary: {
    totalResources: number
    totalFindings: number
    bySeverity: { critical, high, medium, low, info }
    byCategory: Record<string, number>
  }
  errors: string[]
}
```

### CloudFinding

```typescript
{
  id: string
  provider: "aws" | "azure" | "gcp"
  region?: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  title: string
  description: string
  resourceType: string
  resourceId: string
  category: string
  complianceFrameworks?: string[]
  remediation?: string
  foundAt: number
  source: "scanner" | "prowler" | "scoutsuite"
}
```

### IAMPrincipal

```typescript
{
  id: string
  name: string
  type: "user" | "role" | "service-account" | "group"
  arn?: string
  email?: string
  createdAt?: number
  lastUsed?: number
  mfaEnabled?: boolean
  accessKeys: AccessKey[]
  attachedPolicies: string[]
  inlinePolicies: string[]
  groups?: string[]
  issues: string[]
}
```

### StorageBucket

```typescript
{
  id: string
  name: string
  provider: "aws" | "azure" | "gcp"
  region?: string
  createdAt?: number
  publicAccessBlocked?: boolean
  versioningEnabled?: boolean
  loggingEnabled?: boolean
  encryption?: {
    enabled: boolean
    keyId?: string
    customerManaged?: boolean
  }
  accessLevel?: string
  issues?: string[]
}
```

### SecurityGroup

```typescript
{
  id: string
  name: string
  vpcId?: string
  description?: string
  rules: SecurityRule[]
  hasPublicIngress: boolean
  hasUnrestrictedIngress: boolean
  tags?: Record<string, string>
}
```

### ComplianceCheck

```typescript
{
  id: string
  framework: string
  controlId: string
  title: string
  description: string
  status: "pass" | "fail" | "unknown"
  severity: "critical" | "high" | "medium" | "low" | "info"
  resourceType: string
  findings: string[]
  remediation?: string
}
```

## External Tool Parsers

### Prowler

```typescript
import { ProwlerParser } from "./pentest/cloudscan"

const output = await runProwler()
const findings = ProwlerParser.parseOutput(output, "aws")

console.log(`Findings: ${findings.length}`)
```

### ScoutSuite

```typescript
import { ScoutSuiteParser } from "./pentest/cloudscan"

const output = await runScoutSuite()
const findings = ScoutSuiteParser.parseOutput(output, "aws")

console.log(`Findings: ${findings.length}`)
```

## Testing

Run the cloudscan tests with:

```bash
bun test test/pentest/cloudscan.test.ts
```

The test suite covers:
- AWS CLI output parsing
- Azure CLI output parsing
- gcloud CLI output parsing
- Prowler output parsing
- ScoutSuite output parsing
- Profile configurations
- Storage operations
- Type validation
- Compliance checking

## Dependencies

The module uses external CLI tools:
- `aws` - AWS CLI for resource enumeration
- `az` - Azure CLI for resource enumeration
- `gcloud` - Google Cloud CLI for resource enumeration
- `prowler` - AWS/Azure/GCP security assessment
- `scout` - ScoutSuite multi-cloud security auditing

Existing modules used:
- Storage, Bus, Log
- Patterns from: netscan, apiscan modules (Tool.define, storage, events)

## Example Tool Usage

```bash
# Check prerequisites
cloudscan prerequisites provider=aws

# List available regions
cloudscan regions provider=aws

# Resource discovery
cloudscan discover provider=aws regions=["us-east-1"]

# Quick scan
cloudscan quick-scan provider=aws awsProfile=production

# Full scan with external tools
cloudscan full-scan provider=aws regions=["us-east-1","us-west-2"]

# IAM-focused scan
cloudscan iam-scan provider=azure azureSubscription=sub-123

# Storage-focused scan
cloudscan storage-scan provider=gcp gcpProject=my-project

# Compliance scan
cloudscan compliance provider=aws frameworks=["cis","pci-dss","hipaa"]

# Run Prowler
cloudscan prowler provider=aws awsProfile=production

# Run ScoutSuite
cloudscan scoutsuite provider=aws

# Check scan status
cloudscan status scanId=cloudscan_abc123

# List profiles
cloudscan profiles
```
