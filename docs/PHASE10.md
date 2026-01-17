# Phase 10: Network Infrastructure Scanner

## Overview

The Network Infrastructure Scanner module (`pentest/netscan`) provides comprehensive network infrastructure security testing capabilities including:

- **Active Directory**: Domain enumeration, user/group/computer discovery, Kerberoasting, AS-REP roasting, trust enumeration
- **SMB**: Share enumeration, null session testing, SMB signing checks, vulnerability detection (EternalBlue, SMBGhost, PrintNightmare)
- **SNMP**: Community string brute-forcing, SNMP walking, write access testing
- **DNS**: Zone transfer attempts, subdomain enumeration, cache poisoning checks
- **LDAP**: Anonymous bind testing, enumeration, password policy extraction
- **Credentials**: Default credential testing, password spraying with lockout awareness

## Module Structure

```
src/pentest/netscan/
├── index.ts              # Module exports
├── types.ts              # Zod schemas (30+ types)
├── events.ts             # BusEvent definitions (20+ events)
├── storage.ts            # Scan/host/credential persistence
├── profiles.ts           # Scan profile definitions
├── tool.ts               # NetScanTool for agent
├── orchestrator.ts       # Scan workflow coordination
├── parsers/
│   ├── index.ts          # Parser exports
│   ├── crackmapexec.ts   # CrackMapExec output parser
│   ├── enum4linux.ts     # Enum4linux-ng output parser
│   └── ldapsearch.ts     # LDIF/ldapsearch output parser
├── smb/
│   ├── index.ts          # SMB module exports
│   ├── shares.ts         # Share enumeration
│   ├── sessions.ts       # Null/guest session testing
│   ├── signing.ts        # SMB signing checks
│   └── vulns.ts          # SMB vulnerability detection
├── dns/
│   ├── index.ts          # DNS module exports
│   ├── zone.ts           # Zone transfer testing
│   ├── enum.ts           # Subdomain enumeration
│   └── cache.ts          # Cache poisoning checks
├── snmp/
│   ├── index.ts          # SNMP module exports
│   ├── community.ts      # Community string testing
│   ├── walk.ts           # SNMP tree walking
│   └── write.ts          # SNMP write access testing
├── ldap/
│   ├── index.ts          # LDAP module exports
│   ├── bind.ts           # Anonymous/authenticated bind
│   ├── enum.ts           # LDAP enumeration
│   └── policy.ts         # Password policy extraction
├── ad/
│   ├── index.ts          # AD module exports
│   ├── enumeration.ts    # Domain enumeration
│   ├── kerberos.ts       # Kerberoast/AS-REP roast
│   └── trusts.ts         # Domain trust enumeration
└── creds/
    ├── index.ts          # Credential module exports
    ├── defaults.ts       # Default credential database
    └── spray.ts          # Password spraying
```

## Usage

### Active Directory Enumeration

```typescript
import { ADEnumeration, Kerberos, DomainTrusts } from "./pentest/netscan"

// Full AD enumeration
const result = await ADEnumeration.enumerate({
  dc: "192.168.1.10",
  domain: "corp.local",
  auth: { username: "user", password: "pass" },
})

console.log(ADEnumeration.formatResults(result))

// Get specific objects
const users = await ADEnumeration.getUsers("192.168.1.10", {
  username: "user",
  password: "pass",
  domain: "corp.local",
})

const groups = await ADEnumeration.getGroups("192.168.1.10", auth)
const computers = await ADEnumeration.getComputers("192.168.1.10", auth)

// Find Kerberoastable accounts
const kerbResult = await Kerberos.findTargets({
  dc: "192.168.1.10",
  domain: "corp.local",
  auth: { username: "user", password: "pass" },
})

console.log(`Kerberoastable: ${kerbResult.kerberoastTargets.length}`)
console.log(`AS-REP roastable: ${kerbResult.asrepTargets.length}`)

// Enumerate domain trusts
const trusts = await DomainTrusts.enumerate({
  dc: "192.168.1.10",
  domain: "corp.local",
  auth: { username: "user", password: "pass" },
})
```

### SMB Testing

