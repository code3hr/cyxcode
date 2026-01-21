# Pentest Tools Quick Reference Guide

Quick reference for all security testing tools available in the pentest module.

---

## Table of Contents

1. [SecTools - Security Tools Wrapper](#sectools---security-tools-wrapper)
2. [NetScan - Network Scanner](#netscan---network-scanner)
3. [WebScan - Web Application Scanner](#webscan---web-application-scanner)
4. [ApiScan - API Security Scanner](#apiscan---api-security-scanner)
5. [CloudScan - Cloud Security Scanner](#cloudscan---cloud-security-scanner)
6. [ContainerScan - Container Security Scanner](#containerscan---container-security-scanner)
7. [CVE - CVE Lookup Tool](#cve---cve-lookup-tool)
8. [Exploits - Exploit Search Tool](#exploits---exploit-search-tool)
9. [Monitor - Continuous Monitoring](#monitor---continuous-monitoring)
10. [Report - Report Generation](#report---report-generation)

---

## SecTools - Security Tools Wrapper

Unified interface to common penetration testing tools (nmap, nikto, nuclei, etc.).

### Supported Tools

| Category | Tools |
|----------|-------|
| Network Recon | nmap, masscan, netcat |
| Web Scanning | nikto, dirb, gobuster, ffuf, wpscan |
| Vulnerability | nuclei, searchsploit |
| SQL Injection | sqlmap |
| SMB/Windows | enum4linux, smbclient, crackmapexec |
| SSL/TLS | sslscan, sslyze, testssl |
| DNS | dnsenum, dnsrecon, fierce |

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tool` | string | Yes | Tool name (nmap, nikto, nuclei, etc.) |
| `target` | string | Yes | Target IP, hostname, or URL |
| `args` | string | No | Tool-specific arguments |
| `timeout` | number | No | Timeout in milliseconds |
| `createFindings` | boolean | No | Create findings from results (default: true) |

### Examples

```
# Nikto web scan
sectools tool="nikto" target="http://example.com" args="-Tuning 1"

# Gobuster directory enumeration
sectools tool="gobuster" target="http://example.com" args="dir -w /usr/share/wordlists/dirb/common.txt"

# Enum4linux SMB enumeration
sectools tool="enum4linux" target="192.168.1.1" args="-a"

# SSL scan
sectools tool="sslscan" target="example.com"

# Nmap service scan
sectools tool="nmap" target="192.168.1.0/24" args="-sV -sC -p 1-1000"

# Nuclei vulnerability scan
sectools tool="nuclei" target="http://example.com" args="-t cves/"
```

---

## NetScan - Network Scanner

Comprehensive network infrastructure security scanner with AD, SMB, DNS, LDAP, and SNMP support.

### Actions

| Action | Description |
|--------|-------------|
| `discover` | Discover network hosts and services |
| `scan` | Run full scan with specified profile |
| `status` | Get scan status |
| `ad-enum` | Enumerate Active Directory domain |
| `ad-users` | Enumerate AD users |
| `ad-groups` | Enumerate AD groups |
| `ad-computers` | Enumerate AD computers |
| `ad-kerberoast` | Find Kerberoastable accounts |
| `ad-asrep` | Find AS-REP roastable accounts |
| `smb-shares` | Enumerate SMB shares |
| `smb-sessions` | Enumerate SMB sessions |
| `dns-zone` | Attempt DNS zone transfer |
| `dns-enum` | DNS enumeration |
| `ldap-search` | LDAP search |
| `ldap-policy` | Get password policy via LDAP |
| `snmp-walk` | SNMP enumeration |
| `snmp-brute` | SNMP community string brute force |
| `creds-spray` | Password spraying attack |
| `creds-check` | Check credentials |
| `creds-defaults` | Check for default credentials |

### Profiles

| Profile | Description |
|---------|-------------|
| `discovery` | Host discovery only |
| `quick` | Fast scan, common ports |
| `standard` | Balanced scan |
| `thorough` | Comprehensive scan |
| `stealth` | Low and slow |
| `ad-focused` | Active Directory focused |

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Action to perform |
| `target` | string | Yes* | Target IP/range/hostname |
| `profile` | string | No | Scan profile |
| `username` | string | No | Authentication username |
| `password` | string | No | Authentication password |
| `domain` | string | No | AD domain name |
| `ports` | string | No | Port range (e.g., "1-1000") |
| `community` | string | No | SNMP community string |

### Examples

```
# Discover hosts on network
netscan action="discover" target="192.168.1.0/24"

# Full network scan
netscan action="scan" target="192.168.1.0/24" profile="standard"

# AD enumeration with credentials
netscan action="ad-enum" target="dc.corp.local" domain="corp.local" username="admin" password="pass123"

# Enumerate AD users
netscan action="ad-users" target="dc.corp.local" domain="corp.local" username="admin" password="pass123"

# SMB share enumeration
netscan action="smb-shares" target="192.168.1.10" username="admin" password="pass123"

# DNS zone transfer attempt
netscan action="dns-zone" target="ns1.example.com" domain="example.com"

# Password spray attack
netscan action="creds-spray" target="192.168.1.10" domain="corp.local" username="userlist.txt" password="Spring2024!"

# SNMP enumeration
netscan action="snmp-walk" target="192.168.1.1" community="public"

# Check default credentials
netscan action="creds-defaults" target="192.168.1.1"
```

---

## WebScan - Web Application Scanner

Web application security scanner with crawling, vulnerability detection, and OWASP reporting.

### Actions

| Action | Description |
|--------|-------------|
| `crawl` | Crawl website and discover pages |
| `scan` | Run security scan with profile |
| `quick-scan` | Fast vulnerability scan |
| `full-scan` | Comprehensive security scan |
| `owasp` | Generate OWASP Top 10 report |
| `status` | Get scan status |
| `profiles` | List available profiles |

### Profiles

| Profile | Description |
|---------|-------------|
| `discovery` | Crawl and enumerate only |
| `quick` | Fast common vulnerability checks |
| `standard` | Balanced security scan |
| `thorough` | Deep comprehensive scan |
| `api` | API-focused testing |
| `authenticated` | With authentication |

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Action to perform |
| `target` | string | Yes* | Target URL |
| `profile` | string | No | Scan profile |
| `maxDepth` | number | No | Max crawl depth |
| `maxPages` | number | No | Max pages to crawl |
| `headers` | object | No | Custom HTTP headers |
| `cookies` | string | No | Session cookies |
| `scanId` | string | No | Scan ID for status/owasp |

### Examples

```
# Crawl website
webscan action="crawl" target="http://example.com" maxDepth=3

# Quick vulnerability scan
webscan action="quick-scan" target="http://example.com"

# Full security scan
webscan action="full-scan" target="http://example.com"

# Scan with profile
webscan action="scan" target="http://example.com" profile="thorough"

# Authenticated scan
webscan action="scan" target="http://example.com" profile="authenticated" cookies="session=abc123"

# Generate OWASP report
webscan action="owasp" scanId="scan_abc123"

# Check scan status
webscan action="status" scanId="scan_abc123"
```

---

## ApiScan - API Security Scanner

API security scanner supporting OpenAPI, GraphQL, JWT analysis, BOLA, and injection testing.

### Actions

| Action | Description |
|--------|-------------|
| `discover` | Discover API endpoints |
| `parse-spec` | Parse OpenAPI/GraphQL spec |
| `jwt-analyze` | Analyze JWT token security |
| `scan` | Run API security scan |
| `quick-scan` | Fast API scan |
| `full-scan` | Comprehensive API scan |
| `status` | Get scan status |
| `profiles` | List available profiles |

### Profiles

| Profile | Description |
|---------|-------------|
| `discovery` | Endpoint discovery only |
| `quick` | Fast common checks |
| `standard` | Balanced API testing |
| `thorough` | Deep API security scan |
| `auth-focused` | Authentication/authorization focus |

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Action to perform |
| `target` | string | Yes* | Base API URL |
| `specUrl` | string | No | OpenAPI/GraphQL spec URL |
| `token` | string | No | Bearer token for auth |
| `profile` | string | No | Scan profile |
| `headers` | object | No | Custom headers |

### Examples

```
# Discover API endpoints
apiscan action="discover" target="http://api.example.com"

# Parse OpenAPI spec
apiscan action="parse-spec" specUrl="http://api.example.com/openapi.json"

# Parse GraphQL schema
apiscan action="parse-spec" specUrl="http://api.example.com/graphql"

# Analyze JWT token
apiscan action="jwt-analyze" token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Quick API scan
apiscan action="quick-scan" target="http://api.example.com"

# Full scan with authentication
apiscan action="full-scan" target="http://api.example.com" token="Bearer eyJ..."

# Scan with spec
apiscan action="scan" target="http://api.example.com" specUrl="http://api.example.com/openapi.json" profile="thorough"
```

---

## CloudScan - Cloud Security Scanner

Multi-cloud security scanner for AWS, Azure, and GCP with compliance checking.

### Actions

| Action | Description |
|--------|-------------|
| `discover` | Discover cloud resources |
| `scan` | Run security scan |
| `quick-scan` | Fast security scan |
| `iam-scan` | IAM-focused scan |
| `storage-scan` | Storage security scan |
| `network-scan` | Network security scan |
| `compliance` | Compliance check |
| `prowler` | Run Prowler scan (AWS) |
| `scoutsuite` | Run ScoutSuite scan |
| `prerequisites` | Check tool prerequisites |
| `status` | Get scan status |
| `profiles` | List profiles |

### Providers

| Provider | Auth Method |
|----------|-------------|
| `aws` | AWS CLI profile or environment |
| `azure` | Azure CLI or service principal |
| `gcp` | GCP service account or gcloud |

### Profiles

| Profile | Description |
|---------|-------------|
| `discovery` | Resource enumeration only |
| `quick` | Fast security checks |
| `standard` | Balanced security scan |
| `thorough` | Comprehensive scan |
| `compliance` | Compliance-focused |

### Compliance Frameworks

- `cis` - CIS Benchmarks
- `nist` - NIST 800-53
- `pci-dss` - PCI DSS
- `hipaa` - HIPAA
- `soc2` - SOC 2
- `aws-foundational-security` - AWS Foundational Security

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Action to perform |
| `provider` | string | Yes | Cloud provider (aws/azure/gcp) |
| `profile` | string | No | Scan profile |
| `regions` | array | No | Regions to scan |
| `awsProfile` | string | No | AWS CLI profile name |
| `azureSubscription` | string | No | Azure subscription ID |
| `gcpProject` | string | No | GCP project ID |
| `frameworks` | array | No | Compliance frameworks |

### Examples

```
# Discover AWS resources
cloudscan action="discover" provider="aws" regions=["us-east-1","us-west-2"]

# Full AWS security scan
cloudscan action="scan" provider="aws" profile="standard"

# Quick Azure scan
cloudscan action="quick-scan" provider="azure" azureSubscription="sub-123"

# GCP IAM scan
cloudscan action="iam-scan" provider="gcp" gcpProject="my-project"

# AWS compliance check
cloudscan action="compliance" provider="aws" frameworks=["cis","pci-dss"]

# Run Prowler on AWS
cloudscan action="prowler" provider="aws" awsProfile="prod"

# Run ScoutSuite
cloudscan action="scoutsuite" provider="aws"

# Check prerequisites
cloudscan action="prerequisites" provider="aws"
```

---

## ContainerScan - Container Security Scanner

Container and Kubernetes security scanner with image vulnerability scanning and SBOM generation.

### Actions

| Action | Description |
|--------|-------------|
| `discover` | Discover images, containers, registries |
| `scan` | Run security scan with profile |
| `scan-image` | Scan specific container image |
| `scan-runtime` | Analyze running containers |
| `scan-registry` | Scan images in registry |
| `scan-cluster` | Kubernetes cluster audit |
| `sbom` | Generate SBOM for image |
| `compliance` | CIS Docker/K8s benchmark |
| `status` | Get scan status |
| `profiles` | List profiles |

### Profiles

| Profile | Description |
|---------|-------------|
| `discovery` | Enumerate only |
| `quick` | Fast vulnerability scan |
| `standard` | Balanced scan |
| `thorough` | Comprehensive scan |
| `compliance` | Compliance focus |
| `sbom-only` | SBOM generation only |

### External Tools Used

- **Trivy** - Image vulnerability scanning
- **Grype** - Dependency vulnerability scanning
- **Syft** - SBOM generation
- **Kubeaudit** - Kubernetes audit

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Action to perform |
| `image` | string | No | Container image to scan |
| `profile` | string | No | Scan profile |
| `targets` | array | No | Multiple images to scan |
| `registry` | string | No | Registry URL |
| `kubeconfig` | string | No | Kubeconfig path |
| `namespace` | string | No | Kubernetes namespace |
| `framework` | string | No | Compliance framework |

### Examples

```
# Discover local images and containers
containerscan action="discover"

# Scan specific image
containerscan action="scan-image" image="nginx:latest"

# Scan with Trivy and Grype
containerscan action="scan-image" image="myapp:v1.0" profile="thorough"

# Analyze running containers
containerscan action="scan-runtime"

# Kubernetes cluster security audit
containerscan action="scan-cluster"

# Scan specific namespace
containerscan action="scan-cluster" namespace="production"

# Generate SBOM
containerscan action="sbom" image="nginx:latest"

# CIS Docker benchmark
containerscan action="compliance" framework="cis-docker"

# CIS Kubernetes benchmark
containerscan action="compliance" framework="cis-kubernetes"

# Full scan multiple images
containerscan action="scan" profile="thorough" targets=["nginx:latest","redis:7","postgres:15"]

# Scan registry
containerscan action="scan-registry" registry="registry.example.com"
```

---

## CVE - CVE Lookup Tool

CVE database lookup with NVD, OSV, and CISA KEV integration.

### Actions

| Action | Description |
|--------|-------------|
| `lookup` | Look up single CVE |
| `bulk-lookup` | Look up multiple CVEs |
| `search` | Search CVEs by keyword |
| `kev-check` | Check if CVEs are in CISA KEV |
| `enrich-findings` | Enrich findings with CVE data |

### Data Sources

- **NVD** - NIST National Vulnerability Database
- **OSV** - Open Source Vulnerabilities
- **CISA KEV** - Known Exploited Vulnerabilities

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Action to perform |
| `cveId` | string | No | Single CVE ID |
| `cveIds` | array | No | Multiple CVE IDs |
| `keyword` | string | No | Search keyword |
| `product` | string | No | Product name for search |
| `vendor` | string | No | Vendor name for search |

### Examples

```
# Lookup single CVE
cve action="lookup" cveId="CVE-2021-44228"

# Bulk lookup multiple CVEs
cve action="bulk-lookup" cveIds=["CVE-2021-44228","CVE-2023-4911","CVE-2024-3094"]

# Search by keyword
cve action="search" keyword="log4j"

# Search by product
cve action="search" product="apache" vendor="apache"

# Check if CVEs are in CISA KEV (actively exploited)
cve action="kev-check" cveIds=["CVE-2021-44228","CVE-2023-4911"]

# Enrich findings with CVE data
cve action="enrich-findings" cveIds=["CVE-2021-44228","CVE-2023-4911"]
```

### Response Data

CVE lookup returns:
- CVSS v2/v3 scores and vectors
- Severity rating
- Description
- CWE IDs
- References
- Affected products/versions
- CISA KEV status
- Public exploit availability

---

## Exploits - Exploit Search Tool

Search and manage exploits from ExploitDB and Metasploit.

### Actions

| Action | Description |
|--------|-------------|
| `search` | Search for exploits |
| `suggest` | Suggest exploits for a finding |
| `info` | Get exploit details |
| `check` | Check if target is vulnerable |
| `execute` | Execute exploit (with confirmation) |

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Action to perform |
| `query` | string | No | Search query |
| `findingId` | string | No | Finding ID for suggestions |
| `module` | string | No | Exploit module path |
| `target` | string | No | Target for check/execute |
| `dryRun` | boolean | No | Simulate execution |
| `options` | object | No | Exploit options (RHOSTS, LHOST, etc.) |

### Examples

```
# Search for Apache exploits
exploits action="search" query="apache 2.4"

# Search for specific CVE
exploits action="search" query="CVE-2021-44228"

# Suggest exploits for a finding
exploits action="suggest" findingId="finding_abc123"

# Get exploit details
exploits action="info" module="exploit/linux/http/apache_mod_cgi_bash_env_exec"

# Check if target is vulnerable
exploits action="check" module="exploit/linux/http/apache_mod_cgi_bash_env_exec" target="192.168.1.10"

# Execute exploit (dry run)
exploits action="execute" module="exploit/linux/http/apache_mod_cgi_bash_env_exec" target="192.168.1.10" dryRun=true

# Execute exploit (requires confirmation)
exploits action="execute" module="exploit/linux/http/apache_mod_cgi_bash_env_exec" target="192.168.1.10" options={"RHOSTS":"192.168.1.10","LHOST":"192.168.1.5"}
```

---

## Monitor - Continuous Monitoring

Create and manage scheduled security scans with alerting.

### Actions

| Action | Description |
|--------|-------------|
| `create` | Create new monitor |
| `list` | List all monitors |
| `get` | Get monitor details |
| `pause` | Pause a monitor |
| `resume` | Resume a monitor |
| `delete` | Delete a monitor |
| `trigger` | Trigger immediate scan |
| `status` | Get scheduler status |

### Schedule Types

| Type | Description |
|------|-------------|
| `interval` | Run every N milliseconds |
| `cron` | Cron expression schedule |

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | Yes | Action to perform |
| `monitorID` | string | No | Monitor ID for operations |
| `name` | string | No | Monitor name (for create) |
| `description` | string | No | Monitor description |
| `targets` | array | No | Targets to scan |
| `tools` | array | No | Tools to run |
| `scheduleType` | string | No | "interval" or "cron" |
| `intervalMs` | number | No | Interval in milliseconds |
| `cronExpression` | string | No | Cron expression |
| `alertMinSeverity` | string | No | Min severity for alerts |

### Examples

```
# Create daily nmap scan (every 24 hours)
monitor action="create" name="Daily Port Scan" targets=["192.168.1.0/24"] tools=[{"tool":"nmap","args":"-sV"}] scheduleType="interval" intervalMs=86400000

# Create vulnerability scan every 6 hours via cron
monitor action="create" name="Vuln Scan" targets=["https://example.com"] tools=[{"tool":"nuclei","args":"-t cves/"}] scheduleType="cron" cronExpression="0 */6 * * *"

# Create weekly full scan
monitor action="create" name="Weekly Full Scan" targets=["192.168.1.0/24"] tools=[{"tool":"nmap"},{"tool":"nikto"}] scheduleType="cron" cronExpression="0 2 * * 0" alertMinSeverity="medium"

# List all monitors
monitor action="list"

# Get monitor details
monitor action="get" monitorID="mon_abc123"

# Pause a monitor
monitor action="pause" monitorID="mon_abc123"

# Resume a monitor
monitor action="resume" monitorID="mon_abc123"

# Trigger immediate scan
monitor action="trigger" monitorID="mon_abc123"

# Delete a monitor
monitor action="delete" monitorID="mon_abc123"

# Get scheduler status
monitor action="status"
```

### Common Cron Expressions

| Expression | Description |
|------------|-------------|
| `0 * * * *` | Every hour |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * *` | Daily at midnight |
| `0 2 * * 0` | Weekly Sunday 2am |
| `0 0 1 * *` | Monthly 1st at midnight |

---

## Report - Report Generation

Generate security assessment reports in various formats.

### Report Types

| Type | Description |
|------|-------------|
| `executive` | High-level summary for management |
| `technical` | Detailed with evidence and remediation |
| `compliance` | Formatted for compliance requirements |
| `full` | Complete report with all data |

### Output Formats

| Format | Description |
|--------|-------------|
| `markdown` | Markdown format |
| `html` | HTML format |
| `json` | JSON data export |

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | No | Report type (default: full) |
| `format` | string | No | Output format (default: markdown) |
| `title` | string | No | Report title |
| `sessionId` | string | No | Filter by session |
| `scanId` | string | No | Filter by scan |
| `minSeverity` | string | No | Minimum severity to include |
| `outputFile` | string | No | Save to file path |

### Examples

```
# Generate executive summary in HTML
report type="executive" format="html"

# Full technical report in markdown
report type="technical" format="markdown"

# Compliance report
report type="compliance" format="html" title="Q1 2024 Security Assessment"

# Export findings as JSON
report format="json" outputFile="/tmp/findings.json"

# Report for specific session
report type="full" sessionId="session_abc123"

# Report with severity filter
report type="technical" minSeverity="high"

# Save HTML report to file
report type="full" format="html" outputFile="/tmp/security_report.html"
```

---

## Common Patterns

### Sequential Workflow

```
# 1. Discover targets
netscan action="discover" target="192.168.1.0/24"

# 2. Scan discovered hosts
netscan action="scan" target="192.168.1.0/24" profile="standard"

# 3. Deep dive on interesting hosts
sectools tool="nmap" target="192.168.1.10" args="-sV -sC -A"

# 4. Web scan if web services found
webscan action="full-scan" target="http://192.168.1.10"

# 5. Check for known CVEs
cve action="search" keyword="apache 2.4.49"

# 6. Generate report
report type="technical" format="html"
```

### Cloud Security Assessment

```
# 1. Check prerequisites
cloudscan action="prerequisites" provider="aws"

# 2. Discover resources
cloudscan action="discover" provider="aws" regions=["us-east-1"]

# 3. Run security scan
cloudscan action="scan" provider="aws" profile="thorough"

# 4. Compliance check
cloudscan action="compliance" provider="aws" frameworks=["cis","pci-dss"]

# 5. Generate report
report type="compliance" format="html"
```

### Container Security Pipeline

```
# 1. Scan image before deployment
containerscan action="scan-image" image="myapp:v1.0"

# 2. Generate SBOM
containerscan action="sbom" image="myapp:v1.0"

# 3. Check runtime security
containerscan action="scan-runtime"

# 4. Kubernetes audit
containerscan action="scan-cluster"

# 5. Compliance check
containerscan action="compliance" framework="cis-kubernetes"
```

### Continuous Monitoring Setup

```
# Create monitors for critical systems
monitor action="create" name="Prod Web Scan" targets=["https://prod.example.com"] tools=[{"tool":"nuclei"}] scheduleType="cron" cronExpression="0 */4 * * *" alertMinSeverity="medium"

monitor action="create" name="Infra Port Scan" targets=["10.0.0.0/24"] tools=[{"tool":"nmap","args":"-sV -F"}] scheduleType="interval" intervalMs=86400000

# Check status
monitor action="status"
```

---

## Severity Levels

All tools use consistent severity levels:

| Level | Description |
|-------|-------------|
| `critical` | Immediate exploitation risk |
| `high` | Serious vulnerability |
| `medium` | Moderate risk |
| `low` | Minor issue |
| `info` | Informational finding |

---

## Notes

- All tools automatically create findings in the session
- Use `createFindings=false` to disable finding creation
- Results are persisted and can be retrieved later
- Use profiles to balance speed vs thoroughness
- External tools (nmap, nuclei, etc.) must be installed separately
- Cloud scans require appropriate CLI tools and credentials configured
