# Phase 16: Post-Exploitation Framework

## Overview

Phase 16 introduces the **Post-Exploitation Framework** (`pentest/postexploit/`) - a guidance-based framework for privilege escalation, lateral movement, credential harvesting, persistence, data exfiltration, and cleanup during authorized penetration testing engagements.

> **IMPORTANT**: This module provides GUIDANCE and INFORMATION for authorized penetration testing. It does not automatically execute exploits. All techniques are documented for educational purposes and authorized security assessments only.

## Module Structure

```
src/pentest/postexploit/
├── index.ts              # Module exports
├── types.ts              # PostExploitTypes namespace (Zod schemas)
├── events.ts             # PostExploitEvents
├── storage.ts            # Session persistence
├── profiles.ts           # Assessment profiles
├── tool.ts               # PostExploitTool for agent
├── orchestrator.ts       # Workflow coordination
├── privesc/
│   ├── index.ts
│   ├── linux.ts          # Linux privesc (SUID, sudo, capabilities, kernel)
│   └── windows.ts        # Windows privesc (services, registry, tokens, UAC)
├── lateral/
│   ├── index.ts
│   ├── discovery.ts      # Target discovery
│   ├── methods.ts        # Movement methods (SMB, WMI, SSH, RDP)
│   └── paths.ts          # Path analysis
├── creds/
│   ├── index.ts
│   ├── discovery.ts      # Credential location discovery
│   ├── linux.ts          # Linux creds (shadow, SSH keys, configs)
│   └── windows.ts        # Windows creds (SAM, LSASS, NTDS, DPAPI)
├── persistence/
│   ├── index.ts
│   ├── catalog.ts        # Mechanism catalog
│   ├── linux.ts          # Linux persistence (cron, systemd, SSH keys)
│   └── windows.ts        # Windows persistence (registry, tasks, WMI)
├── exfil/
│   ├── index.ts
│   ├── targets.ts        # Data target discovery
│   └── channels.ts       # Exfil channels (DNS, HTTP, SSH, SMB)
├── cleanup/
│   ├── index.ts
│   ├── artifacts.ts      # Artifact tracking
│   ├── logs.ts           # Log cleanup guidance
│   └── checklist.ts      # Cleanup verification checklist
└── parsers/
    ├── index.ts
    ├── linpeas.ts        # LinPEAS output parser
    └── winpeas.ts        # WinPEAS output parser
```

## Capabilities

### Privilege Escalation

#### Linux Vectors

| Category | Description | MITRE |
|----------|-------------|-------|
| SUID Binaries | Exploitable SUID binaries with GTFOBins references | T1548.001 |
| Sudo Misconfig | Sudo rule exploitation | T1548.003 |
| Capabilities | Linux capabilities abuse | T1068 |
| Cron Jobs | Writable cron job exploitation | T1053.003 |
| Kernel Exploits | Kernel vulnerability exploitation | T1068 |
| Service Abuse | Writable service files | T1574.010 |
| Path Hijacking | PATH environment exploitation | T1574.007 |
| Container Escape | Docker/container breakout | T1611 |

#### Windows Vectors

| Category | Description | MITRE |
|----------|-------------|-------|
| Service Exploits | Unquoted paths, weak permissions | T1574.010 |
| Registry Abuse | AlwaysInstallElevated, autorun | T1547.001 |
| Token Manipulation | SeImpersonate, SeDebug privileges | T1134 |
| UAC Bypass | FodHelper, EventVwr, CMSTP | T1548.002 |
| DLL Hijacking | Missing DLL exploitation | T1574.001 |
| Scheduled Tasks | Task file manipulation | T1053.005 |
| Stored Credentials | Credential Manager, DPAPI | T1555 |

### Lateral Movement

| Method | Ports | Description | MITRE |
|--------|-------|-------------|-------|
| SMB/PSExec | 445 | Remote command execution | T1021.002 |
| WMI | 135 | Windows Management Instrumentation | T1047 |
| WinRM | 5985/5986 | Windows Remote Management | T1021.006 |
| RDP | 3389 | Remote Desktop Protocol | T1021.001 |
| SSH | 22 | Secure Shell | T1021.004 |
| Pass-the-Hash | - | NTLM hash authentication | T1550.002 |
| Pass-the-Ticket | - | Kerberos ticket reuse | T1550.003 |
| DCOM | 135 | Distributed COM | T1021.003 |

### Credential Harvesting

#### Linux Locations

