import fs from "fs"
import path from "path"
import { Database } from "bun:sqlite"
import { Log } from "@/util/log"
import { recallDbPath } from "./paths"
import { PRAGMAS, SCHEMA_SQL } from "./schema.sql"
import { RecallError } from "./errors"
import { RECALL_DIM, RECALL_MODEL, type VectorRow, type VectorSource } from "./types"

const log = Log.create({ service: "cyxcode-recall-db" })

const g = globalThis as any
if (!g.__cyxcode_recall_db) g.__cyxcode_recall_db = { ref: null as Database | null, overridePath: null as string | null }
const state: { ref: Database | null; overridePath: string | null } = g.__cyxcode_recall_db

export function setDbPathOverride(p: string | null) {
  if (state.ref) {
    try { state.ref.close() } catch {}
    state.ref = null
  }
  state.overridePath = p
}

function applyPragmasAndSchema(d: Database): void {
  for (const p of PRAGMAS) d.run(p)
  d.exec(SCHEMA_SQL)
}

export function db(): Database {
  if (state.ref) return state.ref
  const p = state.overridePath ?? recallDbPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  let d: Database
  try {
    d = new Database(p, { create: true })
  } catch (e) {
    throw new RecallError("db-open-failed", { cause: e })
  }
  applyPragmasAndSchema(d)

  try {
    const row = d.prepare("PRAGMA integrity_check").get() as { integrity_check?: string } | undefined
    const ok = row && (row.integrity_check === "ok" || (Object.values(row)[0] as string) === "ok")
    if (!ok) {
      log.warn("recall: db integrity check failed, rebuilding", { row })
      d.close()
      try { fs.unlinkSync(p) } catch {}
      d = new Database(p, { create: true })
      applyPragmasAndSchema(d)
    }
  } catch (e) {
    log.warn("recall: integrity check errored, continuing", { error: e })
  }

  state.ref = d
  return d
}

export function close() {
  if (!state.ref) return
  try { state.ref.close() } catch {}
  state.ref = null
}

export function toBlob(v: Float32Array): Uint8Array {
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
}

export function fromBlob(buf: Uint8Array, dim: number): Float32Array {
  const copy = new ArrayBuffer(buf.byteLength)
  new Uint8Array(copy).set(buf)
  return new Float32Array(copy, 0, dim)
}

export function readMeta(key: string): string | null {
  const row = db().prepare("SELECT value FROM meta_kv WHERE key = ?").get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function writeMeta(key: string, value: string): void {
  db().prepare("INSERT INTO meta_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value)
}

export function getWatermark(source: string): number {
  const row = db().prepare("SELECT last_indexed_at FROM source_watermarks WHERE source = ?").get(source) as
    | { last_indexed_at: number }
    | undefined
  return row?.last_indexed_at ?? 0
}

export function bumpWatermark(source: string, at: number, lastSourceId?: string): void {
  db()
    .prepare(
      `INSERT INTO source_watermarks (source, last_indexed_at, last_source_id)
       VALUES (?, ?, ?)
       ON CONFLICT(source) DO UPDATE SET last_indexed_at = excluded.last_indexed_at, last_source_id = excluded.last_source_id`,
    )
    .run(source, at, lastSourceId ?? null)
}

export type UpsertVectorInput = {
  source: VectorSource
  sourceId: string
  text: string
  embedding: Float32Array
  meta?: Record<string, unknown>
  createdAt?: number
}

function newVectorId(source: string, sourceId: string): string {
  return `vec_${source}_${sourceId}`
}

export function upsertVector(input: UpsertVectorInput): string {
  const now = Date.now()
  const id = newVectorId(input.source, input.sourceId)
  const meta = JSON.stringify(input.meta ?? {})
  const createdAt = input.createdAt ?? now
  db()
    .prepare(
      `INSERT INTO vectors (id, source, source_id, text, embedding, dim, model, created_at, accessed_at, access_count, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(source, source_id) DO UPDATE SET
         text        = excluded.text,
         embedding   = excluded.embedding,
         dim         = excluded.dim,
         model       = excluded.model,
         accessed_at = excluded.accessed_at,
         meta        = excluded.meta`,
    )
    .run(id, input.source, input.sourceId, input.text, toBlob(input.embedding), RECALL_DIM, RECALL_MODEL, createdAt, now, meta)
  return id
}

export function bumpAccessBySourceId(source: string, sourceId: string): void {
  const now = Date.now()
  db()
    .prepare(`UPDATE vectors SET accessed_at = ?, access_count = access_count + 1 WHERE source = ? AND source_id = ?`)
    .run(now, source, sourceId)
}

type VectorRawRow = {
  id: string
  source: string
  source_id: string
  text: string
  embedding: Uint8Array
  dim: number
  model: string
  created_at: number
  accessed_at: number
  access_count: number
  meta: string
}

function parseMeta(text: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text)
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function rowToVector(r: VectorRawRow): VectorRow {
  return {
    id: r.id,
    source: r.source as VectorSource,
    sourceId: r.source_id,
    text: r.text,
    embedding: fromBlob(r.embedding, r.dim),
    dim: r.dim,
    model: r.model,
    createdAt: r.created_at,
    accessedAt: r.accessed_at,
    accessCount: r.access_count,
    meta: parseMeta(r.meta),
  }
}

// TODO(sqlite-vec): this is a full table scan. Migrate to sqlite-vec extension
// when stats().vectors exceeds ~20k rows OR p95 similar() latency exceeds 80ms.
export function selectVectors(sources?: string[]): VectorRow[] {
  const d = db()
  let rows: VectorRawRow[]
  if (!sources || sources.length === 0) {
    rows = d
      .prepare(
        `SELECT id, source, source_id, text, embedding, dim, model, created_at, accessed_at, access_count, meta
           FROM vectors`,
      )
      .all() as VectorRawRow[]
  } else {
    const placeholders = sources.map(() => "?").join(",")
    rows = d
      .prepare(
        `SELECT id, source, source_id, text, embedding, dim, model, created_at, accessed_at, access_count, meta
           FROM vectors
          WHERE source IN (${placeholders})`,
      )
      .all(...sources) as VectorRawRow[]
  }
  return rows.map(rowToVector)
}

export function vectorCount(): number {
  const row = db().prepare("SELECT count(*) as c FROM vectors").get() as { c: number } | undefined
  return row?.c ?? 0
}

export function wipeVectors(): void {
  db().exec("DELETE FROM vectors; DELETE FROM source_watermarks;")
}
