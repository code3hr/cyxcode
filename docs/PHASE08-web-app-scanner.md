# Phase 8: Web Application Scanner - Implementation Report

This document describes what was implemented in Phase 8 of the cyxcode project.

---

## Overview

Phase 8 added comprehensive web application scanning capabilities, including crawling, multi-tool orchestration, and OWASP categorization.

**Goal:** Enable automated web application security scanning with coordinated tool execution.

**Status:** Complete

---

## Features

1. **Web Crawler**: Discover URLs and forms using native fetch() with regex-based extraction
2. **Scan Orchestration**: Coordinate multiple security tools with pre-defined profiles
3. **OWASP Top 10 2021**: Categorize findings by OWASP Top 10 categories
4. **New Parsers**: WPScanParser and WhatWebParser for WordPress/fingerprinting

---

## Module Structure

```
src/pentest/webscan/
├── index.ts              # Module exports
├── types.ts              # Zod schemas (20+ types)
├── events.ts             # BusEvent definitions (9 events)
├── crawler.ts            # Web crawler with regex extraction
├── orchestrator.ts       # Scan orchestration service
├── profiles.ts           # Pre-defined scan profiles
├── storage.ts            # Crawl/scan persistence
├── owasp.ts              # OWASP categorization
├── tool.ts               # WebScanTool for agent
└── parsers/
    ├── index.ts          # Parser exports
    ├── wpscan.ts         # WPScan JSON parser
    └── whatweb.ts        # WhatWeb JSON parser
```

---

## Data Models

### CrawlResult

```typescript
{
  id: string
  target: string              // Base URL
  urls: DiscoveredUrl[]       // All discovered URLs
  forms: DiscoveredForm[]     // All discovered forms
  stats: {
    urlsDiscovered: number
    urlsVisited: number
    formsDiscovered: number
    maxDepthReached: number
    errorCount: number
    duration: number
  }
  options: CrawlOptions
  startedAt: number
  completedAt?: number
  status: Status              // pending, running, completed, failed, stopped
}
```

### ScanResult

```typescript
{
  id: string
  target: string
  profile: ProfileId          // quick, standard, thorough, passive, custom
  crawlID?: string
  tools: ToolExecution[]
  findings: string[]          // Finding IDs
  stats: {
    urlsScanned: number
    toolsRun: number
    toolsFailed: number
    findingsCount: number
    criticalCount: number
    highCount: number
    mediumCount: number
    lowCount: number
    infoCount: number
    duration: number
  }
  startedAt: number
  completedAt?: number
  status: Status
}
```

---

## Scan Profiles

| Profile | Crawl | Tools | Use Case |
|---------|-------|-------|----------|
| `quick` | depth=1, max=50 | whatweb, nikto | Fast initial assessment |
| `standard` | depth=2, max=200 | whatweb, nikto, gobuster, nuclei | Normal pentest |
| `thorough` | depth=3, max=500 | All web tools | Comprehensive scan |
| `passive` | none | whatweb, wafw00f | No active testing |
| `custom` | configurable | user-selected | Custom configuration |

---

## Key Components

### 1. WebCrawler (`crawler.ts`)

- Uses native `fetch()` for HTTP requests
- Regex-based link extraction (no DOM library)
- Regex-based form extraction with input detection
- Respects robots.txt when enabled
- URL normalization and same-origin filtering
- Configurable depth, URL limits, and delays

### 2. ScanOrchestrator (`orchestrator.ts`)

- Executes crawl if profile.crawl.enabled
- Runs tools sequentially with error handling
- Parses tool output to generate findings
- Aggregates statistics across tools
- Publishes events for progress tracking

### 3. ScanProfiles (`profiles.ts`)

- Pre-defined profiles for common scenarios
- Custom profile creation with overrides
- Per-tool options configuration

### 4. OwaspCategorization (`owasp.ts`)

- Pattern-based categorization using regex and keywords
- Maps findings to OWASP Top 10 2021 categories
- Confidence scoring based on match count
- CVE presence automatically maps to A06

### 5. WebScanTool (`tool.ts`)

- Agent-facing tool for web scanning operations
- Actions: crawl, scan, quick-scan, full-scan, urls, forms, status, owasp, profiles
- Scope validation via GovernanceScope
- Permission requests for network/tool access

### 6. Parsers

- **WPScanParser**: Parses WPScan JSON output for WordPress vulnerabilities
- **WhatWebParser**: Parses WhatWeb JSON/text output for technology fingerprinting

---

## Events

| Event | Description |
|-------|-------------|
| `pentest.webscan.crawl_started` | Crawl began |
| `pentest.webscan.url_discovered` | New URL found |
| `pentest.webscan.form_discovered` | New form found |
| `pentest.webscan.crawl_completed` | Crawl finished |
| `pentest.webscan.scan_started` | Scan began |
| `pentest.webscan.tool_started` | Tool execution started |
| `pentest.webscan.tool_completed` | Tool execution finished |
| `pentest.webscan.tool_failed` | Tool execution failed |
| `pentest.webscan.scan_completed` | Scan finished |

---

## WebScanTool Actions

| Action | Description |
|--------|-------------|
| `crawl` | Crawl a target URL to discover pages/forms |
| `scan` | Run scan with specific profile |
| `quick-scan` | Quick scan (alias for quick profile) |
| `full-scan` | Thorough scan (alias for thorough profile) |
| `urls` | List discovered URLs from a crawl |
| `forms` | List discovered forms from a crawl |
| `status` | Get status of running crawl/scan |
| `owasp` | Categorize findings by OWASP Top 10 |
| `profiles` | List available scan profiles |

---

## OWASP Top 10 2021 Categorization