| Source | Path | Access Level | Description |
|--------|------|--------------|-------------|
| Shadow | /etc/shadow | root | Password hashes |
| SSH Keys | ~/.ssh/ | user | Private keys |
| History | ~/.bash_history | user | Command history |
| Config Files | Various | user/root | Application credentials |
| Environment | /proc/*/environ | varies | Environment variables |
| Memory | /proc/*/maps | root | Process memory |

#### Windows Locations

| Source | Location | Access Level | Description |
|--------|----------|--------------|-------------|
| SAM | %SystemRoot%\System32\config\SAM | SYSTEM | Local account hashes |
| LSASS | Memory | SYSTEM | Live credentials |
| NTDS | %SystemRoot%\NTDS\ntds.dit | Domain Admin | Domain hashes |
| DPAPI | %AppData%\Microsoft\Protect | user | Protected secrets |
| Credential Manager | Credential Manager | user | Stored passwords |
| Browser | Various | user | Saved passwords |
| Kerberos | Memory | varies | Tickets |
| WiFi | netsh | admin | Network passwords |

### Persistence Mechanisms

#### Linux

| Category | Location | Survival | Detection Risk |
|----------|----------|----------|----------------|
| Cron | /etc/crontab, /var/spool/cron | reboot | medium |
| Systemd | /etc/systemd/system | reboot | medium |
| Shell Profile | ~/.bashrc, ~/.profile | login | low |
| SSH Keys | ~/.ssh/authorized_keys | reboot | low |
| LD Preload | /etc/ld.so.preload | reboot | high |
| PAM | /etc/pam.d/ | reboot | high |
| Init Scripts | /etc/init.d/ | reboot | medium |
| Kernel Module | /lib/modules/ | reboot | high |

#### Windows

| Category | Location | Survival | Detection Risk |
|----------|----------|----------|----------------|
| Registry Run | HKLM/HKCU\...\Run | reboot | medium |
| Scheduled Task | Task Scheduler | reboot | medium |
| Service | services.msc | reboot | high |
| WMI Subscription | WMI Repository | reboot | low |
| Startup Folder | %AppData%\...\Startup | login | medium |
| DLL Hijack | Application directories | app restart | low |
| COM Hijack | Registry CLSID | app use | low |
| Print Monitor | Registry | reboot | high |

### Data Exfiltration Channels

| Channel | Stealth | Bandwidth | Description |
|---------|---------|-----------|-------------|
| DNS | high | low | DNS tunneling |
| HTTP/HTTPS | medium | high | Web-based exfil |
| ICMP | high | low | Ping tunneling |
| SSH | medium | high | Encrypted tunnel |
| SMB | low | high | File share transfer |
| Cloud | medium | high | Cloud storage APIs |
| Email | medium | medium | SMTP-based exfil |
| Steganography | high | low | Hidden in images |

## Usage

### Session Management

```typescript
import { PostExploitOrchestrator, PostExploitProfiles } from "./pentest/postexploit"

// Create a new post-exploitation session
const session = await PostExploitOrchestrator.createSession({
  target: "192.168.1.100",
  platform: "linux",
  currentUser: "www-data",
  currentPrivilege: "user",
  hostname: "webserver01",
  profile: "standard"
})

console.log(`Session ID: ${session.id}`)
console.log(`Platform: ${session.platform}`)
console.log(`Profile: ${session.profile}`)

// Get session status
const status = await PostExploitOrchestrator.getStatus(session.id)
console.log(`Privesc Vectors: ${status.privescVectors}`)
console.log(`Lateral Targets: ${status.lateralTargets}`)
console.log(`Credentials Found: ${status.credentialsDiscovered}`)

// Complete session
await PostExploitOrchestrator.completeSession(session.id)
```

### Privilege Escalation Scan

