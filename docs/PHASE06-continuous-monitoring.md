# Phase 6: Continuous Monitoring - Implementation Report

This document describes what was implemented in Phase 6 of the cyxcode project.

---

## Overview

Phase 6 added continuous monitoring capabilities, enabling scheduled security scans with diff detection and alerting for new vulnerabilities.

**Goal:** Automate recurring security scans and alert when new issues are discovered.

**Status:** Complete

---

## Features

1. **Scheduled Scans**: Run security tools on interval or cron schedules
2. **Diff Detection**: Compare findings between runs, identify new/resolved issues
3. **Alerting**: Publish events when new vulnerabilities are discovered
4. **Multi-Tool Support**: Run any combination of nmap, nuclei, nikto, etc.

---

## Module Structure

```
src/pentest/monitoring/
├── index.ts              # Main exports
├── types.ts              # Zod schemas (Monitor, MonitorRun, Schedule)
├── events.ts             # BusEvent definitions (12 events)
├── scheduler.ts          # Timer-based scheduler with Instance state
├── cron-parser.ts        # Lightweight cron expression parser
├── runner.ts             # Monitor execution and tool invocation
├── diff.ts               # Finding fingerprinting and comparison
├── alerter.ts            # Alert handling (bus, log, webhook)
├── storage.ts            # Monitor and run persistence
└── tool.ts               # MonitorTool for agent interaction
```

---

## Data Models

### Monitor

```typescript
{
  id: string                    // Unique ID (mon_xxx)
  name: string                  // Human-readable name
  description?: string
  sessionID: string             // Parent session
  targets: string[]             // IPs, hostnames, URLs
  tools: MonitorToolConfig[]    // Tools to run
  schedule: Schedule            // Interval or cron
  status: MonitorStatus         // active, paused, disabled, error
  alerts: AlertConfig           // Alert settings
  createdAt: number
  lastRunAt?: number
  nextRunAt?: number
  runCount: number
}
```

### MonitorRun

```typescript
{
  id: string                    // Unique ID (run_xxx)
  monitorID: string
  sessionID: string
  startTime: number
  endTime?: number
  status: MonitorRunStatus      // running, completed, failed, cancelled
  scanIDs: string[]             // Scans created
  findingIDs: string[]          // Findings created
  newFindingIDs: string[]       // New since last run
  resolvedFindingIDs: string[]  // Gone since last run
  runNumber: number
}
```

### Schedule Types

```typescript
// Interval-based (e.g., every hour)
{ type: "interval", intervalMs: 3600000, maxRuns?: 0 }

// Cron-based (e.g., daily at 2 AM)
{ type: "cron", expression: "0 2 * * *", timezone?: string }
```

---

## Key Components

### 1. Scheduler (`scheduler.ts`)

- Uses native `setTimeout` with `.unref()` (no external dependencies)
- Instance-scoped state via `Instance.state()`
- Prevents concurrent runs of the same monitor
- Auto-reschedules after completion
- Supports max runs limit for interval schedules

### 2. Cron Parser (`cron-parser.ts`)

- Parses standard 5-field cron expressions: `minute hour dayOfMonth month dayOfWeek`
- Supports: wildcards (`*`), ranges (`1-5`), steps (`*/5`), lists (`1,3,5`)
- Calculates next run time
- Validates expressions
- Provides human-readable descriptions

### 3. Diff Engine (`diff.ts`)

- Fingerprints findings by: title (normalized), target (normalized), port, service, severity
- Uses SHA-256 hash for comparison
- Identifies: new, resolved, unchanged findings between runs
- Filters by minimum severity

### 4. Alerter (`alerter.ts`)

- Channels: bus (events), log (structured), webhook (HTTP POST)
- Severity filtering (alert only on high+ severity, etc.)
- Cooldown to prevent alert spam (default: 5 minutes)
- Webhook payload includes full finding details

### 5. Monitor Runner (`runner.ts`)

- Invokes existing tools (NmapTool, SecToolsTool)
- Creates minimal tool context for auto-approval
- Collects findings per run
- Performs diff against previous run
- Triggers alerts based on configuration

---

## Events

| Event | Description |
|-------|-------------|
| `pentest.monitor.scheduled` | Monitor scheduled for next execution |
| `pentest.monitor.run_started` | Run began |
| `pentest.monitor.run_completed` | Run finished with statistics |
| `pentest.monitor.run_failed` | Run failed with error |
| `pentest.monitor.paused` | Monitor was paused |
| `pentest.monitor.resumed` | Monitor was resumed |
| `pentest.monitor.cancelled` | Monitor was cancelled |
| `pentest.monitor.created` | New monitor created |
| `pentest.monitor.updated` | Monitor configuration changed |
| `pentest.monitor.deleted` | Monitor was deleted |
| `pentest.monitor.alert.new_vulnerabilities` | New findings detected |
| `pentest.monitor.alert.resolved` | Findings resolved |

---

## MonitorTool Actions

| Action | Description |
|--------|-------------|
| `create` | Create a new monitor with targets, tools, schedule |
| `list` | List all monitors with status |
| `get` | Get detailed monitor info and recent runs |
| `pause` | Pause a running monitor |
| `resume` | Resume a paused monitor |
| `delete` | Delete a monitor |
| `trigger` | Trigger an immediate scan |
| `status` | Get scheduler status (running, scheduled) |

