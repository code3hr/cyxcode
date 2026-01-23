# Phase 7: Exploit Framework Integration - Implementation Report

This document describes what was implemented in Phase 7 of the cyxwiz project.

---

## Overview

Phase 7 added exploit framework integration, enabling exploit search, matching, and safe execution with searchsploit and metasploit.

**Goal:** Enable automated exploit matching for findings with comprehensive safety controls.

**Status:** Complete

---

## Features

1. **Searchsploit Integration**: Parse Exploit-DB output, match by CVE/service
2. **Metasploit Integration**: Search MSF modules, get info, run checks
3. **Exploit Matching**: Auto-suggest exploits based on findings
4. **Safe Execution**: Dry-run default, mandatory confirmation, scope validation

---

## Module Structure

```
src/pentest/exploits/
├── index.ts              # Module exports
├── types.ts              # Zod schemas (12 types)
├── events.ts             # BusEvent definitions (7 events)
├── matcher.ts            # ExploitMatcher service
├── storage.ts            # Match/execution persistence
├── tool.ts               # ExploitTool for agent
└── parsers/
    ├── index.ts          # Parser exports
    ├── searchsploit.ts   # Searchsploit output parser
    └── metasploit.ts     # MSF output parser
```

---

## Data Models

### ExploitMatch

```typescript
{
  id: string                    // Unique ID (match_xxx)
  findingID: string             // Associated finding
  source: ExploitSource         // exploit-db, metasploit, etc.
  exploitID: string             // EDB-ID or MSF module path
  title: string                 // Exploit title
  description?: string
  type?: ExploitType            // remote, local, webapps, etc.
  rank?: ExploitRank            // excellent, great, good, etc.
  confidence: Confidence        // high, medium, low
  matchReason: string           // Why this exploit matches
  cve?: string[]                // Associated CVEs
  url?: string                  // Exploit-DB URL
  path?: string                 // Local file path
  status: MatchStatus           // suggested, verified, tested, dismissed
  createdAt: number
  verifiedAt?: number
}
```

### SearchsploitEntry

```typescript
{
  id: string                    // EDB-ID
  title: string                 // Exploit title
  path: string                  // Local file path
  date?: string                 // Publication date
  author?: string
  type?: ExploitType
  platform?: Platform
  port?: number
  cve?: string[]
  verified?: boolean            // Exploit-DB verified
}
```

### MetasploitModule

```typescript
{
  name: string                  // Full module path
  fullname?: string             // Human-readable name
  type: ExploitType
  rank?: ExploitRank
  disclosure_date?: string
  description?: string
  author?: string[]
  references?: string[]
  cve?: string[]
  platforms?: Platform[]
  options?: ModuleOption[]
  check?: boolean               // Has check method
  privileged?: boolean
}
```

---

## Key Components

### 1. SearchsploitParser (`parsers/searchsploit.ts`)

- Parses JSON output from `searchsploit -j`
- Falls back to text parsing for plain output
- Extracts CVEs from codes and titles
- Maps platform and exploit type

### 2. MetasploitParser (`parsers/metasploit.ts`)

- Parses msfconsole search output
- Extracts module info from `info` command
- Maps module types (exploit, auxiliary, post, etc.)
- Maps rank (excellent, great, good, etc.)

### 3. ExploitMatcher (`matcher.ts`)

- Builds search queries from findings (CVE, service, version)
- Searches both searchsploit and metasploit
- Deduplicates by exploitID
- Ranks matches by confidence, MSF rank, CVE count

### 4. ExploitStorage (`storage.ts`)

- Saves and retrieves exploit matches
- Supports file and memory storage modes
- Saves execution results for audit
- Filters by findingID, source, status

### 5. ExploitTool (`tool.ts`)

- Agent-facing tool for exploit operations
- Actions: search, suggest, info, check, execute, list
- Scope validation via governance
- Dry-run default for execution
- Never auto-approves exploit commands

---

## Events

| Event | Description |
|-------|-------------|
| `pentest.exploit.search_completed` | Search finished |
| `pentest.exploit.suggestions_generated` | Matches found for finding |
| `pentest.exploit.match_updated` | Match status changed |
| `pentest.exploit.check_executed` | Check ran |
| `pentest.exploit.execution_dry_run` | Dry run performed |
| `pentest.exploit.execution_completed` | Real execution completed |
| `pentest.exploit.execution_failed` | Execution failed |

---

## ExploitTool Actions

| Action | Description |
|--------|-------------|
| `search` | Search exploit databases by keyword/CVE |
| `suggest` | Auto-suggest exploits for a finding |
| `info` | Get detailed module information |
| `check` | Run exploit check (verify without exploit) |
| `execute` | Execute exploit (dry-run default, requires confirmation) |
| `list` | List saved exploit matches |

---

## Safety Requirements

1. **Scope Validation**: All targets checked against GovernanceScope before any operation
2. **Permission System**: All commands go through ctx.ask() for user confirmation
3. **Dry-Run Default**: execute action defaults to dryRun=true
4. **Never Auto-Approve**: Exploit commands use `always: []` to prevent auto-approval
5. **Audit Trail**: All operations publish events and save execution results

