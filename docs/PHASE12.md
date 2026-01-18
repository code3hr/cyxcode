# Phase 12: Container Security Scanner + CVE Lookup Service

## Overview

Phase 12 introduces two interconnected modules:

1. **CVE Lookup Service** (`pentest/cve/`) - Shared utility for CVE enrichment across all scanners
2. **Container Security Scanner** (`pentest/containerscan/`) - Docker, Kubernetes, and registry security testing

## Part A: CVE Lookup Service

The CVE Lookup Service provides centralized vulnerability data enrichment from multiple authoritative sources.

### Module Structure

```
src/pentest/cve/
├── index.ts              # Module exports
├── types.ts              # Zod schemas for CVE data
├── cache.ts              # File-based caching with TTL
├── lookup.ts             # NVD, OSV, CISA KEV API integration
├── enricher.ts           # Finding enrichment utilities
└── tool.ts               # CVETool for agent
```

### External APIs

| API | Purpose | Rate Limit |
|-----|---------|------------|
| NVD API 2.0 | Official NIST CVE database | 5 req/30s (no key), 50 req/30s (with key) |
| OSV API | Open Source Vulnerabilities | No limit |
| CISA KEV | Known Exploited Vulnerabilities | No limit |

### Usage

```typescript
import { CVELookup, CVECache, CVEEnricher } from "./pentest/cve"

// Look up a single CVE
const cve = await CVELookup.lookup("CVE-2021-44228")
console.log(`CVSS: ${cve.cvss?.v3?.score}`)
console.log(`Severity: ${cve.cvss?.v3?.severity}`)
console.log(`In CISA KEV: ${cve.exploitability?.inKEV}`)

// Bulk lookup
const cves = await CVELookup.bulkLookup([
  "CVE-2021-44228",
  "CVE-2023-44487",
  "CVE-2024-3094"
])

// Search CVEs by keyword
const results = await CVELookup.search({
  keyword: "log4j",
  startDate: "2021-01-01",
  severityType: "critical"
})

// Check against CISA KEV
const kevResults = await CVELookup.checkKEV(["CVE-2021-44228", "CVE-2023-44487"])
console.log(`In KEV: ${kevResults.inKEV.length}`)

// Enrich findings with CVE data
const enriched = await CVEEnricher.enrichFindings(findings, {
  fetchMissing: true,
  checkKEV: true
})

// Cache management
await CVECache.warmup(["CVE-2021-44228", "CVE-2023-44487"])
const stats = await CVECache.getStats()
console.log(`Cache hits: ${stats.hits}, misses: ${stats.misses}`)
```

### Tool Actions

| Action | Description |
|--------|-------------|
| `lookup` | Look up single CVE |
| `bulk-lookup` | Look up multiple CVEs |
| `search` | Search CVEs by keyword/product |
| `kev-check` | Check if CVEs are in CISA KEV |
| `enrich-findings` | Enrich findings with CVE data |
| `cache-stats` | Get cache statistics |
| `clear-cache` | Clear the CVE cache |

### Data Types

#### CVEData

```typescript
{
  id: string                    // CVE-2024-1234
  description: string
  cvss: {
    v4?: { score: number; vector: string; severity: string }
    v3?: { score: number; vector: string; severity: string }
    v2?: { score: number; vector: string }
  }
  cwe: string[]                 // CWE-79, CWE-89
  references: string[]
  publishedDate: string
  lastModifiedDate: string
  exploitability?: {
    inKEV: boolean              // CISA Known Exploited
    hasPublicExploit: boolean
    exploitMaturity: string
  }
  affected?: {
    vendor: string
    product: string
    versions: string[]
  }[]
}
```

---

## Part B: Container Security Scanner

The Container Security Scanner provides comprehensive container and orchestration security testing.

### Module Structure

