# Phase 13: Mobile Application Scanner

## Overview

Phase 13 introduces the **Mobile Application Scanner** (`pentest/mobilescan/`) - a comprehensive security analysis module for Android APK and iOS IPA files, providing OWASP Mobile Top 10 2024 coverage.

## Module Structure

```
src/pentest/mobilescan/
├── index.ts              # Module exports
├── types.ts              # MobileScanTypes namespace (Zod schemas)
├── events.ts             # MobileScanEvents
├── storage.ts            # Scan persistence
├── profiles.ts           # Scan profiles
├── tool.ts               # MobileScanTool for agent
├── orchestrator.ts       # Scan coordination
├── parsers/
│   ├── index.ts
│   ├── apktool.ts        # APKTool output parser
│   ├── jadx.ts           # JADX decompiled source parser
│   ├── mobsf.ts          # MobSF JSON report parser
│   └── androguard.ts     # Androguard analysis parser
├── android/
│   ├── index.ts
│   ├── manifest.ts       # AndroidManifest.xml analysis
│   ├── permissions.ts    # Permission risk analysis
│   ├── components.ts     # Activity/Service/Receiver analysis
│   └── security.ts       # Crypto, storage, network analysis
├── ios/
│   ├── index.ts
│   ├── plist.ts          # Info.plist analysis
│   └── security.ts       # Binary, keychain, ATS analysis
└── common/
    ├── index.ts
    ├── ssl-pinning.ts    # Certificate pinning detection
    ├── root-detection.ts # Root/jailbreak detection
    ├── obfuscation.ts    # Code obfuscation analysis
    ├── api-keys.ts       # API key extraction with entropy
    └── urls.ts           # URL/endpoint extraction
```

## OWASP Mobile Top 10 2024 Coverage

| ID | Category | Checks |
|----|----------|--------|
| M1 | Improper Credential Usage | Hardcoded credentials, insecure key storage, credentials in URLs |
| M2 | Inadequate Supply Chain Security | Third-party library analysis, known vulnerabilities |
| M3 | Insecure Authentication/Authorization | Weak auth patterns, missing session management |
| M4 | Insufficient Input/Output Validation | Input validation, SQL injection, path traversal |
| M5 | Insecure Communication | Missing SSL pinning, cleartext traffic, weak TLS |
| M6 | Inadequate Privacy Controls | Excessive permissions, data leakage, tracking |
| M7 | Insufficient Binary Protections | Missing PIE, no obfuscation, debug enabled |
| M8 | Security Misconfiguration | Backup enabled, debug mode, exported components |
| M9 | Insecure Data Storage | Cleartext storage, SQLite, SharedPreferences |
| M10 | Insufficient Cryptography | Weak algorithms, hardcoded keys, insecure random |

## Usage

### Basic Analysis

```typescript
import { MobileScanOrchestrator, MobileScanProfiles } from "./pentest/mobilescan"

// Full analysis with standard profile
const result = await MobileScanOrchestrator.analyze("/path/to/app.apk", {
  profile: "standard"
})

console.log(`Platform: ${result.platform}`)
console.log(`Findings: ${result.findings.length}`)
console.log(`Secrets: ${result.secrets.length}`)
console.log(`URLs: ${result.urls.length}`)

// Quick scan for critical issues
const quickResult = await MobileScanOrchestrator.quickScan("/path/to/app.apk")

// Get scan status
const status = await MobileScanOrchestrator.getStatus(result.id)

// List analyzed apps
const apps = await MobileScanOrchestrator.listApps()
```

### Android APK Analysis

