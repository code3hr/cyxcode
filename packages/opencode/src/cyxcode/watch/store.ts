import { Database } from "bun:sqlite"
import fs from "fs"
import path from "path"
import { CyxPaths } from "../paths"
import type { WatchAlert, WatchEntry } from "../watch"

const dbs = new Map<string, Database>()

export type WatchQuery = {
  limit?: number
  sessionID?: string
  path?: string
  host?: string
  flag?: string
  decision?: WatchEntry["decision"]
  kind?: WatchEntry["kind"]
}

function file() {
  return path.join(CyxPaths.projectDir(), "cyxwatch", "events.db")
}

function db() {
  const p = file()
  const hit = dbs.get(p)
  if (hit) return hit
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const next = new Database(p, { create: true })
  safe(() => next.exec(process.platform === "win32" ? "PRAGMA journal_mode = MEMORY" : "PRAGMA journal_mode = WAL"), undefined)
  safe(() => next.exec("PRAGMA synchronous = NORMAL"), undefined)
  next.exec(`
    CREATE TABLE IF NOT EXISTS watch_event (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      kind TEXT NOT NULL,
      project TEXT,
      session_id TEXT,
      message_id TEXT,
      prompt TEXT,
      text TEXT,
      summary TEXT,
      path TEXT,
      host TEXT,
      method TEXT,
      cmd TEXT,
      bytes INTEGER,
      risk INTEGER NOT NULL,
      flags TEXT NOT NULL,
      decision TEXT
    );
    CREATE INDEX IF NOT EXISTS watch_event_ts_idx ON watch_event(ts);
    CREATE INDEX IF NOT EXISTS watch_event_kind_idx ON watch_event(kind);
    CREATE TABLE IF NOT EXISTS watch_alert (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      risk INTEGER NOT NULL,
      flags TEXT NOT NULL,
      decision TEXT NOT NULL,
      event_id TEXT NOT NULL,
      project TEXT,
      session_id TEXT,
      message_id TEXT,
      prompt TEXT,
      path TEXT,
      cmd TEXT,
      host TEXT
    );
    CREATE INDEX IF NOT EXISTS watch_alert_ts_idx ON watch_alert(ts);
  `)
  const cols = new Set(
    next
      .query("PRAGMA table_info(watch_event)")
      .all()
      .map((row) => String((row as { name: unknown }).name)),
  )
  if (!cols.has("summary")) next.exec("ALTER TABLE watch_event ADD COLUMN summary TEXT")
  dbs.set(p, next)
  return next
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

function flags(raw: unknown) {
  if (typeof raw !== "string") return []
  try {
    const out = JSON.parse(raw)
    return Array.isArray(out) ? out.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function event(row: Record<string, unknown>): WatchEntry {
  return {
    id: String(row.id),
    ts: Number(row.ts),
    kind: row.kind as WatchEntry["kind"],
    project: row.project ? String(row.project) : undefined,
    sessionID: row.session_id ? String(row.session_id) : undefined,
    messageID: row.message_id ? String(row.message_id) : undefined,
    prompt: row.prompt ? String(row.prompt) : undefined,
    text: row.text ? String(row.text) : undefined,
    summary: row.summary ? String(row.summary) : undefined,
    path: row.path ? String(row.path) : undefined,
    host: row.host ? String(row.host) : undefined,
    method: row.method ? String(row.method) : undefined,
    cmd: row.cmd ? String(row.cmd) : undefined,
    bytes: row.bytes === null || row.bytes === undefined ? undefined : Number(row.bytes),
    risk: Number(row.risk),
    flags: flags(row.flags),
    decision: row.decision ? (String(row.decision) as WatchEntry["decision"]) : undefined,
  }
}

function note(row: Record<string, unknown>): WatchAlert {
  return {
    id: String(row.id),
    ts: Number(row.ts),
    kind: row.kind as WatchAlert["kind"],
    title: String(row.title),
    summary: String(row.summary),
    risk: Number(row.risk),
    flags: flags(row.flags),
    decision: row.decision as WatchAlert["decision"],
    eventID: String(row.event_id),
    project: row.project ? String(row.project) : undefined,
    sessionID: row.session_id ? String(row.session_id) : undefined,
    messageID: row.message_id ? String(row.message_id) : undefined,
    prompt: row.prompt ? String(row.prompt) : undefined,
    path: row.path ? String(row.path) : undefined,
    cmd: row.cmd ? String(row.cmd) : undefined,
    host: row.host ? String(row.host) : undefined,
  }
}

export namespace WatchStore {
  export function insert(entry: WatchEntry) {
    safe(
      () =>
        db()
          .query(
            `INSERT OR REPLACE INTO watch_event
            (id, ts, kind, project, session_id, message_id, prompt, text, summary, path, host, method, cmd, bytes, risk, flags, decision)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            entry.id,
            entry.ts,
            entry.kind,
            entry.project ?? null,
            entry.sessionID ?? null,
            entry.messageID ?? null,
            entry.prompt ?? null,
            entry.text ?? null,
            entry.summary ?? null,
            entry.path ?? null,
            entry.host ?? null,
            entry.method ?? null,
            entry.cmd ?? null,
            entry.bytes ?? null,
            entry.risk,
            JSON.stringify(entry.flags),
            entry.decision ?? null,
          ),
      undefined,
    )
  }

  export function insertAlert(alert: WatchAlert) {
    safe(
      () =>
        db()
          .query(
            `INSERT OR REPLACE INTO watch_alert
            (id, ts, kind, title, summary, risk, flags, decision, event_id, project, session_id, message_id, prompt, path, cmd, host)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            alert.id,
            alert.ts,
            alert.kind,
            alert.title,
            alert.summary,
            alert.risk,
            JSON.stringify(alert.flags),
            alert.decision,
            alert.eventID,
            alert.project ?? null,
            alert.sessionID ?? null,
            alert.messageID ?? null,
            alert.prompt ?? null,
            alert.path ?? null,
            alert.cmd ?? null,
            alert.host ?? null,
          ),
      undefined,
    )
  }

  export function recent(limit: number) {
    return safe(
      () =>
        db()
          .query("SELECT * FROM watch_event ORDER BY ts DESC LIMIT ?")
          .all(limit)
          .map((row) => event(row as Record<string, unknown>))
          .reverse(),
      [],
    )
  }

  export function query(input: WatchQuery) {
    const where: string[] = []
    const args: Array<string | number> = []
    const add = (sql: string, value: string | number) => {
      where.push(sql)
      args.push(value)
    }

    if (input.sessionID) add("session_id = ?", input.sessionID)
    if (input.kind) add("kind = ?", input.kind)
    if (input.decision) add("decision = ?", input.decision)
    if (input.path) add("path LIKE ?", `%${input.path}%`)
    if (input.host) add("host LIKE ?", `%${input.host}%`)
    if (input.flag) add("flags LIKE ?", `%${JSON.stringify(input.flag)}%`)

    return safe(
      () =>
        db()
          .query(`SELECT * FROM watch_event${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY ts DESC LIMIT ?`)
          .all(...args, input.limit ?? 50)
          .map((row) => event(row as Record<string, unknown>))
          .reverse(),
      [],
    )
  }

  export function alerts(limit: number) {
    return safe(
      () =>
        db()
          .query("SELECT * FROM watch_alert ORDER BY ts DESC LIMIT ?")
          .all(limit)
          .map((row) => note(row as Record<string, unknown>))
          .reverse(),
      [],
    )
  }

  export function clear() {
    if (!fs.existsSync(file())) return
    db().run("DELETE FROM watch_alert")
    db().run("DELETE FROM watch_event")
  }

  export function close() {
    for (const item of dbs.values()) {
      item.close()
    }
    dbs.clear()
  }
}