```
src/pentest/containerscan/
├── index.ts              # Module exports
├── types.ts              # ContainerScanTypes namespace
├── events.ts             # ContainerScanEvents
├── storage.ts            # Scan persistence
├── profiles.ts           # Scan profiles
├── tool.ts               # ContainerScanTool
├── orchestrator.ts       # Scan coordination
├── parsers/
│   ├── index.ts
│   ├── trivy.ts          # Trivy JSON parser
│   ├── grype.ts          # Grype JSON parser
│   ├── syft.ts           # Syft SBOM parser
│   └── kubeaudit.ts      # Kubeaudit parser
├── docker/
│   ├── index.ts
│   ├── images.ts         # Image enumeration & scanning
│   ├── containers.ts     # Running container analysis
│   ├── config.ts         # Docker daemon config audit
│   └── secrets.ts        # Secret detection in images
├── kubernetes/
│   ├── index.ts
│   ├── cluster.ts        # Cluster enumeration
│   ├── pods.ts           # Pod security analysis
│   ├── rbac.ts           # RBAC analysis
│   ├── network.ts        # Network policy analysis
│   ├── secrets.ts        # K8s secrets audit
│   └── admission.ts      # Admission controller checks
└── registry/
    ├── index.ts
    ├── dockerhub.ts      # Docker Hub integration
    ├── ecr.ts            # AWS ECR
    ├── acr.ts            # Azure ACR
    ├── gcr.ts            # Google GCR/Artifact Registry
    └── scanner.ts        # Registry scanning orchestration
```

### Usage

#### Docker Image Scanning

```typescript
import { DockerImages, DockerContainers, DockerConfig, DockerSecrets } from "./pentest/containerscan"

// List local images
const images = await DockerImages.list()
console.log(`Found ${images.length} images`)

// Scan an image for vulnerabilities
const scanResult = await DockerImages.scanWithTrivy("nginx:latest")
console.log(`Vulnerabilities: ${scanResult.vulnerabilities.length}`)

// Scan with multiple tools
const fullResult = await DockerImages.scanImage("nginx:latest", {
  useTrivy: true,
  useGrype: true,
  generateSBOM: true
})

// Generate SBOM
const sbom = await DockerImages.generateSBOM("nginx:latest")
console.log(`Components: ${sbom.components.length}`)

// Analyze running containers
const containers = await DockerContainers.list()
const analysis = await DockerContainers.analyzeAll()
console.log(`Privileged containers: ${analysis.filter(c => c.privileged).length}`)

// Audit Docker daemon configuration
const configFindings = await DockerConfig.audit()
console.log(`Config issues: ${configFindings.length}`)

// Scan for secrets
const secrets = await DockerSecrets.scanImage("myapp:latest")
console.log(`Secrets found: ${secrets.length}`)
```

#### Kubernetes Security Scanning

```typescript
import {
  KubernetesCluster,
  KubernetesPods,
  KubernetesRBAC,
  KubernetesNetwork,
  KubernetesSecrets,
  KubernetesAdmission
} from "./pentest/containerscan"

// Check cluster connectivity
const connected = await KubernetesCluster.isConnected()
const clusterInfo = await KubernetesCluster.getInfo()
console.log(`Cluster: ${clusterInfo.name} (${clusterInfo.version})`)

// Analyze pod security
const pods = await KubernetesPods.list()
const podAnalysis = await KubernetesPods.analyzeAll()
console.log(`Pods with issues: ${podAnalysis.filter(p => p.findings.length > 0).length}`)

// Get privileged pods
const privilegedPods = await KubernetesPods.getPrivileged()
console.log(`Privileged pods: ${privilegedPods.length}`)

// RBAC analysis
const rbacFindings = await KubernetesRBAC.analyze()
console.log(`RBAC issues: ${rbacFindings.length}`)

// Get cluster-admin bindings
const clusterAdmins = await KubernetesRBAC.getClusterAdminBindings()
console.log(`Cluster-admin bindings: ${clusterAdmins.length}`)

// Network policy analysis
const networkCoverage = await KubernetesNetwork.analyzeCoverage()
console.log(`Namespaces without policies: ${networkCoverage.unprotectedNamespaces.length}`)

// Secrets analysis
const secretsAnalysis = await KubernetesSecrets.analyze()
console.log(`Secrets: ${secretsAnalysis.length}`)

// Admission controller analysis
const admissionAnalysis = await KubernetesAdmission.analyze()
console.log(`PSA Enforced: ${admissionAnalysis.psaEnforced}`)
```