```typescript
import { ManifestAnalyzer, PermissionAnalyzer, ComponentAnalyzer, AndroidSecurityAnalyzer } from "./pentest/mobilescan"

// Parse AndroidManifest.xml
const manifest = await ManifestAnalyzer.parseManifest("/path/to/extracted/AndroidManifest.xml")
console.log(`Package: ${manifest.packageName}`)
console.log(`Debuggable: ${manifest.debuggable}`)
console.log(`Allow Backup: ${manifest.allowBackup}`)
console.log(`Min SDK: ${manifest.minSdkVersion}`)

// Analyze permissions
const permissions = PermissionAnalyzer.analyzePermissions(manifest.permissions)
console.log(`Total: ${permissions.total}`)
console.log(`Dangerous: ${permissions.dangerous}`)
console.log(`High Risk: ${permissions.highRisk.join(", ")}`)

// Check unusual permission combinations
const unusual = PermissionAnalyzer.checkUnusualCombinations(manifest.permissions)
for (const combo of unusual) {
  console.log(`[!] ${combo}`)
}

// Analyze exported components
const compFindings = ComponentAnalyzer.analyzeExportedComponents(
  manifest,
  scanId,
  appId,
  "android"
)
console.log(`Component issues: ${compFindings.length}`)

// Full Android security analysis
const securityFindings = await AndroidSecurityAnalyzer.analyzeAll(
  extractedDir,
  sourceFiles,
  scanId,
  appId
)
```

### iOS IPA Analysis

```typescript
import { PlistAnalyzer, iOSSecurityAnalyzer } from "./pentest/mobilescan"

// Parse Info.plist
const plist = await PlistAnalyzer.parsePlist("/path/to/extracted/Info.plist")
console.log(`Bundle ID: ${plist.bundleId}`)
console.log(`Version: ${plist.version}`)
console.log(`Min iOS: ${plist.minOSVersion}`)
console.log(`ATS Allows Arbitrary Loads: ${plist.atsSettings?.allowsArbitraryLoads}`)

// Analyze ATS settings
const atsFindings = PlistAnalyzer.analyzeATSSettings(
  plist.atsSettings,
  scanId,
  appId,
  "ios"
)

// Full iOS security analysis
const iosFindings = await iOSSecurityAnalyzer.analyzeAll(
  extractedDir,
  sourceFiles,
  scanId,
  appId
)
```

### Common Analysis Modules

```typescript
import {
  SSLPinningDetector,
  RootDetector,
  ObfuscationAnalyzer,
  ApiKeyExtractor,
  UrlExtractor
} from "./pentest/mobilescan"

// SSL Pinning Detection
const sslResult = await SSLPinningDetector.detect(sourceFiles, "android")
console.log(`SSL Pinning Detected: ${sslResult.detected}`)
if (sslResult.implementation) {
  console.log(`Implementation: ${sslResult.implementation}`)
}

// Root/Jailbreak Detection
const rootResult = await RootDetector.detect(sourceFiles, "android")
console.log(`Root Detection: ${rootResult.detected}`)
console.log(`Methods: ${rootResult.methods.join(", ")}`)
console.log(`Strength: ${rootResult.strength}`)

// Code Obfuscation Analysis
const obfResult = await ObfuscationAnalyzer.analyze(sourceFiles, "android")
console.log(`Obfuscation Detected: ${obfResult.detected}`)
console.log(`Tool: ${obfResult.tool}`)
console.log(`Strength: ${obfResult.strength}`)

// API Key Extraction
const secrets = await ApiKeyExtractor.extractFromFiles(sourceFiles)
for (const secret of secrets) {
  console.log(`[${secret.type}] ${secret.maskedValue}`)
  console.log(`  File: ${secret.location.file}:${secret.location.line}`)
  console.log(`  Confidence: ${secret.confidence}`)
  console.log(`  Entropy: ${secret.entropy}`)
}

// URL Extraction
const urls = await UrlExtractor.extractFromFiles(sourceFiles)
const categorized = UrlExtractor.categorizeUrls(urls)
console.log(`API Endpoints: ${categorized.api.length}`)
console.log(`Internal URLs: ${categorized.internal.length}`)
console.log(`Insecure HTTP: ${categorized.insecure.length}`)
console.log(`With Credentials: ${categorized.withCredentials.length}`)
```

### Using Parsers

