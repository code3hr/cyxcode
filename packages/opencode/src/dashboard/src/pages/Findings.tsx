import { Component, createSignal, createEffect, Show, For, onCleanup } from "solid-js"
import { useParams, useSearchParams, A } from "@solidjs/router"
import { findingsApi, type Finding, type FindingFilters } from "../api/client"
import { SeverityBadge } from "../components/shared/SeverityBadge"
import { StatusBadge } from "../components/shared/StatusBadge"
import { DataTable, type Column } from "../components/shared/DataTable"
import { sseClient } from "../api/sse"

const Findings: Component = () => {
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const [findings, setFindings] = createSignal<Finding[]>([])
  const [selectedFinding, setSelectedFinding] = createSignal<Finding | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  // Filter state
  const [severityFilter, setSeverityFilter] = createSignal(searchParams.severity || "")
  const [statusFilter, setStatusFilter] = createSignal(searchParams.status || "")
  const [targetFilter, setTargetFilter] = createSignal(searchParams.target || "")
  const [kind, setKind] = createSignal(searchParams.service || "")

  const fetchFindings = async () => {
    setLoading(true)
    setError(null)

    const filters: FindingFilters = {}
    if (severityFilter()) filters.severity = severityFilter()
    if (statusFilter()) filters.status = statusFilter()
    if (targetFilter()) filters.target = targetFilter()
    if (kind()) filters.service = kind()

    const result = await findingsApi.list(filters)

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setFindings(result.data.findings)
    }

    setLoading(false)
  }

  const fetchFindingDetail = async (id: string) => {
    const result = await findingsApi.get(id)
    if (result.data) {
      setSelectedFinding(result.data.finding)
    }
  }

  createEffect(() => {
    if (params.id) {
      fetchFindingDetail(params.id)
    } else {
      setSelectedFinding(null)
    }
  })

  createEffect(() => {
    fetchFindings()
  })

  // Real-time updates
  onCleanup(
    sseClient.on("pentest.finding_created", (event) => {
      const finding = event.properties.finding as Finding
      if (finding) {
        setFindings((prev) => [finding, ...prev])
      }
    })
  )

  onCleanup(
    sseClient.on("pentest.finding_updated", (event) => {
      const finding = event.properties.finding as Finding
      if (finding) {
        setFindings((prev) => prev.map((f) => (f.id === finding.id ? finding : f)))
        if (selectedFinding()?.id === finding.id) {
          setSelectedFinding(finding)
        }
      }
    })
  )

  const updateStatus = async (id: string, status: Finding["status"]) => {
    const result = await findingsApi.update(id, { status })
    if (result.data) {
      setFindings((prev) => prev.map((f) => (f.id === id ? result.data!.finding : f)))
      if (selectedFinding()?.id === id) {
        setSelectedFinding(result.data.finding)
      }
    }
  }

  const deleteFinding = async (id: string) => {
    if (!confirm("Are you sure you want to delete this finding?")) return

    const result = await findingsApi.delete(id)
    if (result.data?.success) {
      setFindings((prev) => prev.filter((f) => f.id !== id))
      if (selectedFinding()?.id === id) {
        setSelectedFinding(null)
      }
    }
  }

  const applyFilters = () => {
    const params: Record<string, string> = {}
    if (severityFilter()) params.severity = severityFilter()
    if (statusFilter()) params.status = statusFilter()
    if (targetFilter()) params.target = targetFilter()
    if (kind()) params.service = kind()
    setSearchParams(params)
    fetchFindings()
  }

  const clearFilters = () => {
    setSeverityFilter("")
    setStatusFilter("")
    setTargetFilter("")
    setKind("")
    setSearchParams({})
    fetchFindings()
  }

  const columns: Column<Finding>[] = [
    {
      key: "severity",
      header: "Severity",
      width: "100px",
      render: (f) => <SeverityBadge severity={f.severity} />,
    },
    {
      key: "title",
      header: "Title",
      render: (f) => (
        <div>
          <div class="font-medium text-gray-100">{f.title}</div>
          <div class="text-xs text-gray-500 mt-1">{detail(f) || `${f.target}${f.port ? `:${f.port}` : ""}`}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      render: (f) => <StatusBadge status={f.status} />,
    },
    {
      key: "service",
      header: "Service",
      width: "100px",
      render: (f) => <span class="text-gray-400">{label(f.service)}</span>,
    },
    {
      key: "createdAt",
      header: "Created",
      width: "120px",
      render: (f) => (
        <span class="text-gray-400 text-sm">
          {new Date(f.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ]

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Findings</h1>
          <p class="text-gray-400 mt-1">Security findings from scans and assessments</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-400">{findings().length} findings</span>
        </div>
      </div>

      {/* Filters */}
      <div class="card">
        <div class="flex flex-wrap items-end gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Severity</label>
            <select
              class="select"
              value={severityFilter()}
              onChange={(e) => setSeverityFilter(e.currentTarget.value)}
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>

          <div>
            <label class="block text-sm text-gray-400 mb-1">Status</label>
            <select
              class="select"
              value={statusFilter()}
              onChange={(e) => setStatusFilter(e.currentTarget.value)}
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="confirmed">Confirmed</option>
              <option value="mitigated">Mitigated</option>
              <option value="false_positive">False Positive</option>
            </select>
          </div>

          <div>
            <label class="block text-sm text-gray-400 mb-1">Target</label>
            <input
              type="text"
              class="input"
              placeholder="Filter by target..."
              value={targetFilter()}
              onInput={(e) => setTargetFilter(e.currentTarget.value)}
            />
          </div>

          <div>
            <label class="block text-sm text-gray-400 mb-1">Type</label>
            <select
              class="select"
              value={kind()}
              onChange={(e) => setKind(e.currentTarget.value)}
            >
              <option value="">All</option>
              <option value="dependency">Dependency</option>
              <option value="code-pattern">Code Pattern</option>
              <option value="web">Web</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div class="flex gap-2">
            <button onClick={applyFilters} class="btn btn-primary">Apply</button>
            <button onClick={clearFilters} class="btn btn-secondary">Clear</button>
          </div>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error()}
        </div>
      </Show>

      {/* Main content */}
      <div class="flex gap-6">
        {/* Findings list */}
        <div class={`card flex-1 ${selectedFinding() ? "max-w-2xl" : ""}`}>
          <DataTable
            columns={columns}
            data={findings()}
            loading={loading()}
            emptyMessage="No findings found"
            onRowClick={(f) => setSelectedFinding(f)}
          />
        </div>

        {/* Detail panel */}
        <Show when={selectedFinding()}>
          <div class="card w-96 flex-shrink-0">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-100">Finding Details</h3>
              <button
                onClick={() => setSelectedFinding(null)}
                class="text-gray-400 hover:text-gray-100"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <div class="text-sm text-gray-400">Title</div>
                <div class="text-gray-100 font-medium">{selectedFinding()!.title}</div>
              </div>

              <div class="flex gap-4">
                <div>
                  <div class="text-sm text-gray-400">Severity</div>
                  <SeverityBadge severity={selectedFinding()!.severity} />
                </div>
                <div>
                  <div class="text-sm text-gray-400">Status</div>
                  <StatusBadge status={selectedFinding()!.status} />
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400">Target</div>
                <div class="text-gray-100">
                  {selectedFinding()!.target}
                  {selectedFinding()!.port && `:${selectedFinding()!.port}`}
                  {selectedFinding()!.service && ` (${label(selectedFinding()!.service)})`}
                </div>
              </div>

              <Show when={selectedFinding()!.scanID}>
                <div>
                  <div class="text-sm text-gray-400">Scan</div>
                  <A href={`/scans/${selectedFinding()!.scanID}`} class="text-blue-400 hover:text-blue-300 text-sm">
                    {selectedFinding()!.scanID}
                  </A>
                </div>
              </Show>

              <Show when={vuln(selectedFinding()!)}>
                <div>
                  <div class="text-sm text-gray-400 mb-2">Vulnerability Metadata</div>
                  <div class="bg-gray-900 p-3 rounded text-sm space-y-2">
                    <For each={rows(selectedFinding()!)}>
                      {(row) => (
                        <div>
                          <div class="text-xs text-gray-500">{row.label}</div>
                          <div class="text-gray-300 break-words">{row.value}</div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              <div>
                <div class="text-sm text-gray-400">Description</div>
                <div class="text-gray-300 text-sm">{selectedFinding()!.description}</div>
              </div>

              <Show when={selectedFinding()!.evidence}>
                <div>
                  <div class="text-sm text-gray-400">Evidence</div>
                  <div class="text-gray-300 text-sm bg-gray-900 p-2 rounded font-mono">
                    {selectedFinding()!.evidence}
                  </div>
                </div>
              </Show>

              <Show when={selectedFinding()!.remediation}>
                <div>
                  <div class="text-sm text-gray-400">Remediation</div>
                  <div class="text-gray-300 text-sm">{selectedFinding()!.remediation}</div>
                </div>
              </Show>

              <Show when={selectedFinding()!.cve?.length}>
                <div>
                  <div class="text-sm text-gray-400">CVEs</div>
                  <div class="flex flex-wrap gap-1">
                    <For each={selectedFinding()!.cve}>
                      {(cve) => (
                        <span class="badge bg-gray-700 text-gray-300">{cve}</span>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Status actions */}
              <div class="pt-4 border-t border-gray-700">
                <div class="text-sm text-gray-400 mb-2">Update Status</div>
                <div class="flex flex-wrap gap-2">
                  <Show when={selectedFinding()!.status !== "confirmed"}>
                    <button
                      onClick={() => updateStatus(selectedFinding()!.id, "confirmed")}
                      class="btn btn-secondary text-sm"
                    >
                      Confirm
                    </button>
                  </Show>
                  <Show when={selectedFinding()!.status !== "mitigated"}>
                    <button
                      onClick={() => updateStatus(selectedFinding()!.id, "mitigated")}
                      class="btn btn-success text-sm"
                    >
                      Mitigated
                    </button>
                  </Show>
                  <Show when={selectedFinding()!.status !== "false_positive"}>
                    <button
                      onClick={() => updateStatus(selectedFinding()!.id, "false_positive")}
                      class="btn btn-secondary text-sm"
                    >
                      False Positive
                    </button>
                  </Show>
                  <button
                    onClick={() => deleteFinding(selectedFinding()!.id)}
                    class="btn btn-danger text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div class="text-xs text-gray-500 pt-2">
                Created: {new Date(selectedFinding()!.createdAt).toLocaleString()}
                {selectedFinding()!.updatedAt && (
                  <> | Updated: {new Date(selectedFinding()!.updatedAt).toLocaleString()}</>
                )}
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}

function label(service?: string) {
  const labels: Record<string, string> = {
    dependency: "Dependency",
    "code-pattern": "Code Pattern",
    web: "Web",
    custom: "Custom",
  }
  return service ? labels[service] || service : "-"
}

function meta(finding: Finding) {
  return (finding.evidence || "")
    .split(/\r?\n/)
    .reduce<Record<string, string>>((sum, line) => {
      const idx = line.indexOf("=")
      if (idx < 1) return sum
      return { ...sum, [line.slice(0, idx)]: line.slice(idx + 1) }
    }, {})
}

function vuln(finding: Finding) {
  return finding.service === "dependency" || finding.service === "code-pattern"
}

function detail(finding: Finding) {
  const data = meta(finding)
  if (finding.service === "dependency") return [data.package, data.version].filter(Boolean).join("@")
  if (finding.service === "code-pattern") return [data.file, data.line].filter(Boolean).join(":")
  return ""
}

function rows(finding: Finding) {
  const data = meta(finding)
  const list =
    finding.service === "dependency"
      ? [
          { label: "Package", value: data.package },
          { label: "Version", value: data.version },
          { label: "Relationship", value: data.relationship },
          { label: "Fixed", value: data.fixed },
          { label: "Fix Command", value: data.fixCommand },
        ]
      : [
          { label: "File", value: data.file },
          { label: "Line", value: data.line },
          { label: "Confidence", value: data.confidence },
          { label: "Match", value: data.match },
        ]
  return list.filter((item) => item.value && item.value !== "n/a")
}

export default Findings
