# Phase 17: Reporting Dashboard

## Overview

Phase 17 implements a full web-based reporting dashboard for the opencode pentest framework with real-time scan monitoring, finding trend visualization, executive summary generation, remediation tracking, and compliance mapping (PCI-DSS, HIPAA, SOC2).

## Technology Stack

- **Frontend**: SolidJS + Vite + Tailwind CSS
- **Backend**: Hono routes integrated with existing server
- **Real-time**: Server-Sent Events (SSE) for live updates
- **Charts**: Custom SVG-based charts (Pie, Line, Bar, Radar)
- **Routing**: @solidjs/router v0.15+ (file-based lazy loading)

### Dependencies

```json
{
  "solid-js": "^1.9.0",
  "@solidjs/router": "^0.15.0",
  "vite": "^6.0.0",
  "vite-plugin-solid": "^2.11.0",
  "tailwindcss": "^3.4.0",
  "autoprefixer": "^10.4.0",
  "postcss": "^8.5.0"
}
```

## Features

### Dashboard Overview
- Total findings count with severity breakdown
- Critical/High open issues alert
- Scan activity (24h)
- Remediation metrics (7d mitigated, avg time to fix)
- Severity distribution pie chart
- Status distribution bar
- Finding trends line chart (30 days)
- Quick action cards

### Findings Management
- List all findings with filters (severity, status, target)
- Finding detail panel with full information
- Status updates (confirm, mitigate, false positive)
- Real-time updates via SSE
- Delete functionality

### Scans View
- List all scans with type, target, hosts, status, duration
- Active scan tracking with live indicator
- Scan detail panel with host/port information
- Real-time updates for running scans

### Monitors View
- List all monitors with status, schedule, run count
- Trigger immediate runs
- Run history with findings count
- Running monitor indicators
- Monitor detail panel with configuration

### Compliance Assessment
- Framework selection (PCI-DSS v4.0, HIPAA, SOC2)
- Auto-mapping findings to compliance controls
- Compliance scoring with percentage
- Category-level breakdown
- Radar chart visualization
- Control-level assessment details
- Gap identification

### Report Generation
- Executive summary reports
  - Risk score calculation
  - Critical findings highlights
  - Top targets analysis
  - Recommendations generation
- Technical reports
  - Findings grouped by target
  - Full evidence and remediation
- Compliance reports
  - Framework assessment results
  - Compliance gaps
  - Control-level details
- JSON export

## File Structure

```
packages/opencode/src/dashboard/
├── vite.config.ts
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── index.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── client.ts          # API client (fetch wrapper)
│   │   └── sse.ts             # SSE event listener
│   ├── stores/
│   │   ├── findings.ts        # Findings state store
│   │   ├── scans.ts           # Scans state store
│   │   ├── monitors.ts        # Monitors state store
│   │   └── compliance.ts      # Compliance state store
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Layout.tsx
│   │   ├── charts/
│   │   │   ├── SeverityPie.tsx
│   │   │   ├── TrendLine.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── ComplianceRadar.tsx
│   │   └── shared/
│   │       ├── SeverityBadge.tsx
│   │       ├── StatusBadge.tsx
│   │       └── DataTable.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Findings.tsx
│   │   ├── Scans.tsx
│   │   ├── Monitors.tsx
│   │   ├── Compliance.tsx
│   │   └── Reports.tsx
│   └── styles/
│       └── dashboard.css

packages/opencode/src/server/
├── server.ts                   # Modified - mounts dashboard routes
└── dashboard.ts                # Dashboard API routes

packages/opencode/src/pentest/compliance/
├── types.ts                    # Compliance type definitions
├── frameworks/
│   ├── index.ts               # Framework registry
│   ├── pci-dss.ts             # PCI-DSS v4.0 controls (~64)
│   ├── hipaa.ts               # HIPAA controls (~42)
│   └── soc2.ts                # SOC2 controls (~33)
├── mapper.ts                   # Finding-to-control mapper
├── scorer.ts                   # Compliance score calculator
└── index.ts                    # Module exports
```

## API Endpoints

### Findings
```
GET    /pentest/findings                    # List with filters
GET    /pentest/findings/:id                # Get single finding
PATCH  /pentest/findings/:id                # Update status/notes
DELETE /pentest/findings/:id                # Delete finding
```

### Scans
```
GET    /pentest/scans                       # List scans
GET    /pentest/scans/:id                   # Get scan details
```

### Statistics
```
GET    /pentest/stats/overview              # Dashboard overview stats
GET    /pentest/stats/severity              # Severity distribution
GET    /pentest/stats/trends                # Finding trends over time
```

### Monitors
```
GET    /pentest/monitors                    # List monitors
GET    /pentest/monitors/:id                # Get monitor details
POST   /pentest/monitors/:id/run            # Trigger immediate run
GET    /pentest/monitors/:id/runs           # Run history
```

