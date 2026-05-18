/**
 * @fileoverview CyxWatch runtime observability layer.
 *
 * Phase 1:
 * - record shell commands and file access
 * - persist local JSONL events
 * - provide a small CLI summary
 */

import fs from "fs/promises"
import path from "path"
import { Context } from "../util/context"
import { Log } from "../util/log"
import { CyxPaths } from "./paths"
import { Instance } from "../project/instance"

const log = Log.create({ service: "cyxwatch" })

type Scope = {
  sessionID?: string
  messageID?: string
  prompt?: string
}

export type WatchKind = "file.read" | "file.write" | "shell.command" | "network.outbound" | "prompt.turn"

export type WatchAlertKind =
  | "policy_violation"
  | "sensitive_access"
  | "network_exfil"
  | "prompt_drift"
  | "repeated_sensitive"

export type WatchAlert = {
  id: string
  ts: number
  kind: WatchAlertKind
  title: string
  summary: string
  risk: number
  flags: string[]
  decision: WatchDecision
  eventID: string
  project?: string
  sessionID?: string
  messageID?: string
  prompt?: string
  path?: string
  cmd?: string
  host?: string
}

export type WatchDecision = "allow" | "warn" | "require-approval" | "block"

export type WatchGuard = {
  decision: WatchDecision
  risk: number
  flags: string[]
  reason?: string
}

export type WatchEntry = {
  id: string
  ts: number
  kind: WatchKind
  project?: string
  sessionID?: string
  messageID?: string
  prompt?: string
  text?: string
  path?: string
  host?: string
  method?: string
  cmd?: string
  bytes?: number
  risk: number
  flags: string[]
  decision?: WatchDecision
}

export type WatchReport = {
  period: {
    name: "1h" | "1d" | "7d" | "30d" | "all"
    start: string
    end: string
  }
  total: number
  prompt: number
  shell: number
  read: number
  write: number
  network: number
  risky: number
  risk: number
  alerts: number
  decisions: {
    allow: number
    warn: number
    requireApproval: number
    block: number
  }
  flags: Array<{ name: string; count: number }>
  top: Array<{ path: string; count: number }>
}

const ctx = Context.create<Scope>("cyxwatch")

const g = globalThis as typeof globalThis & {
  __cyxwatch_entries?: WatchEntry[]
  __cyxwatch_alerts?: WatchAlert[]
}

if (!g.__cyxwatch_entries) g.__cyxwatch_entries = []
if (!g.__cyxwatch_alerts) g.__cyxwatch_alerts = []
const buf = g.__cyxwatch_entries
const alert = g.__cyxwatch_alerts

function now() {
  const ts = Date.now()
  const id = ts.toString(36) + Math.random().toString(36).slice(2, 8)
  return { ts, id: `watch_${id}` }
}

function data() {
  return path.join(CyxPaths.projectDir(), "cyxwatch")
}

function file() {
  return path.join(data(), "events.jsonl")
}

function alertFile() {
  return path.join(data(), "alerts.jsonl")
}

function current() {
  try {
    return ctx.use()
  } catch {
    return undefined
  }
}

function project() {
  try {
    return Instance.project.id
  } catch {
    return undefined
  }
}

function parse(raw: string): WatchEntry[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as WatchEntry]
      } catch {
        return []
      }
    })
}

function parseAlert(raw: string): WatchAlert[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as WatchAlert]
      } catch {
        return []
      }
    })
}

function sensitive(target?: string) {
  if (!target) return false
  const text = target.toLowerCase()
  return (
    text.includes("/.ssh/") ||
    text.includes("\\.ssh\\") ||
    text.includes("/.gnupg/") ||
    text.includes("\\.gnupg\\") ||
    text.includes("cookies") ||
    text.includes("login data") ||
    text.includes("keychain") ||
    text.includes("password")
  )
}