```typescript
import { Privesc, LinuxPrivesc, WindowsPrivesc } from "./pentest/postexploit"

// Get discovery commands
const commands = Privesc.getDiscoveryCommands("linux")
console.log("Discovery Commands:")
for (const cmd of commands) {
  console.log(`  ${cmd}`)
}

// Get SUID binary info
const suidBinaries = Privesc.getSUIDBinaryInfo()
for (const binary of suidBinaries) {
  console.log(`${binary.name}:`)
  console.log(`  Technique: ${binary.technique}`)
  console.log(`  Commands: ${binary.commands.join("; ")}`)
  console.log(`  GTFOBins: ${binary.gtfobins}`)
}

// Get sudo exploitation guidance
const sudoExploits = Privesc.getSudoInfo()
for (const exploit of sudoExploits) {
  console.log(`${exploit.name}:`)
  console.log(`  Risk: ${exploit.risk}`)
  console.log(`  Technique: ${exploit.technique}`)
}

// Windows service exploitation
const serviceVulns = Privesc.getServiceInfo()
for (const vuln of serviceVulns) {
  console.log(`${vuln.name}: ${vuln.description}`)
  console.log(`  MITRE: ${vuln.mitre.join(", ")}`)
}

// UAC bypass techniques
const uacBypasses = Privesc.getUACBypassInfo()
for (const bypass of uacBypasses) {
  console.log(`${bypass.name}:`)
  console.log(`  Binary: ${bypass.binary}`)
  console.log(`  Detection Risk: ${bypass.detectionRisk}`)
}

// Quick win checks
const quickWins = Privesc.getQuickWinChecks("linux")
for (const check of quickWins) {
  console.log(`  ${check}`)
}
```

### Lateral Movement Discovery

```typescript
import { Lateral, LateralDiscovery, LateralMethods, LateralPaths } from "./pentest/postexploit"

// Get discovery commands
const discoveryCommands = Lateral.getDiscoveryCommands("windows")
console.log("Network Discovery:")
for (const cmd of discoveryCommands) {
  console.log(`  ${cmd}`)
}

// Get available methods
const methods = Lateral.getMethods("windows")
for (const method of methods) {
  console.log(`${method.name}:`)
  console.log(`  Description: ${method.description}`)
  console.log(`  Detection Risk: ${method.detectionRisk}`)
}

// Analyze target
const target = Lateral.analyzeTarget("192.168.1.50", [22, 445, 3389], "dc01")
console.log(`Target: ${target.host}`)
console.log(`Suggested Methods: ${target.suggestedMethods.join(", ")}`)

// Create movement path
const path = Lateral.createPath("192.168.1.100", "192.168.1.50", "smb", {
  credentials: "admin:hash",
  credentialType: "hash"
})
console.log(`Path: ${path.source} -> ${path.destination}`)

// Quick reference
const quickRef = Lateral.getQuickReference()
console.log(quickRef)
```

### Credential Discovery

```typescript
import { Creds, CredDiscovery, LinuxCreds, WindowsCreds } from "./pentest/postexploit"

// Get credential locations
const locations = Creds.getLocations("linux")
for (const loc of locations) {
  console.log(`${loc.source}:`)
  console.log(`  Path: ${loc.path}`)
  console.log(`  Access: ${loc.accessLevel}`)
  console.log(`  Expected Types: ${loc.expectedTypes.join(", ")}`)
}

// Get quick commands
const quickCommands = Creds.getQuickCommands("windows")
console.log("Quick Credential Commands:")
for (const cmd of quickCommands) {
  console.log(`  ${cmd}`)
}

// Get source-specific commands
const lsassCommands = Creds.getSourceCommands("windows", "lsass")
console.log("LSASS Extraction:")
for (const cmd of lsassCommands) {
  console.log(`  ${cmd}`)
}

// Get recommended tools
const tools = Creds.getTools("windows")
console.log("Recommended Tools:")
for (const tool of tools) {
  console.log(`  - ${tool}`)
}

// Priority order
const priority = Creds.getPriorityOrder("linux")
console.log("Priority Order:")
for (const item of priority) {
  console.log(`  ${item}`)
}
```

### Persistence Catalog

```typescript
import { Persistence, PersistenceCatalog, LinuxPersistence, WindowsPersistence } from "./pentest/postexploit"

// Get all mechanisms
const mechanisms = Persistence.getMechanisms("linux")
for (const mech of mechanisms) {
  console.log(`${mech.name}:`)
  console.log(`  Category: ${mech.category}`)
  console.log(`  Location: ${mech.location}`)
  console.log(`  Privilege: ${mech.privilege}`)
  console.log(`  Survival: ${mech.survival}`)
  console.log(`  Detection Risk: ${mech.detectionRisk}`)
  console.log(`  MITRE: ${mech.mitre.join(", ")}`)
}

// Get mechanism commands
const cronCommands = Persistence.getMechanismCommands("linux", "cron")
console.log("Cron Setup:")
for (const cmd of cronCommands.setup) {
  console.log(`  ${cmd}`)
}
console.log("Cron Cleanup:")
for (const cmd of cronCommands.cleanup) {
  console.log(`  ${cmd}`)
}

// Get recommendations
const recommendations = Persistence.getRecommendations("windows", {
  privilege: "admin",
  stealth: true
})
console.log("Recommended:")
for (const rec of recommendations) {
  console.log(`  - ${rec}`)
}
```

