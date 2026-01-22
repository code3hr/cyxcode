import { Component, createSignal, Show, For } from "solid-js"
import { reportsApi, complianceApi, type Report, type ReportRequest, type ComplianceFramework } from "../api/client"

const Reports: Component = () => {
  const [reportType, setReportType] = createSignal<"executive" | "technical" | "compliance">("executive")
  const [complianceFramework, setComplianceFramework] = createSignal<"pci-dss" | "hipaa" | "soc2">("pci-dss")
  const [frameworks, setFrameworks] = createSignal<ComplianceFramework[]>([])
  const [severityFilters, setSeverityFilters] = createSignal<string[]>([])
  const [statusFilters, setStatusFilters] = createSignal<string[]>([])
  const [generating, setGenerating] = createSignal(false)
  const [report, setReport] = createSignal<Report | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  // Fetch frameworks on mount
  complianceApi.listFrameworks().then((result) => {
    if (result.data) {
      setFrameworks(result.data.frameworks)
    }
  })

  const toggleSeverity = (severity: string) => {
    setSeverityFilters((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
    )
  }

  const toggleStatus = (status: string) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  const generateReport = async () => {
    setGenerating(true)
    setError(null)
    setReport(null)

    const request: ReportRequest = {
      type: reportType(),
      filters: {
        severity: severityFilters().length > 0 ? severityFilters() : undefined,
        status: statusFilters().length > 0 ? statusFilters() : undefined,
      },
    }

    if (reportType() === "compliance") {
      request.framework = complianceFramework()
    }

    const result = await reportsApi.generate(request)

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setReport(result.data.report)
    }

    setGenerating(false)
  }

  const downloadReport = () => {
    if (!report()) return

    const blob = new Blob([JSON.stringify(report(), null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${reportType()}-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getExecutiveReport = () => {
    if (!report() || report()!.type !== "executive") return null
    return report() as any
  }

  const getTechnicalReport = () => {
    if (!report() || report()!.type !== "technical") return null
    return report() as any
  }

  const getComplianceReport = () => {
    if (!report() || report()!.type !== "compliance") return null
    return report() as any
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Reports</h1>
          <p class="text-gray-400 mt-1">Generate security assessment reports</p>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error()}
        </div>
      </Show>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report configuration */}
        <div class="card">
          <div class="card-header">Report Configuration</div>

          {/* Report type */}
          <div class="space-y-4">
            <div>
              <label class="block text-sm text-gray-400 mb-2">Report Type</label>
              <div class="space-y-2">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="reportType"
                    value="executive"
                    checked={reportType() === "executive"}
                    onChange={() => setReportType("executive")}
                    class="form-radio text-blue-500"
                  />
                  <div>
                    <div class="text-gray-100">Executive Summary</div>
                    <div class="text-xs text-gray-500">High-level overview for stakeholders</div>
                  </div>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="reportType"
                    value="technical"
                    checked={reportType() === "technical"}
                    onChange={() => setReportType("technical")}
                    class="form-radio text-blue-500"
                  />
                  <div>
                    <div class="text-gray-100">Technical Report</div>
                    <div class="text-xs text-gray-500">Detailed findings by target</div>
                  </div>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="reportType"
                    value="compliance"
                    checked={reportType() === "compliance"}
                    onChange={() => setReportType("compliance")}
                    class="form-radio text-blue-500"
                  />
                  <div>
                    <div class="text-gray-100">Compliance Report</div>
                    <div class="text-xs text-gray-500">Framework-specific assessment</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Compliance framework selection */}
            <Show when={reportType() === "compliance"}>
              <div>
                <label class="block text-sm text-gray-400 mb-2">Compliance Framework</label>
                <select
                  class="select w-full"
                  value={complianceFramework()}
                  onChange={(e) => setComplianceFramework(e.currentTarget.value as any)}
                >
                  <For each={frameworks()}>
                    {(f) => (
                      <option value={f.id}>
                        {f.name} v{f.version}
                      </option>
                    )}
                  </For>
                </select>
              </div>
            </Show>

            {/* Severity filter */}
            <div>
              <label class="block text-sm text-gray-400 mb-2">Severity Filter</label>
              <div class="flex flex-wrap gap-2">
                <For each={["critical", "high", "medium", "low", "info"]}>
                  {(severity) => (
                    <button
                      onClick={() => toggleSeverity(severity)}
                      class={`badge cursor-pointer ${
                        severityFilters().includes(severity)
                          ? severity === "critical"
                            ? "bg-red-700 text-red-100"
                            : severity === "high"
                            ? "bg-orange-700 text-orange-100"
                            : severity === "medium"
                            ? "bg-yellow-700 text-yellow-100"
                            : severity === "low"
                            ? "bg-blue-700 text-blue-100"
                            : "bg-gray-600 text-gray-200"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {severity}
                    </button>
                  )}
                </For>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {severityFilters().length === 0 ? "All severities" : `${severityFilters().length} selected`}
              </div>
            </div>

            {/* Status filter */}
            <div>
              <label class="block text-sm text-gray-400 mb-2">Status Filter</label>
              <div class="flex flex-wrap gap-2">
                <For each={["open", "confirmed", "mitigated", "false_positive"]}>
                  {(status) => (
                    <button
                      onClick={() => toggleStatus(status)}
                      class={`badge cursor-pointer ${
                        statusFilters().includes(status) ? "bg-blue-700 text-blue-100" : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {status.replace("_", " ")}
                    </button>
                  )}
                </For>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {statusFilters().length === 0 ? "All statuses" : `${statusFilters().length} selected`}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={generateReport}
              disabled={generating()}
              class="btn btn-primary w-full disabled:opacity-50"
            >
              {generating() ? (
                <span class="flex items-center justify-center gap-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </span>
              ) : (
                "Generate Report"
              )}
            </button>
          </div>
        </div>

        {/* Report preview */}
        <div class="lg:col-span-2 card">
          <div class="flex items-center justify-between mb-4">
            <div class="card-header mb-0">Report Preview</div>
            <Show when={report()}>
              <button onClick={downloadReport} class="btn btn-secondary text-sm">
                Download JSON
              </button>
            </Show>
          </div>

          <Show when={!report()}>
            <div class="text-center py-16 text-gray-400">
              <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p>Configure and generate a report to see the preview.</p>
            </div>
          </Show>

          {/* Executive report preview */}
          <Show when={getExecutiveReport()}>
            <div class="space-y-6">
              {/* Risk score */}
              <div class="bg-gray-900 rounded-lg p-6 text-center">
                <div
                  class={`text-5xl font-bold ${
                    getExecutiveReport()!.summary.riskLevel === "critical"
                      ? "text-red-400"
                      : getExecutiveReport()!.summary.riskLevel === "high"
                      ? "text-orange-400"
                      : getExecutiveReport()!.summary.riskLevel === "medium"
                      ? "text-yellow-400"
                      : "text-green-400"
                  }`}
                >
                  {getExecutiveReport()!.summary.riskScore}
                </div>
                <div class="text-gray-400 mt-2">
                  Risk Score ({getExecutiveReport()!.summary.riskLevel} risk)
                </div>
              </div>

              {/* Summary stats */}
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-gray-900 p-4 rounded-lg text-center">
                  <div class="text-2xl font-bold text-gray-100">
                    {getExecutiveReport()!.summary.totalFindings}
                  </div>
                  <div class="text-sm text-gray-400">Total Findings</div>
                </div>
                <div class="bg-gray-900 p-4 rounded-lg text-center">
                  <div class="text-2xl font-bold text-red-400">
                    {getExecutiveReport()!.summary.bySeverity.critical || 0}
                  </div>
                  <div class="text-sm text-gray-400">Critical</div>
                </div>
                <div class="bg-gray-900 p-4 rounded-lg text-center">
                  <div class="text-2xl font-bold text-yellow-400">
                    {getExecutiveReport()!.summary.openIssues}
                  </div>
                  <div class="text-sm text-gray-400">Open Issues</div>
                </div>
                <div class="bg-gray-900 p-4 rounded-lg text-center">
                  <div class="text-2xl font-bold text-green-400">
                    {getExecutiveReport()!.summary.resolvedIssues}
                  </div>
                  <div class="text-sm text-gray-400">Resolved</div>
                </div>
              </div>

              {/* Critical findings */}
              <Show when={getExecutiveReport()!.highlights.criticalFindings.length > 0}>
                <div>
                  <div class="text-sm text-gray-400 mb-2">Critical Findings Requiring Attention</div>
                  <div class="space-y-2">
                    <For each={getExecutiveReport()!.highlights.criticalFindings}>
                      {(finding: any) => (
                        <div class="bg-red-900/20 border border-red-800 rounded-lg p-3">
                          <div class="font-medium text-red-200">{finding.title}</div>
                          <div class="text-sm text-red-300/70">{finding.target}</div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Recommendations */}
              <div>
                <div class="text-sm text-gray-400 mb-2">Recommendations</div>
                <ul class="space-y-2">
                  <For each={getExecutiveReport()!.recommendations}>
                    {(rec: string) => (
                      <li class="flex items-start gap-2 text-gray-300">
                        <svg class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {rec}
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </div>
          </Show>

          {/* Technical report preview */}
          <Show when={getTechnicalReport()}>
            <div class="space-y-4">
              <div class="text-lg font-medium text-gray-100">
                {getTechnicalReport()!.totalFindings} Findings across {getTechnicalReport()!.targets?.length || 0} Targets
              </div>

              <div class="space-y-4 max-h-[500px] overflow-y-auto">
                <For each={getTechnicalReport()!.targets}>
                  {(target: any) => (
                    <div class="bg-gray-900 rounded-lg p-4">
                      <div class="flex items-center justify-between mb-3">
                        <div class="font-medium text-gray-100">{target.target}</div>
                        <div class="text-sm text-gray-400">{target.findings.length} findings</div>
                      </div>
                      <div class="grid grid-cols-5 gap-2 text-center text-sm">
                        <div>
                          <div class="text-red-400 font-bold">{target.summary.critical}</div>
                          <div class="text-gray-500 text-xs">Critical</div>
                        </div>
                        <div>
                          <div class="text-orange-400 font-bold">{target.summary.high}</div>
                          <div class="text-gray-500 text-xs">High</div>
                        </div>
                        <div>
                          <div class="text-yellow-400 font-bold">{target.summary.medium}</div>
                          <div class="text-gray-500 text-xs">Medium</div>
                        </div>
                        <div>
                          <div class="text-blue-400 font-bold">{target.summary.low}</div>
                          <div class="text-gray-500 text-xs">Low</div>
                        </div>
                        <div>
                          <div class="text-gray-400 font-bold">{target.summary.info}</div>
                          <div class="text-gray-500 text-xs">Info</div>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Compliance report preview */}
          <Show when={getComplianceReport()}>
            <div class="space-y-4">
              <div class="bg-gray-900 rounded-lg p-6 text-center">
                <div
                  class={`text-5xl font-bold ${
                    getComplianceReport()!.summary.compliancePercentage >= 80
                      ? "text-green-400"
                      : getComplianceReport()!.summary.compliancePercentage >= 50
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                >
                  {getComplianceReport()!.summary.compliancePercentage}%
                </div>
                <div class="text-gray-400 mt-2">
                  {getComplianceReport()!.framework.toUpperCase()} Compliance Score
                </div>
              </div>

              <div class="grid grid-cols-4 gap-4 text-center">
                <div class="bg-gray-900 p-3 rounded-lg">
                  <div class="text-lg font-bold text-gray-100">
                    {getComplianceReport()!.summary.totalControls}
                  </div>
                  <div class="text-xs text-gray-400">Total Controls</div>
                </div>
                <div class="bg-gray-900 p-3 rounded-lg">
                  <div class="text-lg font-bold text-green-400">
                    {getComplianceReport()!.summary.passedControls}
                  </div>
                  <div class="text-xs text-gray-400">Passed</div>
                </div>
                <div class="bg-gray-900 p-3 rounded-lg">
                  <div class="text-lg font-bold text-red-400">
                    {getComplianceReport()!.summary.failedControls}
                  </div>
                  <div class="text-xs text-gray-400">Failed</div>
                </div>
                <div class="bg-gray-900 p-3 rounded-lg">
                  <div class="text-lg font-bold text-gray-400">
                    {getComplianceReport()!.summary.notAssessed}
                  </div>
                  <div class="text-xs text-gray-400">Not Assessed</div>
                </div>
              </div>

              <Show when={getComplianceReport()!.gaps?.length > 0}>
                <div>
                  <div class="text-sm text-gray-400 mb-2">Compliance Gaps</div>
                  <div class="space-y-2 max-h-64 overflow-y-auto">
                    <For each={getComplianceReport()!.gaps.slice(0, 10)}>
                      {(gap: any) => (
                        <div class="bg-gray-900 p-3 rounded-lg">
                          <div class="flex items-center justify-between">
                            <div class="font-medium text-gray-200">
                              {gap.control.id} - {gap.control.name}
                            </div>
                            <span
                              class={`badge ${
                                gap.status === "fail" ? "bg-red-900 text-red-200" : "bg-yellow-900 text-yellow-200"
                              }`}
                            >
                              {gap.status}
                            </span>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={report()}>
            <div class="text-xs text-gray-500 mt-4 text-right">
              Generated: {new Date(report()!.generatedAt).toLocaleString()}
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}

export default Reports