```typescript
import { SMBShares, SMBSessions, SMBSigning, SMBVulns } from "./pentest/netscan"

// Enumerate shares
const shares = await SMBShares.enumerate("192.168.1.10", {
  auth: { username: "user", password: "pass" },
  checkAccess: true,
})

// Test null session
const nullResult = await SMBSessions.testNullSession("192.168.1.10")
console.log(`Null session allowed: ${nullResult.allowed}`)

// Check SMB signing
const signing = await SMBSigning.check("192.168.1.10")
console.log(`SMB signing required: ${signing.required}`)

// Check for vulnerabilities
const vulns = await SMBVulns.check("192.168.1.10", {
  checks: ["ms17-010", "cve-2020-0796", "printnightmare"],
})
```

### DNS Testing

```typescript
import { DNSZone, DNSEnum } from "./pentest/netscan"

// Attempt zone transfer
const zoneResult = await DNSZone.attemptTransfer("example.com", {
  nameservers: ["ns1.example.com", "ns2.example.com"],
})

if (zoneResult.success) {
  console.log(`Zone transfer successful! ${zoneResult.records.length} records`)
}

// Subdomain enumeration
const subdomains = await DNSEnum.enumerate("example.com", {
  bruteForce: true,
  wordlist: ["www", "mail", "ftp", "dev", "staging"],
})
```

### SNMP Testing

```typescript
import { SNMPCommunity, SNMPWalk } from "./pentest/netscan"

// Brute-force community strings
const bruteResult = await SNMPCommunity.bruteForce("192.168.1.1", {
  communities: ["public", "private", "cisco", "secret"],
})

// SNMP walk with found community
if (bruteResult.validCommunities.length > 0) {
  const walkResult = await SNMPWalk.walk("192.168.1.1", {
    community: bruteResult.validCommunities[0],
  })
}
```

### LDAP Testing

```typescript
import { LDAPBind, LDAPEnum, LDAPPolicy } from "./pentest/netscan"

// Test anonymous bind
const bindResult = await LDAPBind.testAnonymous("192.168.1.10")
console.log(`Anonymous bind: ${bindResult.anonymous}`)

// Enumerate LDAP
const ldapResult = await LDAPEnum.enumerate("192.168.1.10", {
  baseDN: "DC=corp,DC=local",
  auth: { username: "user", password: "pass" },
})

// Extract password policy
const policy = await LDAPPolicy.extract("192.168.1.10", {
  baseDN: "DC=corp,DC=local",
})

console.log(`Min password length: ${policy.minLength}`)
console.log(`Lockout threshold: ${policy.lockoutThreshold}`)
```

### Credential Testing

```typescript
import { DefaultCreds, PasswordSpray } from "./pentest/netscan"

// Test default credentials
const credResults = await DefaultCreds.test("192.168.1.10", "ssh", 22)

// Password spray with lockout awareness
const sprayResult = await PasswordSpray.spray(
  { host: "192.168.1.10", port: 445, service: "smb", domain: "CORP" },
  ["admin", "user1", "user2"],
  ["Password1", "Welcome1", "Summer2024"],
  {
    delayBetweenPasswords: 30000,  // 30 seconds between passwords
    lockoutThreshold: 5,           // Stop before lockout
    observationWindow: 30,         // Lockout window in minutes
  }
)

console.log(`Valid credentials: ${sprayResult.valid.length}`)
console.log(`Locked accounts: ${sprayResult.locked.length}`)
```

### Running Full Scans

```typescript
import { NetScanOrchestrator, NetScanProfiles } from "./pentest/netscan"

// Quick scan
const result = await NetScanOrchestrator.scan("192.168.1.0/24", {
  profile: "quick",
})

// Full scan with authentication
const result = await NetScanOrchestrator.scan("192.168.1.0/24", {
  profile: "thorough",
  auth: { username: "user", password: "pass", domain: "CORP" },
})

// AD-focused scan
const result = await NetScanOrchestrator.scan("192.168.1.10", {
  profile: "ad-focused",
  auth: { username: "user", password: "pass", domain: "CORP" },
})

// Get scan status
const status = await NetScanOrchestrator.getStatus(result.id)
```