```typescript
import { ApktoolParser, JadxParser, MobsfParser, AndroguardParser } from "./pentest/mobilescan"

// Parse APKTool output
const apktoolManifest = ApktoolParser.parseManifest(manifestXml)
const apktoolStrings = ApktoolParser.parseStrings(stringsXml)

// Parse JADX decompiled sources
const jadxStrings = JadxParser.extractStrings(sourceFiles)
const jadxUrls = JadxParser.extractUrls(sourceFiles)
const jadxApiKeys = await JadxParser.extractApiKeys(sourceFiles)

// Parse MobSF report
const mobsfReport = MobsfParser.parseAndroidReport(jsonReport, scanId, appId)
console.log(`Findings: ${mobsfReport.findings.length}`)
console.log(`Secrets: ${mobsfReport.secrets.length}`)
console.log(`Security Score: ${mobsfReport.securityScore}`)

// Parse Androguard output
const androguardResult = AndroguardParser.parseAnalysis(jsonOutput, scanId, appId, "android")
```

## Tool Actions

| Action | Description |
|--------|-------------|
| `analyze` | Full analysis with specified profile |
| `quick-scan` | Fast scan for critical issues only |
| `manifest` | Analyze AndroidManifest.xml or Info.plist |
| `permissions` | Permission risk analysis |
| `network` | Network security configuration analysis |
| `storage` | Data storage security analysis |
| `crypto` | Cryptographic implementation review |
| `secrets` | Hardcoded secrets/API key detection |
| `ssl-pinning` | Certificate pinning detection |
| `binary` | Binary protection analysis |
| `components` | Exported components analysis (Android) |
| `decompile` | Decompile APK/IPA for manual review |
| `sbom` | Generate software bill of materials |
| `status` | Get scan status |
| `apps` | List analyzed apps |
| `findings` | Get findings for a scan |
| `profiles` | List available scan profiles |

## Scan Profiles

| Profile | Static Analysis | Decompile | External Tools | Use Case |
|---------|-----------------|-----------|----------------|----------|
| `discovery` | Manifest only | No | APKTool | Quick app identification |
| `quick` | Critical checks | No | APKTool | Fast triage scan |
| `standard` | Full analysis | Partial | APKTool, JADX | Regular security assessment |
| `thorough` | Full + libraries | Full | All tools | Comprehensive audit |
| `compliance` | OWASP checks | Full | MobSF | Compliance verification |

## Security Checks

### Android Checks

| Check | Severity | OWASP | Description |
|-------|----------|-------|-------------|
| Debuggable App | Critical | M8 | android:debuggable="true" |
| Allow Backup | High | M9 | android:allowBackup="true" |
| Cleartext Traffic | High | M5 | usesCleartextTraffic="true" |
| Exported Components | Medium-Critical | M8 | Unprotected activities/services/receivers |
| Dangerous Permissions | Varies | M6 | READ_CONTACTS, CAMERA, LOCATION, etc. |
| Weak Crypto | High | M10 | DES, MD5, SHA1, ECB mode |
| Hardcoded Keys | Critical | M1 | API keys, secrets in code |
| Insecure Storage | High | M9 | MODE_WORLD_READABLE/WRITABLE |
| SQL Injection | High | M4 | Raw queries with concatenation |
| Missing SSL Pinning | Medium | M5 | No certificate pinning |
| Missing Root Detection | Low | M7 | No root/emulator detection |
| No Obfuscation | Low | M7 | Easily reverse-engineered |

### iOS Checks

| Check | Severity | OWASP | Description |
|-------|----------|-------|-------------|
| ATS Disabled | High | M5 | NSAllowsArbitraryLoads = YES |
| Missing PIE | High | M7 | Position Independent Executable disabled |
| Missing ARC | Medium | M7 | Automatic Reference Counting disabled |
| No Stack Canary | High | M7 | Stack smashing protection disabled |
| Symbols Not Stripped | Low | M7 | Debug symbols exposed |
| Weak Crypto | High | M10 | Insecure algorithms |
| Hardcoded Keys | Critical | M1 | API keys, secrets in code |
| Insecure Keychain | High | M9 | kSecAttrAccessibleAlways |
| Missing Jailbreak Detection | Low | M7 | No jailbreak detection |
| Insecure URL Schemes | Medium | M8 | Custom URL scheme vulnerabilities |

