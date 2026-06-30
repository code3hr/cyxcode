import { Component, For } from "solid-js"
import { A, useLocation } from "@solidjs/router"

interface HeaderProps {
  connected: boolean
}

type Nav = {
  path: string
  label: string
  icon: string
}

const nav: Nav[] = [
  { path: "/", label: "Overview", icon: "M3 12h7V3H3v9zm0 9h7v-7H3v7zm11 0h7v-9h-7v9zm0-18v7h7V3h-7z" },
  { path: "/security", label: "CyxWatch", icon: "M12 2l7 4v6c0 5.25-3.438 9.75-7 10-3.562-.25-7-4.75-7-10V6l7-4z M9 12l2 2 4-4" },
  { path: "/graph", label: "Graph", icon: "M9 3h6v6H9V3z M3 15h6v6H3v-6z M15 15h6v6h-6v-6z M12 9v6m-3-3h6" },
  { path: "/wiki", label: "Wiki", icon: "M12 20h9 M12 4h9 M4 4h2a2 2 0 012 2v12a2 2 0 01-2 2H4m0-16v16" },
  { path: "/memory", label: "Memory", icon: "M5 7h14M5 12h14M5 17h14" },
  { path: "/findings", label: "Findings", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  { path: "/scans", label: "Scans", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" },
  { path: "/monitors", label: "Monitors", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
  { path: "/compliance", label: "Compliance", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622" },
  { path: "/reports", label: "Reports", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414" },
  { path: "/tokens", label: "Tokens", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
]

export const Header: Component<HeaderProps> = (props) => {
  const loc = useLocation()

  const route = () => {
    const here = loc.pathname
    if (here === "/dashboard" || here === "/dashboard/") return "/"
    return here.replace("/dashboard", "") || "/"
  }

  const active = (path: string) => {
    const here = route()
    if (path === "/") return here === "/"
    return here === path || here.startsWith(`${path}/`)
  }

  return (
    <header class="sticky top-0 z-20 border-b border-white/10 bg-[#0b1220]/90 backdrop-blur-sm">
      <div class="px-4 py-3 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="text-xs tracking-[0.25em] text-slate-400">Runtime Security</div>
            <div class="text-2xl font-semibold text-white">CyxCode Overview</div>
            <div class="text-xs text-slate-500">Assessments / Runtime Signals / Project Intelligence</div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              class="rounded border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-white/15"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>

            <button
              class="relative inline-flex rounded border border-white/10 bg-white/5 px-3 py-2 text-slate-100 transition-colors hover:bg-white/15"
              title="Notifications"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 17h5l-1.4-1.4A2 2 0 0118 14V11a6 6 0 10-12 0v3c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span class="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-cyan-400" />
            </button>

            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-semibold text-cyan-200">
              {props.connected ? "J" : "..."}
            </div>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto border-t border-white/5 px-2 pb-2 pt-1 sm:px-6 lg:px-8">
        <div class="inline-flex min-w-full flex-wrap gap-1">
          <For each={nav}>
            {(item) => {
              const href = item.path
              return (
                <A
                  href={href}
                  class={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                    active(href)
                      ? "bg-cyan-400/15 text-cyan-200"
                      : "text-slate-300 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
                  </svg>
                  <span class="whitespace-nowrap">{item.label}</span>
                </A>
              )
            }}
          </For>
        </div>
      </div>
    </header>
  )
}

