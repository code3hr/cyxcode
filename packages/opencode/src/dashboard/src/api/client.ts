/**
 * API Client for Dashboard
 *
 * Fetch wrapper for communicating with the pentest API endpoints.
 */

const API_BASE = ""

export interface ApiResponse<T> {
  data?: T
  error?: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.error || `HTTP ${response.status}` }
    }

    return { data }
  } catch (err) {
    console.error("API request failed:", path, err)
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ============================================================================
// Findings API
// ============================================================================

export interface Finding {
  id: string
  sessionID: string
  scanID?: string
  title: string
  description: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  status: "open" | "confirmed" | "mitigated" | "false_positive"
  target: string
  port?: number
  protocol?: "tcp" | "udp" | "sctp"
  service?: string
  evidence?: string
  remediation?: string
  references?: string[]
  cve?: string[]
  createdAt: number
  updatedAt?: number
}

export interface FindingsResponse {
  findings: Finding[]
  total: number
}

export interface FindingFilters {
  sessionID?: string
  scanID?: string
  severity?: string
  status?: string
  target?: string
  limit?: number
}

export const findingsApi = {
  list: (filters?: FindingFilters) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value))
      })
    }
    const query = params.toString() ? `?${params.toString()}` : ""
    return request<FindingsResponse>(`/pentest/findings${query}`)
  },

  get: (id: string) => request<{ finding: Finding }>(`/pentest/findings/${id}`),

  update: (id: string, updates: Partial<Pick<Finding, "status" | "remediation" | "evidence">>) =>
    request<{ finding: Finding }>(`/pentest/findings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/pentest/findings/${id}`, {
      method: "DELETE",
    }),
}

// ============================================================================
// Scans API
// ============================================================================

export interface ScanResult {
  id: string
  sessionID: string
  scanType: "port" | "service" | "vuln" | "web" | "custom"
  target: string
  command: string
  startTime: number
  endTime?: number
  hosts: Array<{
    address: string
    hostname?: string
    status: "up" | "down" | "unknown"
    ports: Array<{
      portid: number
      protocol: "tcp" | "udp"
      state: string
      service?: {
        name: string
        version?: string
      }
    }>
  }>
  summary?: string
}

export interface ScansResponse {
  scans: ScanResult[]
  total: number
}

export const scansApi = {
  list: (filters?: { sessionID?: string; target?: string; scanType?: string; limit?: number }) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value))
      })
    }
    const query = params.toString() ? `?${params.toString()}` : ""
    return request<ScansResponse>(`/pentest/scans${query}`)
  },

  get: (id: string) => request<{ scan: ScanResult }>(`/pentest/scans/${id}`),
}

// ============================================================================
// Statistics API
// ============================================================================

export interface OverviewStats {
  findings: {
    total: number
    bySeverity: Record<string, number>
    byStatus: Record<string, number>
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

export interface TrendData {
  date: string
  created: number
  mitigated: number
}

export const statsApi = {
  overview: () => request<OverviewStats>(`/pentest/stats/overview`),

  severity: () => request<{ distribution: Record<string, number> }>(`/pentest/stats/severity`),

  trends: (days = 30) => request<{ trends: TrendData[]; days: number }>(`/pentest/stats/trends?days=${days}`),
}

// ============================================================================
// Monitors API
// ============================================================================

export interface Monitor {
  id: string
  name: string
  description?: string
  sessionID: string
  targets: string[]
  tools: Array<{
    tool: string
    enabled: boolean
    config?: Record<string, unknown>
  }>
  schedule: {
    type: "interval" | "cron"
    interval?: number
    cron?: string
  }
  status: "active" | "paused" | "disabled" | "error"
  alerts: {
    enabled: boolean
    minSeverity: string
    newFindingsOnly: boolean
    channels: string[]
  }
  tags?: string[]
  createdAt: number
  updatedAt?: number
  lastRunAt?: number
  nextRunAt?: number
  runCount: number
  lastError?: string
}

export interface MonitorRun {
  id: string
  monitorID: string
  sessionID: string
  startTime: number
  endTime?: number
  status: "running" | "completed" | "failed" | "cancelled"
  scanIDs: string[]
  findingIDs: string[]
  newFindingIDs: string[]
  resolvedFindingIDs: string[]
  error?: string
  runNumber: number
}

export const monitorsApi = {
  list: (filters?: { sessionID?: string; status?: string }) => {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, String(value))
      })
    }
    const query = params.toString() ? `?${params.toString()}` : ""
    return request<{ monitors: Monitor[]; total: number }>(`/pentest/monitors${query}`)
  },

  get: (id: string) => request<{ monitor: Monitor }>(`/pentest/monitors/${id}`),

  triggerRun: (id: string) =>
    request<{ success: boolean; runId: string }>(`/pentest/monitors/${id}/run`, {
      method: "POST",
    }),

  listRuns: (id: string, limit?: number) => {
    const query = limit ? `?limit=${limit}` : ""
    return request<{ runs: MonitorRun[]; total: number }>(`/pentest/monitors/${id}/runs${query}`)
  },
}

// ============================================================================
// Reports API
// ============================================================================

export interface Report {
  id: string
  type: "executive" | "technical" | "compliance"
  generatedAt: number
  summary?: unknown
  targets?: unknown[]
  assessment?: unknown
}

export interface ReportRequest {
  type: "executive" | "technical" | "compliance"
  filters?: {
    sessionID?: string
    severity?: string[]
    status?: string[]
    dateRange?: {
      start: number
      end: number
    }
  }
  framework?: "pci-dss" | "hipaa" | "soc2"
}

export const reportsApi = {
  generate: (req: ReportRequest) =>
    request<{ report: Report }>(`/pentest/reports`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  get: (id: string) => request<{ report: Report }>(`/pentest/reports/${id}`),
}

// ============================================================================
// Compliance API
// ============================================================================

export interface ComplianceFramework {
  id: "pci-dss" | "hipaa" | "soc2"
  name: string
  version: string
  description: string
  categories: Array<{
    id: string
    name: string
    description?: string
  }>
  controlCount: number
}

export interface ComplianceControl {
  id: string
  framework: string
  category: string
  name: string
  description: string
  priority: "critical" | "high" | "medium" | "low"
  keywords: string[]
  cweIds?: number[]
  services?: string[]
  severities?: string[]
  remediation?: string
  reference?: string
}

export interface ComplianceAssessment {
  framework: string
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

export const complianceApi = {
  listFrameworks: () => request<{ frameworks: ComplianceFramework[] }>(`/pentest/compliance/frameworks`),

  getFramework: (id: string) =>
    request<{
      framework: string
      controls: ComplianceControl[]
      categories: Array<{ id: string; name: string; description?: string }>
    }>(`/pentest/compliance/${id}`),

  getMapping: (framework: string) =>
    request<{
      framework: string
      mapping: Array<{
        findingId: string
        controlIds: string[]
        confidence: string
        matchReason: string
      }>
    }>(`/pentest/compliance/${framework}/map`),

  assess: (framework: string) =>
    request<{ assessment: ComplianceAssessment }>(`/pentest/compliance/${framework}/assess`, {
      method: "POST",
    }),
}