## Events

| Event | Description |
|-------|-------------|
| `pentest.mobilescan.scan_started` | Scan began |
| `pentest.mobilescan.scan_completed` | Scan finished |
| `pentest.mobilescan.scan_failed` | Scan failed |
| `pentest.mobilescan.app_analyzed` | App metadata extracted |
| `pentest.mobilescan.finding_detected` | Security issue found |
| `pentest.mobilescan.secret_found` | Hardcoded secret detected |
| `pentest.mobilescan.permission_risk` | Risky permission identified |
| `pentest.mobilescan.ssl_pinning_missing` | No SSL pinning detected |
| `pentest.mobilescan.component_exported` | Unprotected component found |

## Data Types

### MobileApp

```typescript
{
  id: string                    // Unique app ID
  sessionId: string             // Session ID
  platform: "android" | "ios"
  name: string                  // App name
  packageName: string           // com.example.app or bundle ID
  version: string
  minSdkVersion?: number        // Android only
  targetSdkVersion?: number     // Android only
  minOSVersion?: string         // iOS only
  filePath: string
  fileHash: string
  size: number
  analyzedAt: number
}
```

### MobileScanResult

```typescript
{
  id: string
  appId: string
  app: MobileApp
  profile: string
  platform: "android" | "ios"
  status: "pending" | "running" | "completed" | "failed"
  findings: MobileFinding[]
  manifest?: AndroidManifest | IOSPlist
  permissions?: PermissionAnalysis
  networkSecurity?: NetworkSecurityAnalysis
  binaryProtections?: BinaryProtections
  storageAnalysis?: StorageAnalysis
  cryptoAnalysis?: CryptoAnalysis
  rootDetection?: RootDetectionResult
  obfuscation?: ObfuscationResult
  secrets: ExtractedSecret[]
  urls: ExtractedURL[]
  libraries: ThirdPartyLibrary[]
  stats: ScanStats
  startTime: number
  endTime?: number
  error?: string
}
```

### MobileFinding

```typescript
{
  id: string
  scanId: string
  appId: string
  platform: "android" | "ios"
  title: string
  description: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  owaspMobile: "M1" | "M2" | ... | "M10"
  category: string              // manifest, permissions, crypto, etc.
  component?: string            // Activity, Service, etc.
  codeLocation?: {
    file: string
    line?: number
    snippet?: string
  }
  evidence?: string
  cwe?: string
  cvss?: number
  recommendation?: string
  references?: string[]
  falsePositive: boolean
  verified: boolean
  detectedAt: number
}
```

### ExtractedSecret

```typescript
{
  id: string
  type: "api_key" | "aws_key" | "gcp_key" | "firebase_key" |
        "private_key" | "jwt_secret" | "oauth_secret" |
        "database_credential" | "generic_secret" | ...
  value: string
  maskedValue: string
  location: {
    file: string
    line?: number
    snippet?: string
  }
  confidence: "high" | "medium" | "low"
  entropy?: number
  context?: string
}
```

## External Tools

### Required Tools

| Tool | Purpose | Command | Installation |
|------|---------|---------|--------------|
| APKTool | APK unpacking | `apktool d app.apk -o output/` | https://ibotpeaches.github.io/Apktool/ |
| JADX | Java decompilation | `jadx -d output/ app.apk` | https://github.com/skylot/jadx |

### Optional Tools