### Data Exfiltration

```typescript
import { Exfil, DataTargets, ExfilChannels } from "./pentest/postexploit"

// Get discovery commands
const exfilCommands = Exfil.getDiscoveryCommands("windows")
console.log("Data Discovery:")
for (const cmd of exfilCommands) {
  console.log(`  ${cmd}`)
}

// Get stealthy channels
const stealthyChannels = Exfil.getStealthyChannels()
console.log(`Stealthy Channels: ${stealthyChannels.join(", ")}`)

// Get high bandwidth channels
const highBwChannels = Exfil.getHighBandwidthChannels()
console.log(`High Bandwidth: ${highBwChannels.join(", ")}`)

// Get channel details
const dnsDetails = Exfil.getChannelDetails("dns")
console.log(`DNS Exfil:`)
console.log(`  Stealth: ${dnsDetails.stealth}`)
console.log(`  Bandwidth: ${dnsDetails.bandwidth}`)
console.log(`  Tools: ${dnsDetails.tools.join(", ")}`)

// Quick reference
const exfilRef = Exfil.getQuickReference()
console.log(exfilRef)
```

### Cleanup and Artifact Tracking

```typescript
import { Cleanup, ArtifactTracking, LogCleanup, CleanupChecklist } from "./pentest/postexploit"

// Generate cleanup checklist
const checklist = Cleanup.generateChecklist("linux", session.artifacts, {
  includeLogGuidance: true
})

for (const item of checklist) {
  const status = item.verified ? "[x]" : "[ ]"
  console.log(`${status} ${item.description}`)
  console.log(`    Command: ${item.command}`)
  console.log(`    Priority: ${item.priority}`)
}

// Get log cleanup guidance
const logGuidance = Cleanup.formatLogGuidance("linux")
console.log(logGuidance)

// Format artifacts
const artifactSummary = Cleanup.formatArtifacts(session.artifacts)
console.log(artifactSummary)

// Get quick reference
const cleanupRef = Cleanup.getQuickReference("windows")
console.log(cleanupRef)
```

### LinPEAS/WinPEAS Parser

```typescript
import { Parsers, LinPEASParser, WinPEASParser } from "./pentest/postexploit"

// Parse LinPEAS output
const linpeasOutput = await fs.readFile("/tmp/linpeas_output.txt", "utf-8")
const linpeasResult = LinPEASParser.parse(linpeasOutput)

console.log(`SUID Binaries: ${linpeasResult.suidBinaries.length}`)
console.log(`Sudo Entries: ${linpeasResult.sudoEntries.length}`)
console.log(`Capabilities: ${linpeasResult.capabilities.length}`)
console.log(`Interesting Files: ${linpeasResult.interestingFiles.length}`)

// Extract privesc vectors
const vectors = LinPEASParser.extractPrivescVectors(linpeasResult)
for (const vector of vectors) {
  console.log(`[${vector.risk}] ${vector.name}`)
  console.log(`  Category: ${vector.category}`)
  console.log(`  Technique: ${vector.technique}`)
}

// Parse WinPEAS output
const winpeasOutput = await fs.readFile("/tmp/winpeas_output.txt", "utf-8")
const winpeasResult = WinPEASParser.parse(winpeasOutput)

console.log(`Services: ${winpeasResult.services.length}`)
console.log(`Scheduled Tasks: ${winpeasResult.scheduledTasks.length}`)
console.log(`Token Privileges: ${winpeasResult.tokenPrivileges.length}`)
console.log(`Registry Issues: ${winpeasResult.registryIssues.length}`)

// Auto-detect and parse
const autoResult = Parsers.parse("auto", output)
const formatted = Parsers.formatResults("auto", autoResult)
console.log(formatted)
```

## Tool Actions

| Action | Description |
|--------|-------------|
| `session` | Create or manage a post-exploitation session |
| `privesc` | Scan for privilege escalation vectors |
| `lateral` | Discover lateral movement targets and paths |
| `creds` | Discover credential storage locations |
| `persist` | Catalog persistence mechanisms |
| `exfil` | Discover data targets and exfiltration channels |
| `cleanup` | Generate cleanup guidance and checklist |
| `parse` | Parse LinPEAS/WinPEAS output |
| `status` | Get session status and summary |
| `profiles` | List available assessment profiles |
| `assess` | Run full assessment based on profile |
| `list` | List sessions |