function score(input: { kind: WatchKind; path?: string; cmd?: string; bytes?: number }) {
  const flags: string[] = []
  let risk = 0

  if (input.path && sensitive(input.path)) {
    flags.push("sensitive_path")
    risk += 40
  }

  if (input.bytes && input.bytes > 5 * 1024 * 1024) {
    flags.push("large_payload")
    risk += 20
  }

  if (input.kind === "shell.command" && input.cmd) {
    const cmd = input.cmd.toLowerCase()
    if (cmd.includes("rm -rf") || cmd.includes("curl ") || cmd.includes("wget ") || cmd.includes("ssh ")) {
      flags.push("risky_shell")
      risk += 25
    }
  }

  return { risk, flags }
}

function decide(input: { kind: WatchKind; path?: string; cmd?: string; bytes?: number }, flags: string[], risk: number): WatchDecision {
  if (input.kind === "shell.command") {
    const cmd = input.cmd?.toLowerCase() ?? ""
    if (cmd.includes("rm -rf") || cmd.includes("del /s") || cmd.includes("format ")) return "block"
    if (flags.includes("risky_shell")) return "require-approval"
  }

  if (input.kind === "file.write" || input.kind === "file.read") {
    if (flags.includes("sensitive_path")) return "require-approval"
  }

  if (input.kind === "network.outbound") {
    if (input.bytes && input.bytes > 5 * 1024 * 1024) return "require-approval"
    if (risk > 0) return "warn"
  }

  if (input.kind === "prompt.turn") return "allow"
  return risk > 0 ? "warn" : "allow"
}

function privateHost(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true
    if (host === "metadata.google.internal" || host === "169.254.169.254") return true
    if (host.startsWith("10.")) return true
    if (host.startsWith("192.168.")) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true
    return false
  } catch {
    return false
  }
}

function alertTitle(kind: WatchAlertKind) {
  if (kind === "policy_violation") return "Policy violation"
  if (kind === "sensitive_access") return "Sensitive access"
  if (kind === "network_exfil") return "Network exfiltration risk"
  if (kind === "prompt_drift") return "Prompt drift"
  return "Repeated sensitive access"
}

function alertSummary(kind: WatchAlertKind, entry: WatchEntry) {
  if (kind === "policy_violation") return `Policy decision ${entry.decision ?? "warn"} on ${entry.kind}`
  if (kind === "sensitive_access") return entry.path ?? entry.cmd ?? "Sensitive target"
  if (kind === "network_exfil") return entry.host ?? entry.path ?? "Outbound request"
  if (kind === "prompt_drift") return "Multiple risky actions occurred within the same prompt turn"
  return entry.path ?? "Repeated sensitive path access"
}

function alertKey(entry: WatchEntry, kind: WatchAlertKind) {
  return `${entry.sessionID ?? ""}:${entry.messageID ?? ""}:${kind}:${entry.path ?? entry.cmd ?? entry.host ?? ""}`
}