### Reports
```
POST   /pentest/reports                     # Generate report
GET    /pentest/reports/:id                 # Get report content
```

### Compliance
```
GET    /pentest/compliance/frameworks       # List frameworks
GET    /pentest/compliance/:framework       # Get framework controls
GET    /pentest/compliance/:framework/map   # Finding-to-control mapping
POST   /pentest/compliance/:framework/assess # Run assessment
```

## Real-time Integration

Uses existing SSE at `/global/event` for live updates:

```typescript
// Events subscribed:
"pentest.finding_created"    -> Add to findings list
"pentest.finding_updated"    -> Update finding in UI
"pentest.scan_started"       -> Show active scan
"pentest.scan_completed"     -> Refresh scan list
"pentest.monitor.run_started" -> Show running indicator
"pentest.monitor.run_completed" -> Update monitor history
"pentest.monitor.run_failed"  -> Clear running indicator
```

## Compliance Frameworks

### PCI-DSS v4.0
- 12 requirement categories
- ~64 security controls
- Coverage: Network security, secure configurations, data protection, encryption, access control, logging, testing, policies

### HIPAA Security Rule
- 5 safeguard categories (Administrative, Physical, Technical, Organizational, Policies)
- ~42 controls
- Coverage: Access control, audit controls, transmission security, integrity, authentication

### SOC 2
- 5 Trust Service Criteria (Security, Availability, Processing Integrity, Confidentiality, Privacy)
- ~33 controls
- Coverage: Risk assessment, monitoring, access control, incident response, change management

## Auto-Mapping Logic

Findings are mapped to controls via:
1. **Keyword matching** - Title, description against control keywords
2. **Service matching** - Finding service against control service list
3. **Severity alignment** - Finding severity matches control severity list
4. **CWE correlation** - CWE IDs in finding text matched to control CWEs

Confidence levels:
- **High**: Score >= 25 (multiple strong matches)
- **Medium**: Score 15-24 (moderate matches)
- **Low**: Score < 15 (weak matches)

## Development

### Start Development Server
```bash
cd packages/opencode/src/dashboard
bun install
bun run dev
```

Development server runs at: `http://localhost:5173/dashboard/`

### Build for Production
```bash
cd packages/opencode/src/dashboard
bun run build
```

Build output (~140 kB total):
- `dist/index.html` - Entry point
- `dist/assets/index-*.css` - Tailwind styles (~22 kB)
- `dist/assets/index-*.js` - Main bundle (~48 kB)
- `dist/assets/*.js` - Lazy-loaded page chunks

### Access Dashboard (Production)
```
http://localhost:4096/dashboard
```

Requires the main opencode server to be running to serve the API endpoints.

## Types

### Overview Stats Response
```typescript
interface OverviewStats {
  findings: {
    total: number
    bySeverity: Record<Severity, number>
    byStatus: Record<FindingStatus, number>
    openCriticalHigh: number
  }
  scans: {
    total: number
    last24h: number
    activeMonitors: number
  }
  remediation: {
    mitigatedLast7d: number
    avgTimeToMitigate: number
  }
}
```

### Compliance Assessment
```typescript
interface ComplianceAssessment {
  framework: "pci-dss" | "hipaa" | "soc2"
  timestamp: number
  controls: Array<{
    control: ComplianceControl
    status: "pass" | "fail" | "partial" | "not_assessed"
    findings: string[]
    notes?: string
  }>
  score: {
    total: number
    passed: number
    failed: number
    partial: number
    notAssessed: number
    percentage: number
  }
}
```

## Integration Points

1. **Server Integration**: Dashboard routes mounted in `server.ts`
2. **Pentest Module**: Compliance module exported from `pentest/index.ts`
3. **Storage**: Uses existing file-based storage at `["pentest", ...]` paths
4. **Events**: Integrates with existing Bus/SSE event system
5. **Monitoring**: Accesses monitor storage for scheduler integration

## Summary

| Component | Files | Description |
|-----------|-------|-------------|
| Frontend | 24 | SolidJS pages, components, stores, API client |
| Backend | 1 | Hono dashboard routes (~500 lines) |
| Compliance | 8 | Types, frameworks, mapper, scorer |
| **Total** | **33** | **~2,950 lines of code** |

### Compliance Controls

| Framework | Controls | Categories |
|-----------|----------|------------|
| PCI-DSS v4.0 | 64 | 12 requirements |
| HIPAA | 42 | 5 safeguards |
| SOC 2 | 33 | 5 Trust Service Criteria |
| **Total** | **139** | - |

## Future Enhancements

- PDF report export
- Custom compliance framework definitions
- Historical compliance trend tracking
- Email/Slack notifications
- Dark/light theme toggle
- Dashboard widget customization
- Finding comments/collaboration
- Bulk finding operations