---

## Files Created

```
packages/opencode/src/pentest/exploits/
├── types.ts           # 12 Zod schemas
├── events.ts          # 7 BusEvent definitions
├── matcher.ts         # Exploit matching service
├── storage.ts         # Match/execution persistence
├── tool.ts            # ExploitTool for agents
├── index.ts           # Module exports
└── parsers/
    ├── index.ts       # Parser exports
    ├── searchsploit.ts # Searchsploit parser
    └── metasploit.ts  # Metasploit parser

packages/opencode/test/pentest/
└── exploits.test.ts   # 30+ tests
```

## Files Modified

| File | Changes |
|------|---------|
| `src/pentest/index.ts` | Added exploit exports |
| `src/tool/registry.ts` | Registered ExploitTool |

---

## Usage Examples

### Search for Exploits (Agent Tool)

```
action="search"
query="apache 2.4"
source="both"
```

### Suggest Exploits for Finding

```
action="suggest"
findingID="finding_abc123"
```

### Get Module Info

```
action="info"
module="exploit/multi/http/apache_mod_cgi_bash_env_exec"
```

### Run Vulnerability Check

```
action="check"
module="exploit/linux/http/apache_path_traversal_rce"
target="192.168.1.1"
```

### Execute Exploit (Dry Run)

```
action="execute"
module="exploit/linux/http/apache_path_traversal_rce"
target="192.168.1.1"
dryRun=true
```

### Execute Exploit (Real)

```
action="execute"
module="exploit/linux/http/apache_path_traversal_rce"
target="192.168.1.1"
dryRun=false
options={"RPORT": 8080}
```

### Programmatic Usage

```typescript
import { ExploitMatcher, ExploitStorage, ExploitEvents } from "./pentest/exploits"
import { Bus } from "./bus"

// Match finding to exploits
const matches = await ExploitMatcher.matchFinding(finding, {
  searchsploit: true,
  metasploit: true,
  limit: 10,
})

// Rank matches
const ranked = ExploitMatcher.rankMatches(matches)

// Save matches
for (const match of ranked) {
  await ExploitStorage.saveMatch(match)
}

// Subscribe to events
Bus.subscribe(ExploitEvents.SuggestionsGenerated, (event) => {
  console.log(`Found ${event.matchCount} exploits for ${event.findingID}`)
})
```

---

## Storage Layout

```
pentest/exploits/
  matches/
    match_abc123.json       # Exploit match records
  executions/
    exec_xyz789.json        # Execution audit records
```

---

## Matching Algorithm

1. **CVE Matching (High Confidence)**
   - Extract CVEs from finding
   - Search both databases by CVE ID
   - Mark matches as "high" confidence

2. **Service/Version Matching (Medium Confidence)**
   - Extract service name from finding
   - Extract version from evidence field
   - Map port to common service names
   - Search by combined queries

3. **Deduplication**
   - Key by `source:exploitID`
   - Keep first occurrence

4. **Ranking**
   - Sort by confidence (high > medium > low)
   - Then by MSF rank (excellent > great > good > normal > average > low)
   - Then by CVE count (more is better)

---

## Test Coverage

**Test File:** `test/pentest/exploits.test.ts`

**Test Categories:**

| Category | Tests |
|----------|-------|
| SearchsploitParser.parse | 3 tests - JSON, text, CVE extraction |
| SearchsploitParser.format | 2 tests - formatting, empty results |
| SearchsploitParser.toMatches | 1 test - match generation |
| MetasploitParser.parseSearch | 3 tests - parsing, CVE, auxiliary |
| MetasploitParser.format | 1 test - formatting |
| MetasploitParser.toMatches | 1 test - match generation |
| ExploitTypes schemas | 4 tests - validation |
| ExploitStorage | 8 tests - CRUD, filtering |
| ExploitMatcher.buildQueries | 3 tests - service, port, version |
| ExploitMatcher.rankMatches | 3 tests - confidence, rank, CVE |

---

## Dependencies

- No external packages required
- Uses existing: Storage, Bus, Findings, GovernanceScope, GovernanceMatcher
- CLI tools: searchsploit, msfconsole (must be installed)

---

## Future Enhancements

1. **Additional Sources**
   - GitHub POC repositories
   - Nuclei templates
   - PacketStorm
   - CVE Details

2. **Enhanced Matching**
   - Version range matching
   - Platform-aware suggestions
   - Exploit chain detection

3. **Execution Features**
   - Session management
   - Payload customization
   - Post-exploitation modules

4. **Reporting**
   - Exploit verification reports
   - Attack path visualization
   - Timeline of exploitation attempts

---

## Related Documentation

- [PHASE6.md](./PHASE6.md) - Continuous Monitoring
- [PHASE5.md](./PHASE5.md) - Report Generation
- [PHASE4.md](./PHASE4.md) - Multi-Tool Parsers
- [PENTEST.md](./PENTEST.md) - Pentest module reference