function detect(entry: WatchEntry, list: WatchEntry[]) {
  const out: Array<Omit<WatchAlert, "id" | "ts" | "project" | "sessionID" | "messageID" | "prompt">> = []
  const add = (kind: WatchAlertKind, risk: number, flags: string[]) => {
    out.push({
      kind,
      title: alertTitle(kind),
      summary: alertSummary(kind, entry),
      risk,
      flags,
      decision: entry.decision ?? "warn",
      eventID: entry.id,
      path: entry.path,
      cmd: entry.cmd,
      host: entry.host,
    })
  }

  if (entry.decision === "block" || entry.decision === "require-approval") {
    add("policy_violation", Math.max(entry.risk, 20), [...entry.flags])
  }

  if (entry.flags.includes("sensitive_path")) {
    add("sensitive_access", Math.max(entry.risk, 40), [...entry.flags])
  }

  if (entry.kind === "network.outbound") {
    const privateNet = entry.host ? privateHost(entry.host) : false
    if ((entry.bytes ?? 0) > 5 * 1024 * 1024 || privateNet) {
      add("network_exfil", Math.max(entry.risk, 30), [...entry.flags, privateNet ? "private_network" : "large_payload"])
    }
  }

  const same = list.filter((row) => row.sessionID && row.sessionID === entry.sessionID && row.messageID && row.messageID === entry.messageID)
  const risky = same.filter((row) => row.risk > 0)
  const kinds = new Set(risky.map((row) => row.kind))
  const first = same[0]
  if (entry.sessionID && entry.messageID && risky.length >= 3 && kinds.size >= 2 && first && entry.ts - first.ts <= 10 * 60 * 1000) {
    add("prompt_drift", Math.max(entry.risk, 25), ["prompt_mismatch", "multi_action"])
  }

  const recent = list.filter((row) => row.path && row.path === entry.path && row.flags.includes("sensitive_path"))
  if (entry.path && entry.flags.includes("sensitive_path") && recent.length >= 2) {
    add("repeated_sensitive", Math.max(entry.risk, 35), [...entry.flags])
  }

  return out.filter((row, i, all) => i === all.findIndex((next) => alertKey(entry, row.kind) === alertKey(entry, next.kind)))
}

function guard(input: { permission: string; patterns: string[]; metadata?: Record<string, unknown> }): WatchGuard {
  const meta = input.metadata ?? {}
  const pick = (key: string) => {
    const value = meta[key]
    return typeof value === "string" ? value : undefined
  }

  if (input.permission === "bash") {
    const cmd = pick("command") ?? input.patterns[0]
    const out = score({ kind: "shell.command", cmd })
    const decision = decide({ kind: "shell.command", cmd }, out.flags, out.risk)
    return {
      decision,
      risk: out.risk,
      flags: out.flags,
      reason: decision === "block" ? "destructive shell command" : out.flags.includes("risky_shell") ? "risky shell command" : undefined,
    }
  }

  if (input.permission === "edit" || input.permission === "write") {
    const file = pick("filepath") ?? input.patterns[0]
    const out = score({ kind: "file.write", path: file })
    const decision = decide({ kind: "file.write", path: file }, out.flags, out.risk)
    return {
      decision,
      risk: out.risk,
      flags: out.flags,
      reason: out.flags.includes("sensitive_path") ? "sensitive file path" : undefined,
    }
  }

  if (input.permission === "webfetch") {
    const url = pick("url") ?? input.patterns[0]
    const bytes = typeof meta.bytes === "number" ? meta.bytes : undefined
    const out = score({ kind: "network.outbound", bytes })
    const privateNet = url ? privateHost(url) : false
    if (privateNet) {
      return {
        decision: "require-approval",
        risk: Math.max(out.risk, 20),
        flags: [...out.flags, "private_network"],
        reason: "private or local network target",
      }
    }
    const decision = decide({ kind: "network.outbound", bytes }, out.flags, out.risk)
    return {
      decision,
      risk: out.risk,
      flags: out.flags,
      reason: out.flags.length > 0 ? out.flags[0] : undefined,
    }
  }

  if (input.permission === "websearch" || input.permission === "codesearch" || input.permission === "external_directory") {
    const decision: WatchDecision = "require-approval"
    return {
      decision,
      risk: 10,
      flags: ["external_access"],
      reason: input.permission,
    }
  }

  const out = score({ kind: "prompt.turn" })
  return {
    decision: "allow",
    risk: out.risk,
    flags: out.flags,
  }
}

