import { Button } from "@cyxcode/ui/button"
import { createEffect, createSignal, For, Show } from "solid-js"
import { useServer } from "@/context/server"
import { watchApi, type WatchAlert, type WatchEvent, type WatchReport } from "@/utils/dashboard-api"

export default function Security() {
  const server = useServer()
  const [period, setPeriod] = createSignal<"1h" | "1d" | "7d" | "30d" | "all">("7d")
  const [report, setReport] = createSignal<WatchReport | null>(null)
  const [events, setEvents] = createSignal<WatchEvent[]>([])
  const [alerts, setAlerts] = createSignal<WatchAlert[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const [rep, evt, alt] = await Promise.all([
        watchApi.report(server, period()),
        watchApi.recent(server, 40),
        watchApi.alerts(server, 20),
      ])
      setReport(rep.report)
      setEvents(evt.events)
      setAlerts(alt.alerts)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    const cur = server.current?.http.url
    period()
    if (!cur) return
    void load()
  })

  const fmt = (n: number) => n.toLocaleString()
  const when = (ts: number) => new Date(ts).toLocaleString()

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">CyxWatch</h1>
          <p class="text-gray-400 mt-1">Runtime observability for agent activity</p>
        </div>
        <div class="flex items-center gap-3">
          <select
            value={period()}
            onChange={(e) => setPeriod(e.currentTarget.value as typeof period extends () => infer T ? T : never)}
            class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-100"
          >
            <option value="1h">Last Hour</option>
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <Button onClick={load} disabled={loading()}>
            Refresh
          </Button>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">{error()}</div>
      </Show>

      <Show when={loading() && !report()}>
        <div class="flex items-center justify-center h-64">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </Show>

      <Show when={report()}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="stat-card">
            <div class="stat-value text-blue-400">{fmt(report()!.total)}</div>
            <div class="stat-label">Events</div>
          </div>
          <div class="stat-card">
            <div class="stat-value text-green-400">{fmt(report()!.prompt)}</div>
            <div class="stat-label">Prompt Turns</div>
          </div>
          <div class="stat-card">
            <div class="stat-value text-yellow-400">{fmt(report()!.risky)}</div>
            <div class="stat-label">Risky Events</div>
          </div>
          <div class="stat-card">
            <div class="stat-value text-red-400">{fmt(report()!.risk)}</div>
            <div class="stat-label">Risk Score</div>
          </div>
          <div class="stat-card">
            <div class="stat-value text-orange-400">{fmt(report()!.alerts)}</div>
            <div class="stat-label">Alerts</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <div class="card-header">Activity</div>
            <div class="space-y-3">
              <div class="flex justify-between text-sm"><span class="text-gray-400">Shell</span><span class="text-gray-100">{report()!.shell}</span></div>
              <div class="flex justify-between text-sm"><span class="text-gray-400">Reads</span><span class="text-gray-100">{report()!.read}</span></div>
              <div class="flex justify-between text-sm"><span class="text-gray-400">Writes</span><span class="text-gray-100">{report()!.write}</span></div>
              <div class="flex justify-between text-sm"><span class="text-gray-400">Network</span><span class="text-gray-100">{report()!.network}</span></div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">Policy Decisions</div>
            <div class="space-y-3">
              <div class="flex justify-between text-sm"><span class="text-gray-400">Allow</span><span class="text-green-400">{report()!.decisions.allow}</span></div>
              <div class="flex justify-between text-sm"><span class="text-gray-400">Warn</span><span class="text-yellow-400">{report()!.decisions.warn}</span></div>
              <div class="flex justify-between text-sm"><span class="text-gray-400">Require approval</span><span class="text-orange-400">{report()!.decisions.requireApproval}</span></div>
              <div class="flex justify-between text-sm"><span class="text-gray-400">Block</span><span class="text-red-400">{report()!.decisions.block}</span></div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card">
            <div class="card-header">Top Paths</div>
            <div class="space-y-2">
              <For each={report()!.top}>
                {(row) => (
                  <div class="flex items-center justify-between gap-4 text-sm">
                    <span class="text-gray-200 truncate">{row.path}</span>
                    <span class="text-gray-400">{row.count}</span>
                  </div>
                )}
              </For>
            </div>
          </div>

          <div class="card">
            <div class="card-header">Recent Events</div>
            <div class="space-y-3 max-h-[36rem] overflow-auto pr-1">
              <For each={events()}>
                {(event) => (
                  <div class="border border-gray-700 rounded-lg p-3">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="text-sm text-gray-100">{event.kind}</div>
                        <div class="text-xs text-gray-400">{when(event.ts)}</div>
                      </div>
                      <span class="text-xs rounded-full px-2 py-1 bg-gray-700 text-gray-200">{event.decision ?? "allow"}</span>
                    </div>
                    <div class="mt-2 text-xs text-gray-400 space-y-1">
                      <Show when={event.path}><div class="truncate">{event.path}</div></Show>
                      <Show when={event.cmd}><div class="truncate">{event.cmd}</div></Show>
                      <Show when={event.host}><div class="truncate">{event.host}</div></Show>
                      <Show when={event.prompt}><div class="truncate">{event.prompt}</div></Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Alert History</div>
          <div class="space-y-3 max-h-[24rem] overflow-auto pr-1">
            <For each={alerts()}>
              {(row) => (
                <div class="border border-gray-700 rounded-lg p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="text-sm text-gray-100">{row.title}</div>
                      <div class="text-xs text-gray-400">{when(row.ts)}</div>
                    </div>
                    <span class="text-xs rounded-full px-2 py-1 bg-gray-700 text-gray-200">{row.kind}</span>
                  </div>
                  <div class="mt-2 text-xs text-gray-400 space-y-1">
                    <div>{row.summary}</div>
                    <Show when={row.path}><div class="truncate">{row.path}</div></Show>
                    <Show when={row.cmd}><div class="truncate">{row.cmd}</div></Show>
                    <Show when={row.host}><div class="truncate">{row.host}</div></Show>
                    <Show when={row.prompt}><div class="truncate">{row.prompt}</div></Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