#### Registry Scanning

```typescript
import { RegistryScanner, DockerHub, AWSECR, AzureACR, GoogleGCR } from "./pentest/containerscan"

// Docker Hub
const hubImages = await DockerHub.listImages("myorg")
await DockerHub.scanRepository("myorg/myapp")

// AWS ECR
const ecrImages = await AWSECR.listImages("my-repo", { region: "us-east-1" })
const ecrFindings = await AWSECR.getFindings("my-repo", "sha256:abc123", {
  region: "us-east-1"
})

// Azure ACR
const acrImages = await AzureACR.listImages("myacr", "my-repo")
await AzureACR.checkSecurity("myacr")

// Google GCR/Artifact Registry
const gcrImages = await GoogleGCR.listImages("my-project")
const gcrVulns = await GoogleGCR.getVulnerabilities("my-project", "gcr.io/my-project/myapp@sha256:abc")

// Registry scanning orchestration
const registryResult = await RegistryScanner.scanRegistry({
  type: "ecr",
  url: "123456789.dkr.ecr.us-east-1.amazonaws.com",
  name: "Production ECR",
  authenticated: true,
  region: "us-east-1"
}, {
  scanVulnerabilities: true,
  generateSBOM: true,
  maxImages: 50
})
```

#### Running Full Scans

```typescript
import { ContainerScanOrchestrator, ContainerScanProfiles } from "./pentest/containerscan"

// Quick scan
const quickResult = await ContainerScanOrchestrator.scan({
  profile: "quick",
  scanDocker: true,
  scanKubernetes: false
})

// Standard scan with K8s
const standardResult = await ContainerScanOrchestrator.scan({
  profile: "standard",
  scanDocker: true,
  scanKubernetes: true,
  complianceFrameworks: ["cis-docker"]
})

// Thorough scan with all tools
const thoroughResult = await ContainerScanOrchestrator.scan({
  profile: "thorough",
  scanDocker: true,
  scanKubernetes: true,
  scanRegistries: ["ecr", "gcr"],
  complianceFrameworks: ["cis-docker", "cis-kubernetes"]
})

// Image-only scan
const imageResult = await ContainerScanOrchestrator.scanImage("nginx:latest", {
  useTrivy: true,
  useGrype: true,
  generateSBOM: true
})

// Runtime scan
const runtimeResult = await ContainerScanOrchestrator.scanRuntime()

// Cluster scan
const clusterResult = await ContainerScanOrchestrator.scanCluster({
  rbac: true,
  pods: true,
  network: true,
  secrets: true,
  admission: true
})

// Compliance scan
const complianceResult = await ContainerScanOrchestrator.scanCompliance({
  framework: "cis-kubernetes",
  kubeaudit: true
})
```

### Tool Actions

| Action | Description |
|--------|-------------|
| `discover` | Enumerate images, containers, registries |
| `scan` | Run security scan with profile |
| `scan-image` | Scan specific image for vulnerabilities |
| `scan-runtime` | Analyze running containers |
| `scan-registry` | Scan images in a registry |
| `scan-cluster` | Kubernetes cluster security audit |
| `sbom` | Generate SBOM for image |
| `compliance` | CIS Docker/Kubernetes benchmark |
| `status` | Get scan status |
| `profiles` | List available scan profiles |

### Scan Profiles