async function persist(entry: WatchEntry) {
  buf.push(entry)
  if (buf.length > 1000) buf.shift()

  await fs.mkdir(data(), { recursive: true })
  await fs.appendFile(file(), `${JSON.stringify(entry)}\n`)

  for (const row of detect(entry, buf)) {
    const { ts, id } = now()
    const next: WatchAlert = {
      id,
      ts,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      risk: row.risk,
      flags: row.flags,
      decision: row.decision,
      eventID: row.eventID,
      project: entry.project,
      sessionID: entry.sessionID,
      messageID: entry.messageID,
      prompt: entry.prompt,
      path: entry.path,
      cmd: entry.cmd,
      host: entry.host,
    }
    alert.push(next)
    if (alert.length > 1000) alert.shift()
    await fs.appendFile(alertFile(), `${JSON.stringify(next)}\n`)
    log.warn("watch alert", {
      kind: next.kind,
      risk: next.risk,
      title: next.title,
      path: next.path,
      host: next.host,
    })
  }

  log.debug("watch event", {
    kind: entry.kind,
    risk: entry.risk,
    path: entry.path,
    cmd: entry.cmd,
  })

  return entry
}

function period(raw: WatchReport["period"]["name"]) {
  const now = Date.now()
  switch (raw) {
    case "1h":
      return now - 60 * 60 * 1000
    case "1d":
      return now - 24 * 60 * 60 * 1000
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000
    case "all":
      return 0
  }
}

