import { Component, createSignal, createEffect, Show, For, onCleanup } from "solid-js"
import { useParams } from "@solidjs/router"
import { scansApi, type ScanResult } from "../api/client"
import { DataTable, type Column } from "../components/shared/DataTable"
import { sseClient } from "../api/sse"

const Scans: Component = () => {
  const params = useParams()

  const [scans, setScans] = createSignal<ScanResult[]>([])
  const [activeScans, setActiveScans] = createSignal<string[]>([])
  const [selectedScan, setSelectedScan] = createSignal<ScanResult | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

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
      header: "Hosts",
      width: "80px",
      render: (s) => (
        <span class="text-gray-300">{s.hosts.length}</span>
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
          <p class="text-gray-400 mt-1">Network and vulnerability scan results</p>
        </div>
        <div class="flex items-center gap-4">
          <Show when={activeScans().length > 0}>
            <span class="badge bg-blue-900 text-blue-200 animate-pulse">
              {activeScans().length} active scan{activeScans().length > 1 ? "s" : ""}
            </span>
          </Show>
          <span class="text-sm text-gray-400">{scans().length} scans</span>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error()}
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

              {/* Hosts */}
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

export default Scans
