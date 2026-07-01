import { Component, createSignal, createEffect, createMemo, Show, For, onCleanup } from "solid-js"
import { A, useParams } from "@solidjs/router"
import { scansApi, vulnApi, type ScanResult, type VulnArtifactSummary } from "../api/client"
import { DataTable, type Column } from "../components/shared/DataTable"
import { sseClient } from "../api/sse"

const Scans: Component = () => {
  const params = useParams()

  const [scans, setScans] = createSignal<ScanResult[]>([])
  const [activeScans, setActiveScans] = createSignal<string[]>([])
  const [selectedScan, setSelectedScan] = createSignal<ScanResult | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [scanning, setScanning] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [msg, setMsg] = createSignal<string | null>(null)
  const vuln = createMemo(() => parse(selectedScan()))

  const fetchScans = async () => {
    setLoading(true)
    setError(null)

    const result = await scansApi.list({ limit: 100 })

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setScans(result.data.scans)
    }

    setLoading(false)
  }

  const fetchScanDetail = async (id: string) => {
    const result = await scansApi.get(id)
    if (result.data) {
      setSelectedScan(result.data.scan)
    }
  }

  const download = async (id: string) => {
    const res = await vulnApi.artifact(id)
    if (res.error) {
      setError(res.error)
      return
    }
    if (!res.data) return
    const item = res.data.artifact
    const body = item.content ?? JSON.stringify(item.sarif ?? item.document ?? item.report, null, 2)
    const type = item.format === "html" ? "text/html" : "application/json"
    const url = URL.createObjectURL(new Blob([body], { type }))
    const a = document.createElement("a")
    a.href = url
    a.download = item.name
    a.click()
    URL.revokeObjectURL(url)
  }

  const runVuln = async () => {
    setScanning(true)
    setError(null)
    setMsg(null)

    const res = await vulnApi.scan({ minSeverity: "high", failOnSeverity: "high", createFindings: true })
    if (res.error) {
      setError(res.error)
      setScanning(false)
      return
    }

    if (res.data) {
      setScans((prev) => [res.data!.scan, ...prev.filter((scan) => scan.id !== res.data!.scan.id)])
      setSelectedScan(res.data.scan)
      setMsg(`Scan completed. ${res.data.findings.total} findings detected.`)
    }
    setScanning(false)
  }

  createEffect(() => {
    if (params.id) {
      fetchScanDetail(params.id)
    } else {
      setSelectedScan(null)
    }
  })

  createEffect(() => {
    fetchScans()
  })

  // Real-time updates
  onCleanup(
    sseClient.on("pentest.scan_started", (event) => {
      const scanID = event.properties.scanID as string
      if (scanID) {
        setActiveScans((prev) => [...prev, scanID])
      }
    })
  )

  onCleanup(
    sseClient.on("pentest.scan_completed", (event) => {
      const scan = event.properties.scan as ScanResult
      if (scan) {
        setActiveScans((prev) => prev.filter((id) => id !== scan.id))
        setScans((prev) => [scan, ...prev.filter((s) => s.id !== scan.id)])
        if (selectedScan()?.id === scan.id) {
          setSelectedScan(scan)
        }
      }
    })
  )

  const formatDuration = (scan: ScanResult) => {
    if (!scan.endTime) return "Running..."
    const duration = scan.endTime - scan.startTime
    const seconds = Math.floor(duration / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  const getScanTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      port: "Port Scan",
      service: "Service Detection",
      vuln: "Vulnerability Scan",
      web: "Web Scan",
      custom: "Custom Scan",
    }
    return labels[type] || type
  }

  const columns: Column<ScanResult>[] = [
    {
      key: "scanType",
      header: "Type",
      width: "120px",
      render: (s) => (
        <span class="badge bg-blue-900 text-blue-200">
          {getScanTypeLabel(s.scanType)}
        </span>
      ),
    },
    {
      key: "target",
      header: "Target",
      render: (s) => (
        <div>
          <div class="font-medium text-gray-100">{s.target}</div>
          <div class="text-xs text-gray-500 mt-1 truncate max-w-xs" title={s.command}>
            {s.command}
          </div>
        </div>
      ),
    },
    {
      key: "hosts",
      header: "Results",
      width: "80px",
      render: (s) => (
        <span class="text-gray-300">{count(s)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (s) => (
        <Show
          when={s.endTime}
          fallback={
            <span class="badge bg-blue-900 text-blue-200 animate-pulse">Running</span>
          }
        >
          <span class="badge bg-green-900 text-green-200">Completed</span>
        </Show>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      width: "100px",
      render: (s) => (
        <span class="text-gray-400 text-sm">{formatDuration(s)}</span>
      ),
    },
    {
      key: "startTime",
      header: "Started",
      width: "120px",
      render: (s) => (
        <span class="text-gray-400 text-sm">
          {new Date(s.startTime).toLocaleString()}
        </span>
      ),
    },
  ]

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Scans</h1>
          <p class="text-gray-400 mt-1">
            Scan history and live jobs in one place. Select any scan to inspect artifacts, rerun detection, and download JSON/HTML scan reports.
          </p>
        </div>
        <div class="flex items-center gap-4">
          <Show when={activeScans().length > 0}>
            <span class="badge bg-blue-900 text-blue-200 animate-pulse">
              {activeScans().length} active scan{activeScans().length > 1 ? "s" : ""}
            </span>
          </Show>
          <button class="btn btn-primary" onClick={runVuln} disabled={scanning()}>
            {scanning() ? "Scanning..." : "Run Vuln Scan"}
          </button>
          <span class="text-sm text-gray-400">{scans().length} scans</span>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error()}
        </div>
      </Show>
      <Show when={msg()}>
        <div class="rounded-lg border border-cyan-800 bg-cyan-950/50 p-4 text-cyan-200">
          {msg()}
        </div>
      </Show>

      {/* Main content */}
      <div class="flex gap-6">
        {/* Scans list */}
        <div class={`card flex-1 ${selectedScan() ? "max-w-3xl" : ""}`}>
          <DataTable
            columns={columns}
            data={scans()}
            loading={loading()}
            emptyMessage="No scans found"
            emptyState={<Empty scanning={scanning()} onScan={runVuln} />}
            onRowClick={(s) => setSelectedScan(s)}
          />
        </div>

        {/* Detail panel */}
        <Show when={selectedScan()}>
          <div class="card w-[450px] flex-shrink-0 overflow-auto max-h-[calc(100vh-200px)]">
            <div class="flex items-center justify-between mb-4 sticky top-0 bg-gray-800 pb-4">
              <h3 class="text-lg font-semibold text-gray-100">Scan Details</h3>
              <button
                onClick={() => setSelectedScan(null)}
                class="text-gray-400 hover:text-gray-100"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-sm text-gray-400">Type</div>
                  <div class="text-gray-100">{getScanTypeLabel(selectedScan()!.scanType)}</div>
                </div>
                <div>
                  <div class="text-sm text-gray-400">Duration</div>
                  <div class="text-gray-100">{formatDuration(selectedScan()!)}</div>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400">Target</div>
                <div class="text-gray-100">{selectedScan()!.target}</div>
              </div>

              <div>
                <div class="text-sm text-gray-400">Command</div>
                <div class="text-gray-300 text-sm bg-gray-900 p-2 rounded font-mono overflow-x-auto">
                  {selectedScan()!.command}
                </div>
              </div>

              <Show when={selectedScan()!.summary}>
                <div>
                  <div class="text-sm text-gray-400">Summary</div>
                  <div class="text-gray-300 text-sm">{selectedScan()!.summary}</div>
                </div>
              </Show>

              <Show when={selectedScan()!.scanType === "vuln"}>
                <Show
                  when={vuln()}
                  fallback={
                    <div class="bg-gray-900 p-3 rounded-lg text-sm text-gray-400">
                      No vulnerability detail payload was saved for this scan.
                    </div>
                  }
                >
                  {(data) => (
                    <div class="space-y-4">
                      <div class="grid grid-cols-3 gap-3">
                        <div class="bg-gray-900 p-3 rounded-lg">
                          <div class="text-xs text-gray-500">Dependency</div>
                          <div class="text-lg font-semibold text-gray-100">
                            {data().dependency?.findingCount ?? 0}
                          </div>
                        </div>
                        <div class="bg-gray-900 p-3 rounded-lg">
                          <div class="text-xs text-gray-500">Code</div>
                          <div class="text-lg font-semibold text-gray-100">
                            {data().code?.findingCount ?? 0}
                          </div>
                        </div>
                        <div class="bg-gray-900 p-3 rounded-lg">
                          <div class="text-xs text-gray-500">Files</div>
                          <div class="text-lg font-semibold text-gray-100">
                            {data().code?.filesScanned ?? 0}
                          </div>
                        </div>
                      </div>

                      <Show when={data().severity || data().gate}>
                        <div class="bg-gray-900 p-3 rounded-lg">
                          <div class="grid grid-cols-5 gap-3 text-sm">
                            <div>
                              <div class="text-xs text-gray-500">Critical</div>
                              <div class="text-red-300 font-semibold">{data().severity?.critical ?? 0}</div>
                            </div>
                            <div>
                              <div class="text-xs text-gray-500">High</div>
                              <div class="text-orange-300 font-semibold">{data().severity?.high ?? 0}</div>
                            </div>
                            <div>
                              <div class="text-xs text-gray-500">Medium</div>
                              <div class="text-yellow-300 font-semibold">{data().severity?.medium ?? 0}</div>
                            </div>
                            <div>
                              <div class="text-xs text-gray-500">Low</div>
                              <div class="text-blue-300 font-semibold">{data().severity?.low ?? 0}</div>
                            </div>
                            <div>
                              <div class="text-xs text-gray-500">Gate</div>
                              <div class={data().gate?.passed === false ? "text-red-300 font-semibold" : "text-emerald-300 font-semibold"}>
                                {data().gate ? (data().gate!.passed ? "Pass" : "Fail") : "-"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Show>

                      <Show when={data().artifacts?.length}>
                        <div>
                          <div class="text-sm text-gray-400 mb-2">Artifacts</div>
                          <div class="space-y-2">
                            <For each={data().artifacts ?? []}>
                              {(item) => (
                                <div class="bg-gray-900 p-3 rounded-lg flex items-center justify-between gap-3">
                                  <div class="min-w-0">
                                    <div class="text-sm text-gray-100 truncate">{item.name}</div>
                                    <div class="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</div>
                                  </div>
                                  <button class="btn btn-secondary text-xs" onClick={() => download(item.id)}>
                                    Download
                                  </button>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>

                      <Show when={data().dependency?.findings?.length}>
                        <div>
                          <div class="text-sm text-gray-400 mb-2">Top Dependency CVEs</div>
                          <div class="space-y-2">
                            <For each={data().dependency?.findings?.slice(0, 8) ?? []}>
                              {(item) => (
                                <div class="bg-gray-900 p-3 rounded-lg">
                                  <div class="flex items-center justify-between gap-3">
                                    <div class="text-sm text-gray-100 truncate">
                                      {item.package}@{item.version}
                                    </div>
                                    <span class="badge bg-red-900 text-red-200">{item.severity}</span>
                                  </div>
                                  <div class="text-xs text-gray-500 mt-1">
                                    {item.relationship} {item.cves?.slice(0, 3).join(", ")}
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>

                      <Show when={data().code?.findings?.length}>
                        <div>
                          <div class="text-sm text-gray-400 mb-2">Code And Config Indicators</div>
                          <div class="space-y-2">
                            <For each={data().code?.findings?.slice(0, 8) ?? []}>
                              {(item) => (
                                <div class="bg-gray-900 p-3 rounded-lg">
                                  <div class="flex items-center justify-between gap-3">
                                    <div class="text-sm text-gray-100 truncate">{item.title}</div>
                                    <span class="badge bg-orange-900 text-orange-200">{item.severity}</span>
                                  </div>
                                  <div class="text-xs text-gray-500 mt-1">
                                    {item.file}:{item.line} {item.confidence}
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>
                    </div>
                  )}
                </Show>
              </Show>

              {/* Hosts */}
              <Show when={selectedScan()!.scanType !== "vuln"}>
                <div>
                  <div class="text-sm text-gray-400 mb-2">
                    Discovered Hosts ({selectedScan()!.hosts.length})
                  </div>
                  <div class="space-y-3 max-h-96 overflow-y-auto">
                    <For each={selectedScan()!.hosts}>
                      {(host) => (
                        <div class="bg-gray-900 p-3 rounded-lg">
                          <div class="flex items-center justify-between mb-2">
                            <div class="font-medium text-gray-100">
                              {host.address}
                              {host.hostname && (
                                <span class="text-gray-400 ml-2">({host.hostname})</span>
                              )}
                            </div>
                            <span
                              class={`badge ${
                                host.status === "up" ? "bg-green-900 text-green-200" : "bg-gray-700 text-gray-400"
                              }`}
                            >
                              {host.status}
                            </span>
                          </div>

                          <Show when={host.ports.length > 0}>
                            <div class="text-xs text-gray-400 mb-1">
                              {host.ports.filter((p) => p.state === "open").length} open ports
                            </div>
                            <div class="grid grid-cols-2 gap-1">
                              <For each={host.ports.filter((p) => p.state === "open").slice(0, 10)}>
                                {(port) => (
                                  <div class="text-sm text-gray-300">
                                    <span class="text-blue-400">{port.portid}</span>
                                    <span class="text-gray-500">/{port.protocol}</span>
                                    {port.service?.name && (
                                      <span class="text-gray-400 ml-1">{port.service.name}</span>
                                    )}
                                  </div>
                                )}
                              </For>
                              <Show when={host.ports.filter((p) => p.state === "open").length > 10}>
                                <div class="text-sm text-gray-500">
                                  +{host.ports.filter((p) => p.state === "open").length - 10} more
                                </div>
                              </Show>
                            </div>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              <div class="text-xs text-gray-500 pt-2 border-t border-gray-700">
                Started: {new Date(selectedScan()!.startTime).toLocaleString()}
                {selectedScan()!.endTime && (
                  <> | Ended: {new Date(selectedScan()!.endTime).toLocaleString()}</>
                )}
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}

const Empty: Component<{ scanning: boolean; onScan: () => void }> = (props) => (
  <div class="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-8">
    <div class="text-base font-semibold text-gray-100">No scan history is stored yet</div>
    <div class="text-sm leading-6 text-gray-400">
      This page lists saved scan records. Run a vulnerability scan to create a scan entry, artifacts, and any matching findings.
    </div>
    <div class="flex flex-wrap justify-center gap-2">
      <button class="btn btn-primary text-sm" onClick={props.onScan} disabled={props.scanning}>
        {props.scanning ? "Scanning..." : "Run Vuln Scan"}
      </button>
      <A href="/security" class="btn btn-secondary text-sm">
        Open CyxWatch
      </A>
    </div>
  </div>
)

type Raw = {
  artifacts?: VulnArtifactSummary[]
  severity?: {
    critical: number
    high: number
    medium: number
    low: number
  }
  gate?: {
    failOn: "critical" | "high" | "medium" | "low"
    passed: boolean
    blocked: number
  }
  dependency?: {
    packageCount?: number
    findingCount?: number
    findings?: Array<{
      package: string
      version: string
      severity: string
      relationship: string
      cves?: string[]
    }>
  }
  code?: {
    filesScanned?: number
    findingCount?: number
    findings?: Array<{
      title: string
      severity: string
      confidence: string
      file: string
      line: number
      cves?: string[]
    }>
  }
}

function parse(scan: ScanResult | null): Raw | null {
  if (scan?.scanType !== "vuln" || !scan.rawOutput) return null
  try {
    return JSON.parse(scan.rawOutput) as Raw
  } catch {
    return null
  }
}

function count(scan: ScanResult) {
  if (scan.scanType !== "vuln") return scan.hosts.length
  const data = parse(scan)
  return (data?.dependency?.findingCount ?? 0) + (data?.code?.findingCount ?? 0)
}

export default Scans