function item<T>(entries: T[], q: (entry: T) => string | undefined) {
  const map = new Map<string, number>()
  for (const entry of entries) {
    const key = q(entry)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

async function read() {
  const list = [...buf]
  const raw = await fs.readFile(file(), "utf-8").catch(() => "")
  if (!raw) return list
  return parse(raw)
}

async function readAlert() {
  const list = [...alert]
  const raw = await fs.readFile(alertFile(), "utf-8").catch(() => "")
  if (!raw) return list
  return parseAlert(raw)
}

export namespace CyxWatch {
  export function clear() {
    buf.length = 0
    alert.length = 0
  }

  export function set(input: Partial<Scope>) {
    const scope = current()
    if (!scope) return
    if (input.sessionID !== undefined) scope.sessionID = input.sessionID
    if (input.messageID !== undefined) scope.messageID = input.messageID
    if (input.prompt !== undefined) scope.prompt = input.prompt
  }

  export async function scope<T>(input: Scope & { fn: () => Promise<T> }) {
    return await ctx.provide(
      {
        sessionID: input.sessionID,
        messageID: input.messageID,
        prompt: input.prompt,
      },
      input.fn,
    )
  }

  export async function note(input: { kind: WatchKind; path?: string; cmd?: string; bytes?: number }) {
    const scope = current()
    const proj = project()
    const { ts, id } = now()
    const out = score(input)
    const decision = decide(input, out.flags, out.risk)
    return await persist({
      id,
      ts,
      kind: input.kind,
      project: proj,
      sessionID: scope?.sessionID,
      messageID: scope?.messageID,
      prompt: scope?.prompt,
      path: input.path,
      cmd: input.cmd,
      bytes: input.bytes,
      risk: out.risk,
      flags: out.flags,
      decision,
    })
  }

  export async function turn(input: { text: string; sessionID?: string; messageID?: string }) {
    const { ts, id } = now()
    return await persist({
      id,
      ts,
      kind: "prompt.turn",
      project: project(),
      sessionID: input.sessionID ?? current()?.sessionID,
      messageID: input.messageID ?? current()?.messageID,
      prompt: input.text,
      text: input.text,
      risk: 0,
      flags: [],
      decision: "allow",
    })
  }

  export async function request(input: { url: string; method?: string; bytes?: number; sessionID?: string; messageID?: string }) {
    const out = score({
      kind: "network.outbound",
      bytes: input.bytes,
    })
    const decision = decide(
      {
        kind: "network.outbound",
        bytes: input.bytes,
      },
      out.flags,
      out.risk,
    )
    const { ts, id } = now()
    return await persist({
      id,
      ts,
      kind: "network.outbound",
      project: project(),
      sessionID: input.sessionID ?? current()?.sessionID,
      messageID: input.messageID ?? current()?.messageID,
      prompt: current()?.prompt,
      path: input.url,
      host: (() => {
        try {
          return new URL(input.url).host
        } catch {
          return input.url
        }
      })(),
      method: input.method ?? "GET",
      bytes: input.bytes,
      risk: out.risk,
      flags: out.flags,
      decision,
    })
  }

  export function classify(input: { permission: string; patterns: string[]; metadata?: Record<string, unknown> }): WatchGuard {
    return guard(input)
  }

  export async function recent(limit = 50) {
    const list = await read()
    return list.slice(-limit)
  }

  export async function alerts(limit = 50) {
    const list = await readAlert()
    return list.slice(-limit)
  }

  export async function report(periodName: WatchReport["period"]["name"] = "7d"): Promise<WatchReport> {
    const list = await read()
    const start = period(periodName)
    const end = Date.now()
    const rows = list.filter((entry) => entry.ts >= start)
    const notes = await readAlert()
    const marks = notes.filter((entry) => entry.ts >= start)
    const prompt = rows.filter((entry) => entry.kind === "prompt.turn").length
    const shell = rows.filter((entry) => entry.kind === "shell.command").length
    const readCount = rows.filter((entry) => entry.kind === "file.read").length
    const write = rows.filter((entry) => entry.kind === "file.write").length
    const network = rows.filter((entry) => entry.kind === "network.outbound").length
    const risky = rows.filter((entry) => entry.risk > 0).length
    const risk = rows.reduce((sum, entry) => sum + entry.risk, 0)
    const decisions = {
      allow: rows.filter((entry) => entry.decision === "allow").length,
      warn: rows.filter((entry) => entry.decision === "warn").length,
      requireApproval: rows.filter((entry) => entry.decision === "require-approval").length,
      block: rows.filter((entry) => entry.decision === "block").length,
    }
    const flags = item(rows.flatMap((entry) => entry.flags), (flag) => flag)
    const top = item(rows, (entry) => entry.path)
      .map((row) => ({ path: row.name, count: row.count }))
      .slice(0, 10)

    return {
      period: {
        name: periodName,
        start: new Date(periodName === "all" ? 0 : start).toISOString(),
        end: new Date(end).toISOString(),
      },
      total: rows.length,
      prompt,
      shell,
      read: readCount,
      write,
      network,
      risky,
      risk,
      alerts: marks.length,
      decisions,
      flags,
      top,
    }
  }

  export function formatText(report: WatchReport) {
    const lines: string[] = []
    lines.push(`CyxWatch Report: ${report.period.name}`)
    lines.push(`Period: ${report.period.start.slice(0, 10)} to ${report.period.end.slice(0, 10)}`)
    lines.push("")
    lines.push("ACTIVITY")
    lines.push(`  Events: ${report.total}`)
    lines.push(`  Prompts: ${report.prompt}`)
    lines.push(`  Shell:  ${report.shell}`)
    lines.push(`  Reads:  ${report.read}`)
    lines.push(`  Writes: ${report.write}`)
    lines.push(`  Network: ${report.network}`)
    lines.push("")
    lines.push("RISK")
    lines.push(`  Risky events: ${report.risky}`)
    lines.push(`  Risk score:   ${report.risk}`)
    lines.push(`  Alerts:       ${report.alerts}`)
    lines.push(`  Allow:        ${report.decisions.allow}`)
    lines.push(`  Warn:         ${report.decisions.warn}`)
    lines.push(`  Require:      ${report.decisions.requireApproval}`)
    lines.push(`  Block:        ${report.decisions.block}`)
    if (report.flags.length > 0) {
      lines.push("  Flags:")
      for (const flag of report.flags.slice(0, 5)) {
        lines.push(`    - ${flag.name}: ${flag.count}`)
      }
    }
    if (report.top.length > 0) {
      lines.push("")
      lines.push("TOP PATHS")
      for (const row of report.top.slice(0, 5)) {
        lines.push(`  - ${row.path}: ${row.count}`)
      }
    }
    return lines.join("\n")
  }
}
