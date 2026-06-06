import { Component, For } from "solid-js"
import { A, useLocation } from "@solidjs/router"

type Nav = {
  path: string
  label: string
  icon: string
}

type Group = {
  name: string
  items: Nav[]
}

const groups: Group[] = [
  {
    name: "Operate",
    items: [
      { path: "/", label: "Overview", icon: "M3 12h7V3H3v9zm0 9h7v-7H3v7zm11 0h7v-9h-7v9zm0-18v7h7V3h-7z" },
      { path: "/security", label: "CyxWatch", icon: "M12 2l7 4v6c0 5.25-3.438 9.75-7 10-3.562-.25-7-4.75-7-10V6l7-4z M9 12l2 2 4-4" },
    ],
  },
  {
    name: "Knowledge",
    items: [
      { path: "/graph", label: "Graph", icon: "M9 3h6v6H9V3z M3 15h6v6H3v-6z M15 15h6v6h-6v-6z M12 9v6m-3-3h6" },
      { path: "/wiki", label: "Wiki", icon: "M12 20h9 M12 4h9 M4 4h2a2 2 0 012 2v12a2 2 0 01-2 2H4m0-16v16" },
      { path: "/memory", label: "Memory", icon: "M5 7h14M5 12h14M5 17h14" },
      { path: "/codegraph", label: "Code", icon: "M8 9l4-4 4 4m0 6l-4 4-4-4 M4 5h16v14H4z" },
    ],
  },
  {
    name: "Assessments",
    items: [
      { path: "/findings", label: "Findings", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
      { path: "/scans", label: "Scans", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" },
      { path: "/monitors", label: "Monitors", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
      { path: "/compliance", label: "Compliance", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622" },
      { path: "/reports", label: "Reports", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414" },
    ],
  },
  {
    name: "Efficiency",
    items: [
      { path: "/tokens", label: "Tokens", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    ],
  },
]

export const Sidebar: Component = () => {
  const loc = useLocation()

  const active = (path: string) => {
    if (path === "/") return loc.pathname === "/" || loc.pathname === "/dashboard" || loc.pathname === "/dashboard/"
    return loc.pathname.startsWith(path)
  }

  return (
    <aside class="w-64 bg-gray-950 border-r border-gray-800 flex flex-col">
      <div class="h-16 flex items-center px-4 border-b border-gray-800">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-semibold">
            C
          </div>
          <div class="min-w-0">
            <div class="font-semibold text-gray-100 leading-5">CyxCode</div>
            <div class="text-xs text-gray-500 truncate">Runtime console</div>
          </div>
        </div>
      </div>

      <nav class="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        <For each={groups}>
          {(group) => (
            <div>
              <div class="px-2 mb-2 text-[11px] uppercase tracking-wider text-gray-600">{group.name}</div>
              <div class="space-y-1">
                <For each={group.items}>
                  {(item) => (
                    <A href={item.path} class={`nav-link ${active(item.path) ? "nav-link-active" : ""}`}>
                      <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
                      </svg>
                      <span class="truncate">{item.label}</span>
                    </A>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </nav>

      <div class="p-4 border-t border-gray-800">
        <div class="text-xs text-gray-500">Local-first agent telemetry</div>
      </div>
    </aside>
  )
}