| Category | Detection Patterns |
|----------|-------------------|
| A01:2021 Broken Access Control | path traversal, IDOR, privilege escalation, CORS |
| A02:2021 Cryptographic Failures | SSL/TLS, weak cipher, plaintext, HSTS |
| A03:2021 Injection | SQLi, XSS, command injection, XXE, SSTI |
| A04:2021 Insecure Design | business logic, rate limit, race condition |
| A05:2021 Security Misconfiguration | default creds, debug mode, headers, directory listing |
| A06:2021 Vulnerable Components | outdated software, CVEs, known vulnerabilities |
| A07:2021 Auth Failures | weak passwords, session, brute force, enumeration |
| A08:2021 Data Integrity Failures | deserialization, CI/CD, supply chain |
| A09:2021 Logging Failures | missing logs, log injection, audit |
| A10:2021 SSRF | server-side request forgery |

---

## Files Created

```
packages/opencode/src/pentest/webscan/
├── types.ts           # 20+ Zod schemas
├── events.ts          # 9 BusEvent definitions
├── crawler.ts         # Web crawler
├── orchestrator.ts    # Scan orchestration
├── profiles.ts        # Profile definitions
├── storage.ts         # Persistence
├── owasp.ts           # OWASP categorization
├── tool.ts            # WebScanTool
├── index.ts           # Module exports
└── parsers/
    ├── index.ts       # Parser exports
    ├── wpscan.ts      # WPScan parser
    └── whatweb.ts     # WhatWeb parser

packages/opencode/test/pentest/
└── webscan.test.ts    # 35+ tests

docs/
└── PHASE8.md          # This documentation
```

## Files Modified

| File | Changes |
|------|---------|
| `src/pentest/index.ts` | Added webscan exports |
| `src/tool/registry.ts` | Registered WebScanTool |

---

## Usage Examples

### Crawl a Target

```
action="crawl"
target="http://example.com"
maxDepth=2
maxUrls=100
```

### Quick Scan

```
action="quick-scan"
target="http://example.com"
```

### Standard Scan

```
action="scan"
target="http://example.com"
profile="standard"
```

### Full Scan

```
action="full-scan"
target="http://example.com"
```

### Custom Scan

```
action="scan"
target="http://example.com"
profile="custom"
tools=["nikto", "nuclei", "gobuster"]
```

### List URLs from Crawl

```
action="urls"
crawlID="crawl_abc123"
limit=50
```

### OWASP Categorization

```
action="owasp"
scanID="scan_xyz789"
```

### Programmatic Usage

```typescript
import { WebCrawler, ScanOrchestrator, ScanProfiles, OwaspCategorization } from "./pentest/webscan"

// Crawl a target
const crawlResult = await WebCrawler.crawl("http://example.com", {
  maxDepth: 2,
  maxUrls: 200,
})

// Run a scan with profile
const scanResult = await ScanOrchestrator.scan(
  "http://example.com",
  ScanProfiles.Standard,
  { sessionID: "session_123" }
)

// Categorize findings
const owasp = await OwaspCategorization.categorize(scanResult.id)
console.log(OwaspCategorization.format(owasp))
```

---

## Storage Layout

```
pentest/webscan/
  crawls/
    crawl_abc123.json       # Crawl results
  scans/
    scan_xyz789.json        # Scan results
```

---

## Crawler Implementation

The crawler uses native `fetch()` with regex-based extraction:

```typescript
// Link extraction
const HREF_REGEX = /href=["']([^"'#]+)["']/gi

// Form extraction
const FORM_REGEX = /<form[^>]*>([\s\S]*?)<\/form>/gi
const INPUT_REGEX = /<input[^>]*>/gi
```

Key features:
- Same-origin URL filtering
- JavaScript/mailto/tel link filtering
- Configurable robots.txt respect
- Include/exclude URL patterns
- Request delay between fetches
- Timeout per request

---

## Test Coverage

**Test File:** `test/pentest/webscan.test.ts`

**Test Categories:**

| Category | Tests |
|----------|-------|
| WebCrawler.extractLinks | 3 tests - href, relative, skip js/mailto |
| WebCrawler.extractForms | 3 tests - inputs, file upload, textarea/select |
| ScanProfiles | 5 tests - profiles, configuration, custom |
| WebScanStorage | 6 tests - crawl/scan CRUD, filters |
| WPScanParser | 4 tests - JSON parsing, findings, format |
| WhatWebParser | 4 tests - JSON/text parsing, findings |
| OwaspCategorization | 8 tests - category detection |
| WebScanTypes | 3 tests - schema validation |

---

## Dependencies

- No external packages (uses native fetch)
- Uses existing: Storage, Bus, Findings, GovernanceScope, GovernanceMatcher
- CLI tools: nikto, gobuster, ffuf, nuclei, wpscan, whatweb, wafw00f (must be installed)

---

## Future Enhancements

1. **Additional Tools**
   - sqlmap integration with form fuzzing
   - dirb/dirbuster support
   - skipfish integration

2. **Crawler Improvements**
   - JavaScript rendering (headless browser)
   - API endpoint discovery
   - GraphQL introspection
   - WebSocket detection

3. **Scan Features**
   - Authenticated scanning
   - Session handling
   - Rate limiting
   - Parallel tool execution

4. **Reporting**
   - OWASP-focused reports
   - Executive summaries
   - Remediation priorities

---

## Related Documentation

- [PHASE7.md](./PHASE7.md) - Exploit Framework Integration
- [PHASE6.md](./PHASE6.md) - Continuous Monitoring
- [PHASE5.md](./PHASE5.md) - Report Generation
- [PENTEST.md](./PENTEST.md) - Pentest module reference
