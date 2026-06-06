import { Component, createSignal, createEffect, onCleanup, Show } from "solid-js"
import { A } from "@solidjs/router"
import { cyxApi, statsApi, watchApi, type OverviewStats, type TokenReport, type TrendData, type WatchReport } from "../api/client"
import { SeverityPie } from "../components/charts/SeverityPie"
import { TrendLine } from "../components/charts/TrendLine"
import { StatusBar } from "../components/charts/StatusBar"
import { sseClient } from "../api/sse"

const Dashboard: Component = () => {
  const [stats, setStats] = createSignal<OverviewStats | null>(null)
  const [trends, setTrends] = createSignal<TrendData[]>([])
  const [watch, setWatch] = createSignal<WatchReport | null>(null)
  const [token, setToken] = createSignal<TokenReport | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    const [statsResult, trendsResult, watchResult, tokenResult] = await Promise.all([
      statsApi.overview(),
      statsApi.trends(30),
      watchApi.report("7d"),
      cyxApi.report("7d"),
    ])

    if (statsResult.error) {
      setError(statsResult.error)
    } else if (statsResult.data) {
      setStats(statsResult.data)
    }

    if (trendsResult.data) {
      setTrends(trendsResult.data.trends)
    }

    if (watchResult.data) {
      setWatch(watchResult.data.report)
    }

    if (tokenResult.data) {
      setToken(tokenResult.data.report)
    }

    setLoading(false)
  }

  createEffect(() => {
    fetchData()
  })

  // Refresh on new findings
  onCleanup(
    sseClient.on("pentest.finding_created", () => {
      fetchData()
    })
  )

  const formatDuration = (ms: number) => {
    if (ms === 0) return "N/A"
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    const minutes = Math.floor(ms / (1000 * 60))
    return `${minutes}m`
  }

  return (
    <div class="space-y-6">
      {/* Page header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">CyxCode Overview</h1>
          <p class="text-gray-400 mt-1">Runtime security, assessments, and project intelligence</p>
        </div>
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

      <Show when={error()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error()}
        </div>
      </Show>

      <Show when={loading() && !stats()}>
        <div class="flex items-center justify-center h-64">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </Show>

      <Show when={stats()}>
        {/* Stats cards */}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class="stat-value">{stats()!.findings.total}</div>
                <div class="stat-label">Total Findings</div>
              </div>
              <div class="w-12 h-12 bg-blue-900/50 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class={`stat-value ${stats()!.findings.openCriticalHigh > 0 ? "text-red-400" : "text-green-400"}`}>
                  {stats()!.findings.openCriticalHigh}
                </div>
                <div class="stat-label">Critical/High Open</div>
              </div>
              <div class={`w-12 h-12 ${stats()!.findings.openCriticalHigh > 0 ? "bg-red-900/50" : "bg-green-900/50"} rounded-lg flex items-center justify-center`}>
                <svg class={`w-6 h-6 ${stats()!.findings.openCriticalHigh > 0 ? "text-red-400" : "text-green-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class="stat-value">{stats()!.scans.last24h}</div>
                <div class="stat-label">Scans (24h)</div>
              </div>
              <div class="w-12 h-12 bg-purple-900/50 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class="stat-value text-green-400">{stats()!.remediation.mitigatedLast7d}</div>
                <div class="stat-label">Mitigated (7d)</div>
              </div>
              <div class="w-12 h-12 bg-green-900/50 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class={`stat-value ${(watch()?.alerts ?? 0) > 0 ? "text-orange-300" : "text-green-300"}`}>
                  {watch()?.alerts ?? 0}
                </div>
                <div class="stat-label">CyxWatch Alerts</div>
              </div>
              <div class="w-12 h-12 bg-orange-950/50 rounded flex items-center justify-center">
                <svg class="w-6 h-6 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2l7 4v6c0 5.25-3.438 9.75-7 10-3.562-.25-7-4.75-7-10V6l7-4z" />
                </svg>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class="stat-value text-red-300">{watch()?.decisions.block ?? 0}</div>
                <div class="stat-label">Blocked Actions</div>
              </div>
              <div class="w-12 h-12 bg-red-950/50 rounded flex items-center justify-center">
                <svg class="w-6 h-6 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6L6 18M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class="stat-value text-cyan-300">{token()?.tokens.savingsPercent.toFixed(1) ?? "0.0"}%</div>
                <div class="stat-label">Token Efficiency</div>
              </div>
              <div class="w-12 h-12 bg-cyan-950/50 rounded flex items-center justify-center">
                <svg class="w-6 h-6 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex items-center justify-between">
              <div>
                <div class="stat-value text-emerald-300">{(token()?.tokens.saved ?? 0).toLocaleString()}</div>
                <div class="stat-label">Tokens Saved</div>
              </div>
              <div class="w-12 h-12 bg-emerald-950/50 rounded flex items-center justify-center">
                <svg class="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Severity distribution */}
          <div class="card">
            <div class="card-header flex items-center justify-between">
              <span>Severity Distribution</span>
              <A href="/findings" class="text-sm text-blue-400 hover:text-blue-300">View all</A>
            </div>
            <SeverityPie data={stats()!.findings.bySeverity} size={180} />
          </div>

          {/* Status distribution */}
          <div class="card">
            <div class="card-header flex items-center justify-between">
              <span>Finding Status</span>
              <A href="/findings" class="text-sm text-blue-400 hover:text-blue-300">View all</A>
            </div>
            <div class="space-y-4">
              <StatusBar data={stats()!.findings.byStatus} height={32} />
              <div class="grid grid-cols-2 gap-4 mt-6">
                <div class="text-center p-4 bg-gray-750 rounded-lg">
                  <div class="text-2xl font-bold text-gray-100">
                    {stats()!.scans.activeMonitors}
                  </div>
                  <div class="text-sm text-gray-400">Active Monitors</div>
                </div>
                <div class="text-center p-4 bg-gray-750 rounded-lg">
                  <div class="text-2xl font-bold text-gray-100">
                    {formatDuration(stats()!.remediation.avgTimeToMitigate)}
                  </div>
                  <div class="text-sm text-gray-400">Avg. Time to Fix</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trend chart */}
        <div class="card">
          <div class="card-header">Finding Trends (30 days)</div>
          <TrendLine data={trends()} height={250} />
        </div>

        {/* Quick actions */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <A href="/findings?status=open" class="card hover:border-blue-500 transition-colors group">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-red-900/50 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-100 group-hover:text-blue-400">Open Findings</div>
                <div class="text-sm text-gray-400">{stats()!.findings.byStatus.open || 0} issues need attention</div>
              </div>
            </div>
          </A>

          <A href="/compliance" class="card hover:border-blue-500 transition-colors group">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-blue-900/50 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-100 group-hover:text-blue-400">Compliance</div>
                <div class="text-sm text-gray-400">Run PCI-DSS, HIPAA, SOC2 assessments</div>
              </div>
            </div>
          </A>

          <A href="/reports" class="card hover:border-blue-500 transition-colors group">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-green-900/50 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div class="font-medium text-gray-100 group-hover:text-blue-400">Generate Report</div>
                <div class="text-sm text-gray-400">Executive or technical reports</div>
              </div>
            </div>
          </A>
        </div>
      </Show>
    </div>
  )
}

export default Dashboard