---

## Files Created

```
packages/opencode/src/pentest/monitoring/
├── types.ts           # 11 Zod schemas
├── events.ts          # 12 BusEvent definitions
├── scheduler.ts       # Scheduler with Instance state
├── cron-parser.ts     # Cron expression parser
├── runner.ts          # Monitor execution
├── diff.ts            # Finding comparison
├── alerter.ts         # Alert channels
├── storage.ts         # Monitor/run persistence
├── tool.ts            # MonitorTool for agents
└── index.ts           # Module exports

packages/opencode/test/pentest/
└── monitoring.test.ts # 25+ tests
```

## Files Modified

| File | Changes |
|------|---------|
| `src/pentest/index.ts` | Added monitoring exports |
| `src/tool/registry.ts` | Registered MonitorTool |

---

## Usage Examples

### Create a Monitor (Agent Tool)

```
action="create"
name="Daily Security Scan"
targets=["192.168.1.0/24", "https://app.example.com"]
tools=[
  { tool: "nmap", args: "-sV" },
  { tool: "nuclei", args: "-t cves/" }
]
scheduleType="cron"
cronExpression="0 2 * * *"
alertMinSeverity="medium"
```

### Programmatic Usage

```typescript
import { createMonitor, Scheduler, MonitoringEvents } from "./pentest/monitoring"
import { Bus } from "./bus"

// Create a monitor
const monitor = await createMonitor({
  name: "Hourly Port Scan",
  sessionID: ctx.sessionID,
  targets: ["10.0.0.1"],
  tools: [{ tool: "nmap", createFindings: true }],
  schedule: { type: "interval", intervalMs: 3600000 },
  alerts: {
    enabled: true,
    minSeverity: "high",
    channels: ["bus", "webhook"],
    webhookUrl: "https://slack.example.com/webhook",
  },
})

// Schedule it
await Scheduler.scheduleMonitor(monitor)

// Subscribe to alerts
Bus.subscribe(MonitoringEvents.NewVulnerabilitiesDetected, (event) => {
  console.log(`New vulnerabilities: ${event.summary.total}`)
  console.log(`Critical: ${event.summary.critical}`)
})
```

### Trigger Immediate Scan

```typescript
const run = await Scheduler.triggerNow(monitorID)
console.log(`Found ${run.findingIDs.length} findings`)
console.log(`New: ${run.newFindingIDs.length}`)
console.log(`Resolved: ${run.resolvedFindingIDs.length}`)
```

---

## Storage Layout

```
pentest/monitoring/
  monitors/
    mon_abc123.json         # Monitor configuration
    mon_def456.json
  runs/
    mon_abc123/
      run_xyz789.json       # Run record with finding lists
      run_uvw012.json
```

---

## Cron Expression Reference

| Expression | Description |
|------------|-------------|
| `* * * * *` | Every minute |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 2 * * *` | Daily at 2 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 9-17 * * 1-5` | Hourly 9-5 on weekdays |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 1 * *` | Monthly on the 1st |

---

## Test Coverage

**Test File:** `test/pentest/monitoring.test.ts`

**Test Categories:**

| Category | Tests |
|----------|-------|
| CronParser.parse | 7 tests - wildcards, values, ranges, steps, lists |
| CronParser.nextRun | 4 tests - next minute, hour, midnight, specific |
| CronParser.validate | 2 tests - valid/invalid expressions |
| CronParser.describe | 1 test - human-readable descriptions |
| DiffEngine.fingerprint | 4 tests - consistency, normalization |
| DiffEngine.compare | 6 tests - new, resolved, unchanged, mixed |
| DiffEngine.summarizeSeverity | 2 tests - counts, empty |
| DiffEngine.filterBySeverity | 1 test - minimum severity |

---

## Alert Webhook Payload

```json
{
  "type": "new_vulnerabilities",
  "monitor": {
    "id": "mon_abc123",
    "name": "Daily Security Scan"
  },
  "run": {
    "id": "run_xyz789",
    "number": 5
  },
  "findings": [
    {
      "id": "finding_123",
      "title": "SQL Injection in login form",
      "severity": "critical",
      "target": "https://app.example.com",
      "port": 443
    }
  ],
  "summary": {
    "critical": 1,
    "high": 2,
    "medium": 3,
    "low": 0,
    "info": 0,
    "total": 6
  },
  "timestamp": 1705337400000
}
```

---

## Dependencies

- No external packages required
- Uses existing: Storage, Bus, NmapTool, SecToolsTool, Findings
- Native Node.js/Bun: setTimeout, crypto (SHA-256)

---

## Future Enhancements

1. **Advanced Scheduling**
   - Timezone support for cron
   - Schedule exceptions (skip holidays)
   - Maintenance windows

2. **Alert Channels**
   - Email notifications
   - Slack integration
   - PagerDuty integration

3. **Dashboard**
   - Monitor status overview
   - Trend graphs
   - Alert history

4. **Comparison Features**
   - Cross-monitor diff
   - Historical trend analysis
   - Baseline comparisons

---

## Related Documentation

- [PHASE5.md](./PHASE5.md) - Report Generation
- [PHASE4.md](./PHASE4.md) - Multi-Tool Parsers
- [PHASE3.md](./PHASE3.md) - Pentest Agent MVP
- [PENTEST.md](./PENTEST.md) - Pentest module reference