| Tool | Purpose | Command | Installation |
|------|---------|---------|--------------|
| MobSF | Full mobile analysis | REST API | https://github.com/MobSF/Mobile-Security-Framework-MobSF |
| Androguard | Python analysis | `androguard analyze app.apk` | https://github.com/androguard/androguard |
| aapt2 | APK metadata | `aapt2 dump badging app.apk` | Android SDK |
| dex2jar | DEX conversion | `d2j-dex2jar app.apk` | https://github.com/pxb1988/dex2jar |
| Frida | Dynamic analysis | `frida -U -f package` | https://frida.re/ |
| objection | Runtime manipulation | `objection explore` | https://github.com/sensepost/objection |

## Example Use Cases

### Use Case 1: Pre-Release Security Audit

Perform a thorough security assessment before app release.

```bash
# Full analysis with thorough profile
mobilescan analyze file=/path/to/release.apk profile=thorough

# Check findings
mobilescan findings scanId=mobilescan_abc123 severity=critical

# Generate SBOM for compliance
mobilescan sbom file=/path/to/release.apk
```

### Use Case 2: Quick Triage of Multiple Apps

Quickly identify critical issues across multiple applications.

```bash
# Quick scan each app
mobilescan quick-scan file=/path/to/app1.apk
mobilescan quick-scan file=/path/to/app2.apk
mobilescan quick-scan file=/path/to/app3.apk

# List all analyzed apps
mobilescan apps
```

### Use Case 3: API Security Review

Focus on API communication and secrets.

```bash
# Check for hardcoded secrets
mobilescan secrets file=/path/to/app.apk

# Analyze SSL pinning
mobilescan ssl-pinning file=/path/to/app.apk

# Review network security config
mobilescan network file=/path/to/app.apk
```

### Use Case 4: Permission Audit

Review app permissions for privacy compliance.

```bash
# Analyze permissions
mobilescan permissions file=/path/to/app.apk
```

Example output:
```
Permission Analysis
========================================
Total Permissions: 15
Dangerous: 5
Normal: 8
Signature: 2
Custom: 0

High Risk Permissions:
  [!] android.permission.READ_CONTACTS
  [!] android.permission.ACCESS_FINE_LOCATION
  [!] android.permission.CAMERA

Unusual Combinations:
  [!] App requests both CAMERA and RECORD_AUDIO without media features
  [!] App requests SMS and CONTACTS - potential data harvesting

Recommendations:
  - Review necessity of READ_CONTACTS permission
  - Consider using ACCESS_COARSE_LOCATION instead of ACCESS_FINE_LOCATION
```

### Use Case 5: Decompile for Manual Review

Extract and decompile app for manual code review.

```bash
# Decompile to directory
mobilescan decompile file=/path/to/app.apk outputDir=/tmp/decompiled

# Manual review
ls /tmp/decompiled/
# AndroidManifest.xml
# res/
# smali/
# sources/  (if JADX available)
```

### Use Case 6: iOS App Security Assessment

Analyze iOS IPA file.

```bash
# Full iOS analysis
mobilescan analyze file=/path/to/app.ipa profile=standard

# Check binary protections
mobilescan binary file=/path/to/app.ipa
```

Example output:
```
Binary Protection Analysis
========================================
PIE (ASLR): Yes
ARC: Yes
Stack Canary: Yes
Symbols Stripped: No (symbols exposed)
Encrypted: Yes

Root/Jailbreak Detection:
  Detected: Yes
  Methods: fileExistsAtPath, canOpenURL, fopen
  Strength: medium

Code Obfuscation:
  Detected: No
```

### Use Case 7: Continuous Integration

Integrate into CI/CD pipeline.

```typescript
import { MobileScanOrchestrator } from "./pentest/mobilescan"

async function securityGate(apkPath: string): Promise<boolean> {
  const result = await MobileScanOrchestrator.analyze(apkPath, {
    profile: "quick"
  })

  const criticalFindings = result.findings.filter(f => f.severity === "critical")
  const highFindings = result.findings.filter(f => f.severity === "high")

  if (criticalFindings.length > 0) {
    console.error(`FAILED: ${criticalFindings.length} critical findings`)
    for (const f of criticalFindings) {
      console.error(`  - ${f.title} (${f.owaspMobile})`)
    }
    return false
  }

  if (highFindings.length > 5) {
    console.error(`FAILED: Too many high-severity findings (${highFindings.length})`)
    return false
  }

  console.log("PASSED: Security gate checks")
  return true
}
```

