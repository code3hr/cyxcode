import { Component, createSignal, createEffect, For, Show } from "solid-js"

/**
 * Tokens Dashboard Page
 *
 * Shows CyxCode token savings, audit events, and pattern metrics.
 */

type TokenReport = {
  period: { name: string; start: string; end: string }
  tokens: { saved: number; used: number; savingsPercent: number; costSaved: number }
  patterns: {
    matches: number
    misses: number
    hitRate: number
    learned: number
    top: Array<{ id: string; matches: number; tokensSaved: number }>
  }
  corrections: {
    added: number
    reinforced: number
    promoted: number
    driftEvents: number
    complianceRate: number
  }
  memory: { loaded: number; totalChars: number }
  sessions: number
}

type AuditEntry = {
  id: string
  timestamp: number
  type: string
  sessionID?: string
  data: Record<string, any>
}

const Tokens: Component = () => {
  const [period, setPeriod] = createSignal<"1h" | "1d" | "7d" | "30d">("7d")
  const [report, setReport] = createSignal<TokenReport | null>(null)
  const [events, setEvents] = createSignal<AuditEntry[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch report from API
      const reportRes = await fetch(`/api/cyxcode/report?period=${period()}`)
      if (reportRes.ok) {
        const data = await reportRes.json()
        setReport(data)
      } else {
        // Use mock data if API not available
        setReport(getMockReport())
      }

      // Fetch recent events
      const eventsRes = await fetch(`/api/cyxcode/audit?last=${period()}&limit=20`)
      if (eventsRes.ok) {
        const data = await eventsRes.json()
        setEvents(data.entries || [])
      } else {
        setEvents([])
      }
    } catch (e) {
      // Use mock data for demo
      setReport(getMockReport())
      setEvents([])
    }

    setLoading(false)
  }

  createEffect(() => {
    fetchData()
  })

  const formatNumber = (n: number) => n.toLocaleString()
  const formatPercent = (n: number) => `${(n * 100).toFixed(1)}%`
  const formatCost = (n: number) => `$${n.toFixed(2)}`

  const formatEventType = (type: string) => {
    return type.replace("cyxcode.", "").replace(".", " ")
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString()
  }

  return (
    <div class="space-y-6">
      {/* Page header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Token Savings</h1>
          <p class="text-gray-400 mt-1">CyxCode pattern matching and audit metrics</p>
        </div>
        <div class="flex items-center gap-4">
          <select
            value={period()}
            onChange={(e) => setPeriod(e.target.value as any)}
            class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-gray-100"
          >
            <option value="1h">Last Hour</option>
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={fetchData}
            class="btn btn-secondary flex items-center gap-2"
            disabled={loading()}
          >
            <svg class={`w-4 h-4 ${loading() ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error()}
        </div>
      </Show>

      <Show when={loading() && !report()}>
        <div class="flex items-center justify-center h-64">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </Show>

      <Show when={report()}>
        {/* Token savings cards */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class="stat-value text-green-400">{formatNumber(report()!.tokens.saved)}</div>
                <div class="stat-label">Tokens Saved</div>
              </div>
              <div class="w-12 h-12 bg-green-900/50 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class="stat-value text-blue-400">{formatCost(report()!.tokens.costSaved)}</div>
                <div class="stat-label">Cost Saved</div>
              </div>
              <div class="w-12 h-12 bg-blue-900/50 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class="stat-value">{formatPercent(report()!.patterns.hitRate)}</div>
                <div class="stat-label">Pattern Hit Rate</div>
              </div>
              <div class="w-12 h-12 bg-purple-900/50 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class="stat-value">{report()!.patterns.matches}</div>
                <div class="stat-label">Pattern Matches</div>
              </div>
              <div class="w-12 h-12 bg-orange-900/50 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Pattern and corrections stats */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pattern stats */}
          <div class="card">
            <div class="card-header">Pattern Statistics</div>
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Matches</span>
                <span class="text-green-400 font-semibold">{report()!.patterns.matches}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Misses</span>
                <span class="text-red-400 font-semibold">{report()!.patterns.misses}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Hit Rate</span>
                <span class="text-blue-400 font-semibold">{formatPercent(report()!.patterns.hitRate)}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Learned</span>
                <span class="text-purple-400 font-semibold">{report()!.patterns.learned}</span>
              </div>

              {/* Hit rate bar */}
              <div class="mt-4">
                <div class="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-green-500 to-green-400"
                    style={{ width: `${report()!.patterns.hitRate * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Corrections stats */}
          <div class="card">
            <div class="card-header">Correction Statistics</div>
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Added</span>
                <span class="text-blue-400 font-semibold">{report()!.corrections.added}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Reinforced</span>
                <span class="text-yellow-400 font-semibold">{report()!.corrections.reinforced}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Promoted</span>
                <span class="text-green-400 font-semibold">{report()!.corrections.promoted}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Drift Events</span>
                <span class="text-red-400 font-semibold">{report()!.corrections.driftEvents}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Compliance Rate</span>
                <span class="text-green-400 font-semibold">{formatPercent(report()!.corrections.complianceRate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top patterns */}
        <Show when={report()!.patterns.top.length > 0}>
          <div class="card">
            <div class="card-header">Top Patterns by Token Savings</div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="text-left text-gray-400 border-b border-gray-700">
                    <th class="pb-3 font-medium">Pattern</th>
                    <th class="pb-3 font-medium text-right">Matches</th>
                    <th class="pb-3 font-medium text-right">Tokens Saved</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={report()!.patterns.top}>
                    {(pattern, index) => (
                      <tr class="border-b border-gray-700/50">
                        <td class="py-3">
                          <div class="flex items-center gap-2">
                            <span class="text-gray-500">{index() + 1}.</span>
                            <span class="text-gray-100 font-mono text-sm">{pattern.id}</span>
                          </div>
                        </td>
                        <td class="py-3 text-right text-gray-300">{pattern.matches}</td>
                        <td class="py-3 text-right text-green-400">{formatNumber(pattern.tokensSaved)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>

        {/* Recent events */}
        <div class="card">
          <div class="card-header flex items-center justify-between">
            <span>Recent Audit Events</span>
            <span class="text-sm text-gray-400">{events().length} events</span>
          </div>
          <Show when={events().length === 0}>
            <div class="text-center py-8 text-gray-400">
              No audit events recorded yet. Events will appear as you use CyxCode.
            </div>
          </Show>
          <Show when={events().length > 0}>
            <div class="space-y-2 max-h-96 overflow-y-auto">
              <For each={events()}>
                {(event) => (
                  <div class="flex items-center gap-4 p-3 bg-gray-750 rounded-lg">
                    <span class="text-gray-500 text-sm font-mono">{formatTime(event.timestamp)}</span>
                    <span class={`px-2 py-0.5 rounded text-xs font-medium ${getEventColor(event.type)}`}>
                      {formatEventType(event.type)}
                    </span>
                    <span class="text-gray-300 text-sm truncate flex-1">
                      {formatEventData(event)}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Summary footer */}
        <div class="card bg-gradient-to-r from-green-900/20 to-blue-900/20">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-lg font-semibold text-gray-100">
                Efficiency: {report()!.tokens.savingsPercent.toFixed(1)}%
              </div>
              <div class="text-gray-400">
                {formatNumber(report()!.tokens.saved)} tokens saved, {formatNumber(report()!.tokens.used)} tokens used
              </div>
            </div>
            <div class="text-right">
              <div class="text-2xl font-bold text-green-400">
                {formatCost(report()!.tokens.costSaved)}
              </div>
              <div class="text-gray-400">estimated savings</div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}

function getEventColor(type: string): string {
  if (type.includes("match")) return "bg-green-900/50 text-green-300"
  if (type.includes("miss")) return "bg-red-900/50 text-red-300"
  if (type.includes("learned")) return "bg-purple-900/50 text-purple-300"
  if (type.includes("correction")) return "bg-blue-900/50 text-blue-300"
  if (type.includes("drift")) return "bg-orange-900/50 text-orange-300"
  if (type.includes("memory")) return "bg-cyan-900/50 text-cyan-300"
  return "bg-gray-700 text-gray-300"
}

function formatEventData(event: AuditEntry): string {
  const d = event.data
  if (d.patternId) return d.patternId
  if (d.rule) return d.rule.slice(0, 50) + (d.rule.length > 50 ? "..." : "")
  if (d.tokensSaved) return `${d.tokensSaved} tokens saved`
  if (d.tokensUsed) return `${d.tokensUsed} tokens used`
  if (d.tags) return d.tags.join(", ")
  return ""
}

function getMockReport(): TokenReport {
  return {
    period: { name: "7d", start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() },
    tokens: { saved: 187200, used: 48600, savingsPercent: 79.4, costSaved: 0.37 },
    patterns: {
      matches: 847,
      misses: 203,
      hitRate: 0.807,
      learned: 12,
      top: [
        { id: "npm-404", matches: 142, tokensSaved: 28400 },
        { id: "git-conflict", matches: 98, tokensSaved: 19600 },
        { id: "ts-module-error", matches: 87, tokensSaved: 17400 },
        { id: "python-import", matches: 65, tokensSaved: 13000 },
        { id: "docker-build", matches: 52, tokensSaved: 10400 },
      ],
    },
    corrections: { added: 12, reinforced: 8, promoted: 4, driftEvents: 7, complianceRate: 0.94 },
    memory: { loaded: 45, totalChars: 12500 },
    sessions: 23,
  }
}

export default Tokens