### Tool Actions

The `netscan` tool supports the following actions:

| Action | Description |
|--------|-------------|
| `discover` | Discover network hosts and services |
| `scan` | Run full scan with specified profile |
| `ad-enum` | Enumerate Active Directory domain |
| `ad-users` | List domain users |
| `ad-groups` | List domain groups |
| `ad-computers` | List domain computers |
| `ad-kerberoast` | Find Kerberoastable accounts |
| `ad-asrep` | Find AS-REP roastable accounts |
| `smb-shares` | Enumerate SMB shares |
| `smb-null` | Test null session access |
| `smb-signing` | Check SMB signing configuration |
| `smb-vulns` | Check for SMB vulnerabilities |
| `snmp-walk` | SNMP walk with community string |
| `snmp-brute` | Brute-force SNMP community strings |
| `dns-zone` | Attempt DNS zone transfer |
| `dns-enum` | Enumerate subdomains |
| `ldap-enum` | LDAP enumeration |
| `ldap-policy` | Extract password policy |
| `creds-default` | Test default credentials |
| `creds-spray` | Password spraying attack |
| `status` | Get scan status |
| `profiles` | List available scan profiles |

## Scan Profiles

| Profile | SMB | AD | SNMP | DNS | LDAP | Creds | Use Case |
|---------|-----|----|----- |-----|------|-------|----------|
| `discovery` | no | no | no | no | no | no | Host discovery only |
| `quick` | yes | no | no | no | yes | no | Fast assessment |
| `standard` | yes | yes | no | yes | yes | no | Normal pentest |
| `thorough` | yes | yes | yes | yes | yes | yes | Comprehensive |
| `stealth` | yes | no | no | no | yes | no | Low and slow |
| `ad-focused` | yes | yes | no | no | yes | no | AD-specific testing |
| `custom` | configurable | configurable | configurable | configurable | configurable | configurable | Custom configuration |

## Vulnerability Checks

### SMB Vulnerabilities

| Vulnerability | CVE | Description |
|---------------|-----|-------------|
| EternalBlue | MS17-010 | Remote code execution in SMBv1 |
| SMBGhost | CVE-2020-0796 | Buffer overflow in SMBv3 compression |
| PrintNightmare | CVE-2021-34527 | Print Spooler RCE |
| PetitPotam | - | NTLM relay via MS-EFSRPC |

### Kerberos Attacks

| Attack | Target | Detection |
|--------|--------|-----------|
| Kerberoasting | Service accounts with SPNs | servicePrincipalName attribute |
| AS-REP Roasting | Accounts without preauth | userAccountControl DONT_REQUIRE_PREAUTH |

## Events

The module emits the following events:

| Event | Description |
|-------|-------------|
| `pentest.netscan.scan_started` | Network scan began |
| `pentest.netscan.scan_completed` | Scan finished |
| `pentest.netscan.scan_failed` | Scan failed |
| `pentest.netscan.host_discovered` | New host found |
| `pentest.netscan.service_discovered` | Service detected |
| `pentest.netscan.ad_domain_found` | AD domain discovered |
| `pentest.netscan.ad_user_found` | Domain user enumerated |
| `pentest.netscan.ad_group_found` | Domain group enumerated |
| `pentest.netscan.kerberoast_target` | Kerberoastable account found |
| `pentest.netscan.asrep_target` | AS-REP roastable account found |
| `pentest.netscan.smb_share_found` | SMB share discovered |
| `pentest.netscan.null_session` | Null session allowed |
| `pentest.netscan.signing_disabled` | SMB signing not required |
| `pentest.netscan.vulnerability_found` | Vulnerability detected |
| `pentest.netscan.credential_found` | Valid credential discovered |
| `pentest.netscan.snmp_community_found` | Valid SNMP community string |
| `pentest.netscan.zone_transfer` | DNS zone transfer succeeded |
| `pentest.netscan.subdomain_found` | Subdomain discovered |
| `pentest.netscan.ldap_anonymous` | Anonymous LDAP bind allowed |
| `pentest.netscan.policy_weakness` | Password policy weakness |