## Storage

Scan data is persisted in:

```
pentest/mobilescan/
  scans/
    mobilescan_abc123.json    # Scan results
  apps/
    app_def456.json           # App metadata
  findings/
    finding_ghi789.json       # Individual findings
  secrets/
    secret_jkl012.json        # Extracted secrets
```

## Testing

Run the tests:

```bash
bun test test/pentest/mobilescan.test.ts
```

## Integration

The tool is registered in `src/tool/registry.ts`:
- `MobileScanTool` - Available as `mobilescan` tool

Exports available from `src/pentest/index.ts`:
- All types: `MobileScanTypes`
- Events: `MobileScanEvents`
- Storage: `MobileScanStorage`
- Profiles: `MobileScanProfiles`
- Orchestrator: `MobileScanOrchestrator`
- Tool: `MobileScanTool`
- Parsers: `ApktoolParser`, `JadxParser`, `MobsfParser`, `AndroguardParser`
- Android: `ManifestAnalyzer`, `PermissionAnalyzer`, `ComponentAnalyzer`, `AndroidSecurityAnalyzer`
- iOS: `PlistAnalyzer`, `iOSSecurityAnalyzer`
- Common: `SSLPinningDetector`, `RootDetector`, `ObfuscationAnalyzer`, `ApiKeyExtractor`, `UrlExtractor`

## API Key Detection Patterns

The scanner detects the following secret patterns:

| Type | Pattern | Example |
|------|---------|---------|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | AKIAIOSFODNN7EXAMPLE |
| AWS Secret Key | `[A-Za-z0-9/+=]{40}` | wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY |
| Google API Key | `AIza[0-9A-Za-z_-]{35}` | AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe |
| Firebase Key | `AIza[0-9A-Za-z_-]{35}` | AIzaSyClzfrOzB818x55FASHvX4JuGQciR9lv7q |
| GitHub Token | `gh[pousr]_[A-Za-z0-9_]{36}` | ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx |
| Private Key | `-----BEGIN.*PRIVATE KEY-----` | RSA, EC, DSA private keys |
| JWT Secret | High entropy strings in JWT context | - |
| Generic API Key | `[A-Za-z0-9_-]{20,}` with high entropy | - |

## SSL Pinning Detection Patterns

### Android

| Implementation | Pattern |
|----------------|---------|
| OkHttp CertificatePinner | `CertificatePinner.Builder()` |
| Network Security Config | `pin-set` in XML |
| TrustManager | `X509TrustManager`, `checkServerTrusted` |
| Retrofit | `certificatePinner` |

### iOS

| Implementation | Pattern |
|----------------|---------|
| URLSession | `URLSessionDelegate`, `didReceiveChallenge` |
| TrustKit | `TrustKit`, `TSKPinningValidator` |
| Alamofire | `ServerTrustManager`, `PinnedCertificatesTrustEvaluator` |
| AFNetworking | `AFSecurityPolicy`, `pinnedCertificates` |

## Root/Jailbreak Detection Patterns

### Android Root Detection

| Check | Description |
|-------|-------------|
| Su binary | `/system/xbin/su`, `/system/bin/su` |
| Superuser app | `/system/app/Superuser.apk` |
| Magisk | `magisk`, `MagiskManager` |
| Build tags | `test-keys` |
| Dangerous props | `ro.debuggable=1` |
| RW system | Writable system partition |

### iOS Jailbreak Detection

| Check | Description |
|-------|-------------|
| Cydia | `/Applications/Cydia.app` |
| Substrate | `/Library/MobileSubstrate` |
| SSH | `/usr/sbin/sshd`, `/usr/bin/ssh` |
| Apt | `/etc/apt` |
| URL schemes | `cydia://` |
| Fork | `fork()` behavior |
