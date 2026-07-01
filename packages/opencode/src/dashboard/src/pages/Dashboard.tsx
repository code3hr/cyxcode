import { Component, createEffect, createMemo, createSignal, For, Show, onCleanup } from "solid-js"
import { A } from "@solidjs/router"
import { cyxApi, statsApi, watchApi, type OverviewStats, type TokenReport, type TrendData, type WatchReport } from "../api/client"
import { SeverityPie } from "../components/charts/SeverityPie"
import { TrendLine } from "../components/charts/TrendLine"
import { StatusBar } from "../components/charts/StatusBar"
import { sseClient } from "../api/sse"

type Kpi = {
  label: string
  value: string
  note: string
  icon: string
  tone: string
  trend: string
  trendTone: string
}

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

  onCleanup(
    sseClient.on("pentest.finding_created", () => {
      fetchData()
    })
  )

  const fmt = (n: number) => n.toLocaleString()
  const fmtTime = (ms: number) => {
    if (ms <= 0) return "N/A"
    const h = Math.floor(ms / 3600000)
    if (h > 0) return `${h}h`
    return `${Math.max(1, Math.floor(ms / 60000))}m`
  }

  const kpis = createMemo(() => {
    if (!stats()) {
      return [] as Kpi[]
    }

    const found = stats()!
    const seen = watch()
    const used = token()

    return [
      {
        label: "Total Findings",
        value: fmt(found.findings.total),
        note: "All tracked findings",
        icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
        tone: "text-cyan-300",
        trend: "Signal steady",
        trendTone: "text-slate-400",
      },
      {
        label: "Critical / High Open",
        value: fmt(found.findings.openCriticalHigh),
        note: found.findings.openCriticalHigh > 0 ? "Requires immediate triage" : "No open critical/high items",
        icon: "M12 8v4m0 4h.01M20 20h-4.586l.793-2.379a3 3 0 000-2.442L15 12V9A3 3 0 0012 6.126V5.25M12 6.126A3 3 0 009 9v3L7.793 15.179a3 3 0 000 2.442L8.586 20H4",
        tone: "text-rose-300",
        trend: found.findings.openCriticalHigh === 0 ? "All clear" : "Needs action",
        trendTone: found.findings.openCriticalHigh === 0 ? "text-emerald-300" : "text-rose-300",
      },
      {
        label: "Scans (24h)",
        value: fmt(found.scans.last24h),
        note: "New scan activity in the last 24h",
        icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2",
        tone: "text-violet-300",
        trend: "Observed",
        trendTone: "text-violet-300",
      },
      {
        label: "Mitigated (7d)",
        value: fmt(found.remediation.mitigatedLast7d),
        note: "Remediations completed in last 7 days",
        icon: "M9 12l2 2 4-4m6.586-3.586A4 4 0 1116.586 4.414a4 4 0 01-5.172 5.172z",
        tone: "text-emerald-300",
        trend: found.remediation.mitigatedLast7d > 0 ? "Closing fast" : "No closes yet",
        trendTone: found.remediation.mitigatedLast7d > 0 ? "text-emerald-300" : "text-slate-400",
      },
      {
        label: "CyxWatch Alerts",
        value: fmt(seen?.alerts ?? 0),
        note: "Runtime policy events",
        icon: "M12 8v4m0 4h.01M4 20h16M4 20V8a8 8 0 1116 0v12M4 20h16",
        tone: "text-amber-300",
        trend: seen && seen.total > 0 ? "Active telemetry" : "No active alerts",
        trendTone: seen && seen.total > 0 ? "text-amber-300" : "text-slate-400",
      },
      {
        label: "Blocked Actions",
        value: fmt(seen?.decisions.block ?? 0),
        note: "Policy decisions denied",
        icon: "M13 10V3L4 14h7v7l9-11h-7z",
        tone: "text-rose-300",
        trend: seen && seen.decisions.block > 0 ? "Policy holds traffic" : "No blocks",
        trendTone: seen && seen.decisions.block > 0 ? "text-rose-300" : "text-slate-400",
      },
      {
        label: "Token Efficiency",
        value: used ? `${used.tokens.savingsPercent.toFixed(1)}%` : "0.0%",
        note: "Savings ratio this period",
        icon: "M13 10V3L4 14h7v7l9-11h-7z",
        tone: "text-cyan-300",
        trend: used && used.tokens.savingsPercent > 0 ? "Budget optimized" : "No savings yet",
        trendTone: used && used.tokens.savingsPercent > 0 ? "text-cyan-300" : "text-slate-400",
      },
      {
        label: "Tokens Saved",
        value: fmt(used?.tokens.saved ?? 0),
        note: "Total tokens reduced",
        icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        tone: "text-emerald-300",
        trend: used && used.tokens.saved > 0 ? "Savings accruing" : "Start with first run",
        trendTone: used && used.tokens.saved > 0 ? "text-emerald-300" : "text-slate-400",
      },
    ]
  })

  return (
    <div class="space-y-6">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <For each={kpis()}>
          {(item) => (
            <article class="stat-card">
              <div class="mb-4 flex items-start justify-between gap-3">
                <div class="text-left">
                  <div class="text-xs uppercase tracking-[0.12em] text-slate-500">{item.label}</div>
                  <div class={`stat-value mt-3 ${item.tone}`}>{item.value}</div>
                  <div class={`stat-trend mt-1 ${item.trendTone}`}>{item.trend}</div>
                  <div class="mt-3 text-xs text-slate-500">{item.note}</div>
                </div>
                <div class={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.tone} bg-white/5 border border-white/10`}>
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
                  </svg>
                </div>
              </div>
            </article>
          )}
        </For>
      </div>

      <Show when={error()}>
        <div class="rounded border border-rose-300/20 bg-rose-900/30 px-4 py-3 text-rose-200">{error()}</div>
      </Show>

      <Show when={loading() && !stats()}>
        <div class="card">
          <div class="text-slate-300">Loading metrics...</div>
        </div>
      </Show>

      <Show when={stats()}>
        <section class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article class="card">
            <div class="flex items-center justify-between">
              <div class="card-header">Severity Distribution</div>
              <A href="/findings" class="text-sm font-medium text-cyan-300 hover:text-cyan-200">
                View all findings
              </A>
            </div>
            <SeverityPie data={stats()!.findings.bySeverity} size={180} />
          </article>

          <article class="card">
            <div class="mb-4 flex items-center justify-between">
              <div class="card-header">Status Distribution</div>
              <A href="/findings" class="text-sm font-medium text-cyan-300 hover:text-cyan-200">
                Open findings
              </A>
            </div>
            <StatusBar data={stats()!.findings.byStatus} height={32} />
            <div class="mt-5 grid grid-cols-2 gap-4">
              <div class="rounded-[16px] bg-white/5 p-4">
                <div class="text-xs text-slate-400">Active monitors</div>
                <div class="text-2xl font-semibold text-white">{stats()!.scans.activeMonitors}</div>
              </div>
              <div class="rounded-[16px] bg-white/5 p-4">
                <div class="text-xs text-slate-400">Avg time to fix</div>
                <div class="text-2xl font-semibold text-white">{fmtTime(stats()!.remediation.avgTimeToMitigate)}</div>
              </div>
            </div>
          </article>
        </section>

        <article class="card">
          <div class="mb-4 flex items-center justify-between">
            <div class="card-header">Finding Trends (30d)</div>
            <A href="/findings?status=open" class="text-sm font-medium text-cyan-300 hover:text-cyan-200">
              Open findings
            </A>
          </div>
          <TrendLine data={trends()} height={260} />
        </article>

        <section class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <A href="/findings?status=open" class="card hover:bg-white/[0.08]">
            <div class="flex items-start gap-4">
              <div class="rounded-full bg-rose-500/20 p-3 text-rose-200">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div class="font-semibold text-white">Open Findings</div>
                <div class="text-sm text-slate-400">{stats()!.findings.byStatus.open || 0} issues need immediate attention</div>
              </div>
            </div>
          </A>

          <A href="/compliance" class="card hover:bg-white/[0.08]">
            <div class="flex items-start gap-4">
              <div class="rounded-full bg-blue-500/20 p-3 text-blue-200">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622" />
                </svg>
              </div>
              <div>
                <div class="font-semibold text-white">Compliance</div>
                <div class="text-sm text-slate-400">Assess controls and map risks against PCI-DSS, HIPAA, SOC2</div>
              </div>
            </div>
          </A>

          <A href="/reports" class="card hover:bg-white/[0.08]">
            <div class="flex items-start gap-4">
              <div class="rounded-full bg-emerald-500/20 p-3 text-emerald-200">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414" />
                </svg>
              </div>
              <div>
                <div class="font-semibold text-white">Generate Report</div>
                <div class="text-sm text-slate-400">Export executive and technical reporting snapshots</div>
              </div>
            </div>
          </A>
        </section>
      </Show>
    </div>
  )
}

export default Dashboard