## Storage

Network scan data is persisted in:

```
pentest/netscan/
  scans/
    netscan_abc123.json     # Scan results
  hosts/
    host_xyz789.json        # Discovered hosts
  credentials/
    cred_def456.enc         # Encrypted credentials
```

Credentials are encrypted with AES-256-CBC before storage.

## Data Types

### DiscoveredHost

```typescript
{
  id: string
  ip: string
  hostname?: string
  mac?: string
  os?: string
  osVersion?: string
  services: Service[]
  domain?: string
  isDomainController?: boolean
  discoveredAt: number
}
```

### Service

```typescript
{
  port: number
  protocol: "tcp" | "udp"
  service: string
  version?: string
  product?: string
  extraInfo?: string
}
```

### ADUser

```typescript
{
  dn: string
  samAccountName: string
  userPrincipalName?: string
  displayName?: string
  description?: string
  enabled: boolean
  adminCount: boolean
  memberOf: string[]
  servicePrincipalNames: string[]
  dontRequirePreauth: boolean
  lastLogon?: number
  passwordLastSet?: number
}
```

### SMBShare

```typescript
{
  name: string
  type: "DISK" | "IPC" | "PRINT" | "DEVICE"
  remark?: string
  permissions: {
    read: boolean
    write: boolean
    anonymous: boolean
  }
  sensitiveFiles?: string[]
}
```

### CredentialResult

```typescript
{
  id: string
  host: string
  service: string
  port: number
  username: string
  password?: string
  hash?: string
  method: "default" | "spray" | "brute" | "dump"
  valid: boolean
  admin: boolean
  timestamp: number
}
```

### NetScanResult

```typescript
{
  id: string
  target: string
  profile: ProfileId
  status: "pending" | "running" | "completed" | "failed"
  stats: {
    hostsScanned: number
    servicesFound: number
    vulnerabilitiesFound: number
    credentialsFound: number
  }
  findings: string[]
  startedAt: number
  completedAt?: number
  error?: string
}
```

## External Tool Parsers

The module includes parsers for common penetration testing tools:

### CrackMapExec

```typescript
import { CrackMapExecParser } from "./pentest/netscan"

const output = `SMB 192.168.1.10 445 DC01 [+] CORP\\admin:Password123 (Pwn3d!)`
const results = CrackMapExecParser.parse(output)

console.log(results.credentials)  // Valid credentials found
console.log(results.shares)       // Enumerated shares
console.log(results.hosts)        // Host information
```

### Enum4linux

```typescript
import { Enum4linuxParser } from "./pentest/netscan"

const output = await runEnum4linux("192.168.1.10")
const results = Enum4linuxParser.parse(output)

console.log(results.users)          // Enumerated users
console.log(results.groups)         // Enumerated groups
console.log(results.shares)         // Enumerated shares
console.log(results.passwordPolicy) // Password policy
```

### Ldapsearch

```typescript
import { LdapsearchParser } from "./pentest/netscan"

const ldif = await runLdapsearch(...)
const results = LdapsearchParser.parse(ldif)

console.log(results.entries)  // LDAP entries
const users = LdapsearchParser.extractUsers(results)
```

## Testing

Run the netscan tests with:

```bash
bun test test/pentest/netscan.test.ts
```

The test suite covers:
- CrackMapExec output parsing
- Enum4linux output parsing
- LDIF/ldapsearch parsing
- Profile configurations
- Storage operations
- Type validation
- Password spray utilities

## Dependencies

The module uses external tools:
- `smbclient` - SMB share enumeration
- `rpcclient` - RPC enumeration
- `ldapsearch` - LDAP queries
- `dig`/`host` - DNS queries
- `snmpwalk`/`snmpget` - SNMP operations
- `nmap` - Service discovery
- `sshpass` - SSH credential testing
- `xfreerdp` - RDP credential testing
- `crackmapexec` - Multi-protocol testing

Existing modules used:
- Storage, Bus, Findings, GovernanceScope
- Patterns from: apiscan module (Tool.define, storage, events)