| Profile | Images | Runtime | K8s | Compliance | External Tools |
|---------|--------|---------|-----|------------|----------------|
| `discovery` | list | list | list | no | no |
| `quick` | trivy | basic | no | no | trivy |
| `standard` | trivy+grype | full | pods | CIS | trivy, grype |
| `thorough` | all | full | full | all | trivy, grype, kubeaudit |
| `compliance` | config | config | full | all | kubeaudit |
| `sbom-only` | sbom | no | no | no | syft |

### Security Checks

#### Docker Image Checks

| Check | Severity | Description |
|-------|----------|-------------|
| Known CVEs | Varies | Vulnerabilities detected by Trivy/Grype |
| Outdated Base Image | Medium | Base image has known updates |
| Root User | Medium | Container runs as root |
| Exposed Secrets | Critical | API keys, passwords in image layers |
| Insecure Packages | High | Packages with known vulnerabilities |
| Missing Health Check | Low | No HEALTHCHECK instruction |

#### Docker Runtime Checks

| Check | Severity | Description |
|-------|----------|-------------|
| Privileged Container | Critical | --privileged flag used |
| Host Network | High | Host network namespace shared |
| Host PID/IPC | High | Host PID/IPC namespace shared |
| Sensitive Mounts | Critical | /etc, /var/run/docker.sock mounted |
| Added Capabilities | Medium | CAP_SYS_ADMIN, CAP_NET_RAW, etc. |
| No Resource Limits | Low | CPU/memory limits not set |
| Writable Root FS | Medium | Root filesystem not read-only |

#### Kubernetes Checks

| Check | Severity | Description |
|-------|----------|-------------|
| Privileged Pod | Critical | securityContext.privileged: true |
| Host Network/PID/IPC | High | hostNetwork/hostPID/hostIPC: true |
| Root User | Medium | runAsNonRoot: false or runAsUser: 0 |
| Cluster-Admin Binding | Critical | ClusterRoleBinding to cluster-admin |
| Wildcard Permissions | High | RBAC with "*" verbs or resources |
| Default Service Account | Medium | Default SA with automountServiceAccountToken |
| Missing Network Policy | Medium | Namespace without NetworkPolicy |
| Unencrypted Secrets | Medium | Secrets not encrypted at rest |
| No PSA Enforcement | Medium | Pod Security Admission not enforced |

### Events

| Event | Description |
|-------|-------------|
| `pentest.containerscan.scan_started` | Scan began |
| `pentest.containerscan.scan_completed` | Scan finished |
| `pentest.containerscan.scan_failed` | Scan failed |
| `pentest.containerscan.image_found` | Docker image discovered |
| `pentest.containerscan.container_found` | Running container discovered |
| `pentest.containerscan.vulnerability_found` | CVE detected in image |
| `pentest.containerscan.misconfiguration_found` | Security misconfiguration detected |
| `pentest.containerscan.secret_found` | Secret detected in image/container |
| `pentest.containerscan.sbom_generated` | SBOM generated for image |
| `pentest.containerscan.compliance_violation` | Compliance check failed |
| `pentest.containerscan.pod_found` | Kubernetes pod discovered |
| `pentest.containerscan.rbac_issue_found` | RBAC misconfiguration detected |
| `pentest.containerscan.network_policy_gap` | Network policy gap detected |
| `pentest.containerscan.registry_scan_completed` | Registry scan finished |

### Storage

Container scan data is persisted in:

```
pentest/containerscan/
  scans/
    containerscan_abc123.json   # Scan results
  sboms/
    nginx_latest.json           # SBOM files
  images/
    image_abc123.json           # Image scan results
```

### Data Types

#### ContainerScanResult

```typescript
{
  id: string
  profile: string
  status: "pending" | "running" | "completed" | "failed"
  startTime: number
  endTime?: number
  docker: {
    images: ImageScanResult[]
    containers: ContainerAnalysis[]
    configFindings: ContainerFinding[]
  }
  kubernetes?: {
    cluster: ClusterInfo
    pods: PodAnalysis[]
    rbac: RBACFinding[]
    network: NetworkPolicyAnalysis
    secrets: SecretAnalysis[]
    admission: AdmissionAnalysis
  }
  registries?: RegistryScanResult[]
  compliance?: ComplianceResult[]
  findings: ContainerFinding[]
  summary: {
    totalImages: number
    totalContainers: number
    totalVulnerabilities: number
    bySeverity: { critical, high, medium, low }
  }
}
```

