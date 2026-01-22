import { Component, createSignal, createEffect, Show, For, onCleanup } from "solid-js"
import { useParams } from "@solidjs/router"
import { monitorsApi, type Monitor, type MonitorRun } from "../api/client"
import { StatusBadge } from "../components/shared/StatusBadge"
import { DataTable, type Column } from "../components/shared/DataTable"
import { sseClient } from "../api/sse"

const Monitors: Component = () => {
  const params = useParams()

  const [monitors, setMonitors] = createSignal<Monitor[]>([])
  const [runs, setRuns] = createSignal<MonitorRun[]>([])
  const [selectedMonitor, setSelectedMonitor] = createSignal<Monitor | null>(null)
  const [runningMonitors, setRunningMonitors] = createSignal<string[]>([])
  const [loading, setLoading] = createSignal(true)
  const [triggering, setTriggering] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  const fetchMonitors = async () => {
    setLoading(true)
    setError(null)

    const result = await monitorsApi.list()

    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setMonitors(result.data.monitors)
    }

    setLoading(false)
  }

  const fetchMonitorDetail = async (id: string) => {
    const result = await monitorsApi.get(id)
    if (result.data) {
      setSelectedMonitor(result.data.monitor)
      fetchRuns(id)
    }
  }

  const fetchRuns = async (monitorId: string) => {
    const result = await monitorsApi.listRuns(monitorId, 10)
    if (result.data) {
      setRuns(result.data.runs)
    }
  }

  const triggerRun = async (monitorId: string) => {
    setTriggering(monitorId)
    const result = await monitorsApi.triggerRun(monitorId)
    setTriggering(null)

    if (result.error) {
      setError(result.error)
    } else {
      setRunningMonitors((prev) => [...prev, monitorId])
    }
  }

  createEffect(() => {
    if (params.id) {
      fetchMonitorDetail(params.id)
    } else {
      setSelectedMonitor(null)
      setRuns([])
    }
  })

  createEffect(() => {
    fetchMonitors()
  })

  // Real-time updates
  onCleanup(
    sseClient.on("pentest.monitor.run_started", (event) => {
      const monitorID = event.properties.monitorID as string
      if (monitorID) {
        setRunningMonitors((prev) => [...prev, monitorID])
      }
    })
  )

  onCleanup(
    sseClient.on("pentest.monitor.run_completed", (event) => {
      const monitorID = event.properties.monitorID as string
      if (monitorID) {
        setRunningMonitors((prev) => prev.filter((id) => id !== monitorID))
        fetchMonitors()
        if (selectedMonitor()?.id === monitorID) {
          fetchRuns(monitorID)
        }
      }
    })
  )

  onCleanup(
    sseClient.on("pentest.monitor.run_failed", (event) => {
      const monitorID = event.properties.monitorID as string
      if (monitorID) {
        setRunningMonitors((prev) => prev.filter((id) => id !== monitorID))
        fetchMonitors()
      }
    })
  )

  const formatSchedule = (monitor: Monitor) => {
    if (monitor.schedule.type === "interval") {
      const hours = Math.floor((monitor.schedule.interval || 0) / (60 * 60 * 1000))
      if (hours >= 24) return `Every ${Math.floor(hours / 24)} day(s)`
      return `Every ${hours} hour(s)`
    }
    return monitor.schedule.cron || "Custom"
  }

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (60 * 1000))
    const hours = Math.floor(diff / (60 * 60 * 1000))
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return "Just now"
  }

  const columns: Column<Monitor>[] = [
    {
      key: "name",
      header: "Name",
      render: (m) => (
        <div>
          <div class="font-medium text-gray-100">{m.name}</div>
          <div class="text-xs text-gray-500 mt-1">{m.targets.join(", ")}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (m) => (
        <div class="flex items-center gap-2">
          <StatusBadge status={m.status} />
          <Show when={runningMonitors().includes(m.id)}>
            <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="Running" />
          </Show>
        </div>
      ),
    },
    {
      key: "schedule",
      header: "Schedule",
      width: "120px",
      render: (m) => <span class="text-gray-400">{formatSchedule(m)}</span>,
    },
    {
      key: "runCount",
      header: "Runs",
      width: "80px",
      render: (m) => <span class="text-gray-300">{m.runCount}</span>,
    },
    {
      key: "lastRunAt",
      header: "Last Run",
      width: "120px",
      render: (m) => (
        <span class="text-gray-400 text-sm">
          {m.lastRunAt ? formatRelativeTime(m.lastRunAt) : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      render: (m) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            triggerRun(m.id)
          }}
          disabled={triggering() === m.id || runningMonitors().includes(m.id) || m.status !== "active"}
          class="btn btn-secondary text-xs disabled:opacity-50"
        >
          {triggering() === m.id || runningMonitors().includes(m.id) ? "Running..." : "Run Now"}
        </button>
      ),
    },
  ]

  const runColumns: Column<MonitorRun>[] = [
    {
      key: "runNumber",
      header: "#",
      width: "60px",
      render: (r) => <span class="text-gray-400">#{r.runNumber}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "findings",
      header: "Findings",
      width: "100px",
      render: (r) => (
        <div class="text-sm">
          <span class="text-gray-300">{r.findingIDs.length}</span>
          <Show when={r.newFindingIDs.length > 0}>
            <span class="text-green-400 ml-1">(+{r.newFindingIDs.length})</span>
          </Show>
        </div>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      width: "100px",
      render: (r) => {
        if (!r.endTime) return <span class="text-gray-400">-</span>
        const seconds = Math.floor((r.endTime - r.startTime) / 1000)
        return <span class="text-gray-400">{seconds}s</span>
      },
    },
    {
      key: "startTime",
      header: "Started",
      render: (r) => (
        <span class="text-gray-400 text-sm">
          {new Date(r.startTime).toLocaleString()}
        </span>
      ),
    },
  ]

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Monitors</h1>
          <p class="text-gray-400 mt-1">Scheduled security scans and assessments</p>
        </div>
        <div class="flex items-center gap-4">
          <Show when={runningMonitors().length > 0}>
            <span class="badge bg-blue-900 text-blue-200 animate-pulse">
              {runningMonitors().length} running
            </span>
          </Show>
          <span class="text-sm text-gray-400">{monitors().length} monitors</span>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error()}
        </div>
      </Show>

      {/* Main content */}
      <div class="flex gap-6">
        {/* Monitors list */}
        <div class={`card flex-1 ${selectedMonitor() ? "max-w-2xl" : ""}`}>
          <DataTable
            columns={columns}
            data={monitors()}
            loading={loading()}
            emptyMessage="No monitors configured"
            onRowClick={(m) => {
              setSelectedMonitor(m)
              fetchRuns(m.id)
            }}
          />
        </div>

        {/* Detail panel */}
        <Show when={selectedMonitor()}>
          <div class="card w-[450px] flex-shrink-0 overflow-auto max-h-[calc(100vh-200px)]">
            <div class="flex items-center justify-between mb-4 sticky top-0 bg-gray-800 pb-4">
              <h3 class="text-lg font-semibold text-gray-100">Monitor Details</h3>
              <button
                onClick={() => {
                  setSelectedMonitor(null)
                  setRuns([])
                }}
                class="text-gray-400 hover:text-gray-100"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <div class="text-sm text-gray-400">Name</div>
                <div class="text-gray-100 font-medium">{selectedMonitor()!.name}</div>
              </div>

              <Show when={selectedMonitor()!.description}>
                <div>
                  <div class="text-sm text-gray-400">Description</div>
                  <div class="text-gray-300 text-sm">{selectedMonitor()!.description}</div>
                </div>
              </Show>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-sm text-gray-400">Status</div>
                  <StatusBadge status={selectedMonitor()!.status} />
                </div>
                <div>
                  <div class="text-sm text-gray-400">Schedule</div>
                  <div class="text-gray-300">{formatSchedule(selectedMonitor()!)}</div>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400">Targets</div>
                <div class="flex flex-wrap gap-1 mt-1">
                  <For each={selectedMonitor()!.targets}>
                    {(target) => (
                      <span class="badge bg-gray-700 text-gray-300">{target}</span>
                    )}
                  </For>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400">Tools</div>
                <div class="flex flex-wrap gap-1 mt-1">
                  <For each={selectedMonitor()!.tools.filter((t) => t.enabled)}>
                    {(tool) => (
                      <span class="badge bg-blue-900 text-blue-200">{tool.tool}</span>
                    )}
                  </For>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-sm text-gray-400">Total Runs</div>
                  <div class="text-gray-100 font-medium">{selectedMonitor()!.runCount}</div>
                </div>
                <div>
                  <div class="text-sm text-gray-400">Next Run</div>
                  <div class="text-gray-300 text-sm">
                    {selectedMonitor()!.nextRunAt
                      ? new Date(selectedMonitor()!.nextRunAt!).toLocaleString()
                      : "Not scheduled"}
                  </div>
                </div>
              </div>

              {/* Alerts config */}
              <div>
                <div class="text-sm text-gray-400">Alerts</div>
                <div class="text-gray-300 text-sm">
                  {selectedMonitor()!.alerts.enabled ? (
                    <>
                      Enabled - Min severity: {selectedMonitor()!.alerts.minSeverity}
                      {selectedMonitor()!.alerts.newFindingsOnly && " (new only)"}
                    </>
                  ) : (
                    "Disabled"
                  )}
                </div>
              </div>

              {/* Run history */}
              <div class="pt-4 border-t border-gray-700">
                <div class="text-sm text-gray-400 mb-2">Recent Runs</div>
                <Show when={runs().length > 0} fallback={<div class="text-gray-500 text-sm">No runs yet</div>}>
                  <div class="space-y-2 max-h-64 overflow-y-auto">
                    <For each={runs()}>
                      {(run) => (
                        <div class="bg-gray-900 p-2 rounded text-sm flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <span class="text-gray-400">#{run.runNumber}</span>
                            <StatusBadge status={run.status} size="sm" />
                          </div>
                          <div class="flex items-center gap-3 text-gray-400">
                            <span>{run.findingIDs.length} findings</span>
                            <Show when={run.newFindingIDs.length > 0}>
                              <span class="text-green-400">+{run.newFindingIDs.length}</span>
                            </Show>
                            <span>{new Date(run.startTime).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              {/* Actions */}
              <div class="pt-4 border-t border-gray-700">
                <button
                  onClick={() => triggerRun(selectedMonitor()!.id)}
                  disabled={
                    triggering() === selectedMonitor()!.id ||
                    runningMonitors().includes(selectedMonitor()!.id) ||
                    selectedMonitor()!.status !== "active"
                  }
                  class="btn btn-primary w-full disabled:opacity-50"
                >
                  {triggering() === selectedMonitor()!.id || runningMonitors().includes(selectedMonitor()!.id)
                    ? "Running..."
                    : "Run Now"}
                </button>
              </div>

              <div class="text-xs text-gray-500 pt-2">
                Created: {new Date(selectedMonitor()!.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}

export default Monitors
