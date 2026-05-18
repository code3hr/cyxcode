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
// CyxWatch API
// ============================================================================

export interface WatchEvent {
  id: string
  ts: number
  kind: "file.read" | "file.write" | "shell.command" | "network.outbound" | "prompt.turn"
  project?: string
  sessionID?: string
  messageID?: string
  prompt?: string
  text?: string
  path?: string
  host?: string
  method?: string
  cmd?: string
  bytes?: number
  risk: number
  flags: string[]
  decision?: "allow" | "warn" | "require-approval" | "block"
}

export interface WatchAlert {
  id: string
  ts: number
  kind: "policy_violation" | "sensitive_access" | "network_exfil" | "prompt_drift" | "repeated_sensitive"
  title: string
  summary: string
  risk: number
  flags: string[]
  decision: "allow" | "warn" | "require-approval" | "block"
  eventID: string
  project?: string
  sessionID?: string
  messageID?: string
  prompt?: string
  path?: string
  cmd?: string
  host?: string
}

export interface WatchReport {
  period: { name: "1h" | "1d" | "7d" | "30d" | "all"; start: string; end: string }
  total: number
  prompt: number
  shell: number
  read: number
  write: number
  network: number
  risky: number
  risk: number
  alerts: number
  decisions: {
    allow: number
    warn: number
    requireApproval: number
    block: number
  }
  flags: Array<{ name: string; count: number }>
  top: Array<{ path: string; count: number }>
}

export const watchApi = {
  report: (period = "7d") => request<{ report: WatchReport }>(`/cyxwatch/report?period=${period}`),
  recent: (limit = 20) => request<{ events: WatchEvent[]; total: number }>(`/cyxwatch/recent?limit=${limit}`),
  alerts: (limit = 20) => request<{ alerts: WatchAlert[]; total: number }>(`/cyxwatch/alerts?limit=${limit}`),
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

// ============================================================================
// Wiki API
// ============================================================================

export interface WikiPage {
  id: string
  path: string
  kind: "doc" | "wiki"
  title: string
  summary: string
  tags: string[]
  links: string[]
  backlinks: string[]
  hash: string
  created: number
  modified: number
  accessed: number
  accessCount: number
}

export interface WikiNode {
  id: string
  path: string
  kind: "doc" | "wiki"
  title: string
}

export interface WikiEdge {
  from: string
  to: string
  type: "wikilink"
}

export interface WikiGraph {
  nodes: WikiNode[]
  edges: WikiEdge[]
}

export interface WikiList {
  pages: WikiPage[]
  total: number
}

export interface WikiStats {
  pages: number
  indexed: number
  links: number
  errors: number
}

export interface WikiWrite {
  title: string
  body?: string
  tags?: string[]
}

export interface GraphNode {
  id: string
  kind: "wiki" | "code" | "symbol" | "memory" | "learned" | "concept"
  title: string
  path?: string
  summary?: string
  tags?: string[]
  meta?: Record<string, unknown>
}

export interface GraphEdge {
  from: string
  to: string
  type: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    wiki: number
    code: number
    memory: number
    learned: number
    facts: number
  }
}

// ============================================================================
// Code Graph API
// ============================================================================

export interface CodeFile {
  id: string
  path: string
  kind: "file"
  title: string
  hash: string
  imports: string[]
  uses: string[]
  exports: string[]
  symbols: string[]
  modified: number
}

export interface CodeNode {
  id: string
  path: string
  kind: "file" | "symbol"
  title: string
}

export interface CodeEdge {
  from: string
  to: string
  type: "import" | "declares" | "uses"
}

export interface CodeGraph {
  nodes: CodeNode[]
  edges: CodeEdge[]
}

export interface CodeList {
  files: CodeFile[]
  total: number
}

export const codegraphApi = {
  list: (opts?: { search?: string; limit?: number }) => {
    const params = new URLSearchParams()
    if (opts?.search) params.set("search", opts.search)
    if (opts?.limit) params.set("limit", String(opts.limit))
    const query = params.toString() ? `?${params.toString()}` : ""
    return request<CodeList>(`/experimental/codegraph${query}`)
  },

  graph: () => request<CodeGraph>(`/experimental/codegraph/graph`),

  get: (id: string) => request<{ file: CodeFile; content: string }>(`/experimental/codegraph/page?id=${encodeURIComponent(id)}`),

  rebuild: () =>
    request<{ files: number; symbols: number; imports: number; edges: number; errors: number }>(`/experimental/codegraph/rebuild`, {
      method: "POST",
    }),
}

// ============================================================================
// Memory API
// ============================================================================

export interface MemoryEntry {
  id: string
  file: string
  tags: string[]
  summary: string
  created: string
  accessed: string
  accessCount: number
}

export interface MemoryList {
  entries: MemoryEntry[]
  total: number
}

export const memoryApi = {
  list: (opts?: { search?: string; limit?: number }) => {
    const params = new URLSearchParams()
    if (opts?.search) params.set("search", opts.search)
    if (opts?.limit) params.set("limit", String(opts.limit))
    const query = params.toString() ? `?${params.toString()}` : ""
    return request<MemoryList>(`/experimental/memory${query}`)
  },

  get: (id: string) => request<{ entry: MemoryEntry; content: string }>(`/experimental/memory/page?id=${encodeURIComponent(id)}`),
}

export const wikiApi = {
  list: (opts?: { search?: string; limit?: number }) => {
    const params = new URLSearchParams()
    if (opts?.search) params.set("search", opts.search)
    if (opts?.limit) params.set("limit", String(opts.limit))
    const query = params.toString() ? `?${params.toString()}` : ""
    return request<WikiList>(`/experimental/wiki${query}`)
  },

  graph: () => request<WikiGraph>(`/experimental/wiki/graph`),

  get: (id: string) => request<{ page: WikiPage; content: string }>(`/experimental/wiki/page?id=${encodeURIComponent(id)}`),

  create: (data: WikiWrite) =>
    request<{ page: WikiPage }>(`/experimental/wiki/page`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: WikiWrite) =>
    request<{ page: WikiPage }>(`/experimental/wiki/page?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/experimental/wiki/page?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  rebuild: (force = false) =>
    request<WikiStats>(`/experimental/wiki/rebuild`, {
      method: "POST",
      body: JSON.stringify({ force }),
    }),
}

export const graphApi = {
  get: () => request<GraphData>(`/experimental/graph`),
}
