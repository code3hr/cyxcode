import type { ServerConnection } from "@/context/server"

type Server = {
  current?: ServerConnection.Any | undefined
}

function auth(server: Server) {
  const cur = server.current?.http
  if (!cur?.password) return {}
  return {
    Authorization: `Basic ${btoa(`${cur.username ?? "opencode"}:${cur.password}`)}`,
  }
}

async function request<T>(server: Server, path: string, init: RequestInit = {}) {
  const cur = server.current?.http
  if (!cur?.url) throw new Error("No server connected")

  const head = new Headers(init.headers)
  head.set("Content-Type", "application/json")
  const authHeader = auth(server)
  if (authHeader.Authorization) head.set("Authorization", authHeader.Authorization)

  const res = await fetch(new URL(path, cur.url), {
    ...init,
    headers: head,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json as T
}

export type Report = {
  id: string
  type: "executive" | "technical" | "compliance"
  generatedAt: number
  summary?: unknown
  targets?: unknown[]
  assessment?: unknown
}

export type ReportRequest = {
  type: "executive" | "technical" | "compliance"
  framework?: "pci-dss" | "hipaa" | "soc2"
}

export type WatchEvent = {
  id: string
  ts: number
  kind: "file.read" | "file.write" | "shell.command" | "network.outbound" | "prompt.turn"
  path?: string
  host?: string
  cmd?: string
  prompt?: string
  risk: number
  flags: string[]
  decision?: "allow" | "warn" | "require-approval" | "block"
}

export type WatchAlert = {
  id: string
  ts: number
  kind: "policy_violation" | "sensitive_access" | "network_exfil" | "prompt_drift" | "repeated_sensitive"
  title: string
  summary: string
  risk: number
  flags: string[]
  decision: "allow" | "warn" | "require-approval" | "block"
  path?: string
  cmd?: string
  host?: string
  prompt?: string
}

export type WatchReport = {
  period: { name: "1h" | "1d" | "7d" | "30d" | "all"; start: string; end: string }
  total: number
  prompt: number
  shell: number
  read: number
  write: number
  network: number
  risky: number
  risk: number
  alerts: number
  decisions: { allow: number; warn: number; requireApproval: number; block: number }
  flags: Array<{ name: string; count: number }>
  top: Array<{ path: string; count: number }>
}

export const watchApi = {
  report: (server: Server, period = "7d") => request<{ report: WatchReport }>(server, `/cyxwatch/report?period=${period}`),
  recent: (server: Server, limit = 20) => request<{ events: WatchEvent[]; total: number }>(server, `/cyxwatch/recent?limit=${limit}`),
  alerts: (server: Server, limit = 20) => request<{ alerts: WatchAlert[]; total: number }>(server, `/cyxwatch/alerts?limit=${limit}`),
}

export const reportsApi = {
  generate: (server: Server, req: ReportRequest) =>
    request<{ report: Report }>(server, `/pentest/reports`, {
      method: "POST",
      body: JSON.stringify(req),
    }),
}