## Assessment Profiles

| Profile | Privesc | Lateral | Creds | Persist | Exfil | Cleanup | Stealth |
|---------|---------|---------|-------|---------|-------|---------|---------|
| `discovery` | basic | enum | passive | catalog | discover | track | yes |
| `quick` | critical | basic | passive | no | no | track | no |
| `standard` | full | full | guided | catalog | full | full | no |
| `thorough` | deep | deep | deep | catalog | full | full | no |
| `stealth` | passive | passive | passive | no | passive | full | yes |

## Events

| Event | Description |
|-------|-------------|
| `pentest.postexploit.session_started` | Session created |
| `pentest.postexploit.session_completed` | Session finished |
| `pentest.postexploit.privesc_vector_found` | Privesc vector discovered |
| `pentest.postexploit.lateral_target_discovered` | Lateral movement target found |
| `pentest.postexploit.credential_discovered` | Credential location found |
| `pentest.postexploit.persistence_opportunity` | Persistence option identified |
| `pentest.postexploit.data_target_found` | Sensitive data target discovered |
| `pentest.postexploit.artifact_created` | Artifact tracked |
| `pentest.postexploit.cleanup_guidance_generated` | Cleanup checklist created |

## Data Types

### PostExploitSession

```typescript
{
  id: string
  target: string
  platform: "linux" | "windows"
  currentUser: string
  currentPrivilege: "user" | "admin" | "root" | "system"
  hostname?: string
  domain?: string
  profile: ProfileId
  status: "running" | "completed" | "failed"
  privescVectors: PrivescVector[]
  lateralTargets: LateralTarget[]
  lateralPaths: LateralPath[]
  credentialLocations: CredentialLocation[]
  persistenceMechanisms: PersistenceMechanism[]
  dataTargets: DataTarget[]
  exfilChannels: ExfilChannel[]
  artifacts: Artifact[]
  startedAt: number
  endedAt?: number
}
```

### PrivescVector

```typescript
{
  id: string
  category: "suid" | "sudo" | "kernel" | "cron" | "service" | "registry" | "token" | "uac_bypass" | ...
  platform: "linux" | "windows"
  name: string
  description: string
  risk: "critical" | "high" | "medium" | "low"
  exploitability: "trivial" | "easy" | "moderate" | "difficult"
  target: string
  technique: string
  commands: string[]
  prerequisites: string[]
  detectionRisk: "low" | "medium" | "high"
  gtfobins?: string
  lolbas?: string
  mitre: string[]
  discoveredAt: number
}
```

### LateralPath

```typescript
{
  id: string
  source: string
  destination: string
  method: "smb" | "wmi" | "ssh" | "rdp" | "winrm" | "pass_the_hash" | "pass_the_ticket" | ...
  credentials?: string
  credentialType?: "password" | "hash" | "ticket" | "key"
  risk: "critical" | "high" | "medium" | "low"
  detectionRisk: "low" | "medium" | "high"
  commands: string[]
  tested: boolean
  successful: boolean
  notes?: string
  mitre: string[]
  discoveredAt: number
}
```

### PersistenceMechanism

```typescript
{
  id: string
  category: PersistenceCategory
  platform: "linux" | "windows"
  name: string
  description: string
  location: string
  privilege: "user" | "admin" | "system"
  survival: "reboot" | "logout" | "service_restart"
  detectionRisk: "low" | "medium" | "high"
  commands: string[]
  cleanup: string[]
  indicators: string[]
  mitre: string[]
  catalogedAt: number
}
```

### Artifact

```typescript
{
  id: string
  sessionId: string
  type: "file" | "process" | "registry" | "service" | "scheduled_task" | "user" | "log_entry"
  path: string
  description: string
  host: string
  createdBy: string
  createdAt: number
  cleaned: boolean
  cleanedAt?: number
  cleanupCommand?: string
  verifyCommand?: string
}
```

## External Tools Integration

### Recommended Tools

| Tool | Platform | Purpose |
|------|----------|---------|
| LinPEAS | Linux | Privilege escalation enumeration |
| WinPEAS | Windows | Privilege escalation enumeration |
| pspy | Linux | Process monitoring without root |
| Mimikatz | Windows | Credential extraction |
| Rubeus | Windows | Kerberos operations |
| Impacket | Both | Network protocols toolkit |
| BloodHound | Windows | AD path analysis |
| PowerUp | Windows | PowerShell privesc checks |
| BeRoot | Both | Privesc scanner |