#### ContainerFinding

```typescript
{
  id: string
  category: "vulnerability" | "misconfiguration" | "secret" | "compliance"
  severity: "critical" | "high" | "medium" | "low" | "info"
  title: string
  description: string
  resource: {
    type: "image" | "container" | "pod" | "cluster" | "registry"
    name: string
    namespace?: string
  }
  cve?: string
  cvss?: number
  remediation?: string
  references?: string[]
  detectedAt: number
}
```

#### ImageVulnerability

```typescript
{
  id: string
  cveId: string
  severity: "critical" | "high" | "medium" | "low" | "unknown"
  pkgName: string
  installedVersion: string
  fixedVersion?: string
  title?: string
  description?: string
  cvss?: number
  references?: string[]
}
```

### External Tool Commands

```bash
# Trivy - Image vulnerability scanning
trivy image --format json --severity HIGH,CRITICAL nginx:latest

# Grype - Image vulnerability scanning
grype nginx:latest -o json

# Syft - SBOM generation
syft nginx:latest -o json

# Kubeaudit - Kubernetes audit
kubeaudit all --json
```

### Example Tool Usage

```bash
# Discover images and containers
containerscan discover

# Scan a specific image
containerscan scan-image image=nginx:latest

# Generate SBOM
containerscan sbom image=nginx:latest format=cyclonedx

# Scan running containers
containerscan scan-runtime

# Scan Kubernetes cluster
containerscan scan-cluster rbac=true pods=true network=true

# Run compliance check
containerscan compliance framework=cis-docker

# Scan a registry
containerscan scan-registry type=ecr region=us-east-1

# Full scan with profile
containerscan scan profile=thorough

# Check scan status
containerscan status scanId=containerscan_abc123

# List profiles
containerscan profiles
```

---

## Dependencies

### External Tools Required

| Tool | Purpose | Installation |
|------|---------|--------------|
| `docker` | Docker CLI | https://docs.docker.com/get-docker/ |
| `kubectl` | Kubernetes CLI | https://kubernetes.io/docs/tasks/tools/ |
| `trivy` | Image vulnerability scanner | https://aquasecurity.github.io/trivy/ |
| `grype` | Dependency vulnerability scanner | https://github.com/anchore/grype |
| `syft` | SBOM generator | https://github.com/anchore/syft |
| `kubeaudit` | K8s security auditor | https://github.com/Shopify/kubeaudit |

### APIs Used

| API | URL | Purpose |
|-----|-----|---------|
| NVD API 2.0 | `https://services.nvd.nist.gov/rest/json/cves/2.0` | CVE data |
| OSV API | `https://api.osv.dev/v1` | Open source vulnerabilities |
| CISA KEV | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | Known exploited vulnerabilities |

### Existing Module Dependencies

- Storage, Bus, Log utilities
- Patterns from: cloudscan, netscan, apiscan modules

---

## Testing

Run the tests:

```bash
# CVE module tests
bun test test/pentest/cve.test.ts

# Container scanner tests
bun test test/pentest/containerscan.test.ts
```

## Integration

Both tools are registered in `src/tool/registry.ts`:
- `CVETool` - Available as `cve` tool
- `ContainerScanTool` - Available as `containerscan` tool

Exports available from `src/pentest/index.ts`:
- All CVE types, cache, lookup, enricher
- All container scan types, events, storage, profiles
- All parsers (Trivy, Grype, Syft, Kubeaudit)
- All Docker utilities (images, containers, config, secrets)
- All Kubernetes utilities (cluster, pods, rbac, network, secrets, admission)
- All registry integrations (Docker Hub, ECR, ACR, GCR)