### GTFOBins & LOLBAS

- **GTFOBins**: https://gtfobins.github.io/ - Unix binaries exploitation
- **LOLBAS**: https://lolbas-project.github.io/ - Windows living-off-the-land binaries

## Example Use Cases

### Use Case 1: Linux Post-Exploitation

```bash
# Create session
postexploit session target=192.168.1.100 platform=linux user=www-data

# Scan for privilege escalation
postexploit privesc sessionId=<id>

# Parse LinPEAS output
postexploit parse tool=linpeas file=/tmp/linpeas.txt sessionId=<id>

# Discover credentials
postexploit creds sessionId=<id>

# Generate cleanup checklist
postexploit cleanup sessionId=<id>
```

### Use Case 2: Windows Post-Exploitation

```bash
# Create session
postexploit session target=192.168.1.50 platform=windows user=DOMAIN\\user privilege=user

# Full assessment
postexploit assess sessionId=<id>

# Parse WinPEAS output
postexploit parse tool=winpeas file=C:\\temp\\winpeas.txt sessionId=<id>

# Discover lateral movement targets
postexploit lateral sessionId=<id>

# Get session status
postexploit status sessionId=<id>
```

### Use Case 3: Stealth Assessment

```bash
# Create stealth session
postexploit session target=10.0.0.100 platform=linux user=app profile=stealth

# Run stealth assessment (passive only)
postexploit assess sessionId=<id>

# Track artifacts
postexploit status sessionId=<id>

# Comprehensive cleanup
postexploit cleanup sessionId=<id>
```

## Storage

Session data is persisted in:

```
pentest/postexploit/
  sessions/
    session_abc123.json           # Session data
  vectors/
    privesc_def456.json           # Privesc vectors
  paths/
    lateral_ghi789.json           # Lateral paths
  credentials/
    cred_jkl012.json              # Credential locations
  mechanisms/
    persist_mno345.json           # Persistence mechanisms
  artifacts/
    artifact_pqr678.json          # Tracked artifacts
```

## Testing

Run the tests:

```bash
bun test test/pentest/postexploit.test.ts
```

## Integration

The tool is registered in `src/tool/registry.ts`:
- `PostExploitTool` - Available as `postexploit` tool

Exports available from `src/pentest/index.ts`:
- All types: `PostExploitTypes`
- Events: `PostExploitEvents`
- Storage: `PostExploitStorage`
- Profiles: `PostExploitProfiles`
- Orchestrator: `PostExploitOrchestrator`
- Tool: `PostExploitTool`
- Privesc: `Privesc`, `LinuxPrivesc`, `WindowsPrivesc`
- Lateral: `Lateral`, `LateralDiscovery`, `LateralMethods`, `LateralPaths`
- Creds: `Creds`, `CredDiscovery`, `LinuxCreds`, `WindowsCreds`
- Persistence: `Persistence`, `PersistenceCatalog`, `LinuxPersistence`, `WindowsPersistence`
- Exfil: `Exfil`, `DataTargets`, `ExfilChannels`
- Cleanup: `Cleanup`, `ArtifactTracking`, `LogCleanup`, `CleanupChecklist`
- Parsers: `Parsers`, `LinPEASParser`, `WinPEASParser`

## MITRE ATT&CK Mapping

All techniques are mapped to MITRE ATT&CK framework:

| Tactic | Techniques |
|--------|------------|
| Privilege Escalation | T1548, T1068, T1134, T1574 |
| Lateral Movement | T1021, T1047, T1550 |
| Credential Access | T1003, T1552, T1555 |
| Persistence | T1053, T1547, T1543, T1546 |
| Collection | T1005, T1039, T1074 |
| Exfiltration | T1048, T1041, T1567 |
| Defense Evasion | T1070, T1112, T1564 |

## Safety Design

1. **Guidance-First**: Provides commands to understand, not automated execution
2. **Explicit Confirmation**: Artifact creation requires user confirmation
3. **Artifact Tracking**: All created artifacts tracked for cleanup
4. **Risk Assessment**: Each technique includes detection risk rating
5. **MITRE Mapping**: All techniques mapped to ATT&CK for reporting
6. **Cleanup Verification**: Comprehensive cleanup checklists
