import { db } from "./db"
import type { Fact, Triple, RecordFactOpts, FactsAboutOpts } from "./types"

function newId(): string {
  return `fact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function parseMeta(text: string | null | undefined): Record<string, unknown> {
  if (!text) return {}
  try {
    const v = JSON.parse(text)
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

type Row = {
  id: string
  subject: string
  predicate: string
  object: string
  valid_from: number
  valid_until: number | null
  source_event: string | null
  meta: string
}

function rowToFact(r: Row): Fact {
  return {
    id: r.id,
    subject: r.subject,
    predicate: r.predicate,
    object: r.object,
    validFrom: r.valid_from,
    validUntil: r.valid_until,
    sourceEvent: r.source_event,
    meta: parseMeta(r.meta),
  }
}

export function recordFact(triple: Triple, opts: RecordFactOpts = {}): Fact {
  const now = Date.now()
  const validFrom = opts.validFrom ?? now
  const validUntil = opts.validUntil ?? null
  const meta = JSON.stringify(opts.meta ?? {})
  const sourceEvent = opts.sourceEvent ?? null

  const d = db()

  // Close any currently-valid row matching (s, p, o) when we insert a newer one
  d.prepare(
    `UPDATE facts
        SET valid_until = ?
      WHERE subject = ? AND predicate = ? AND object = ?
        AND valid_until IS NULL
        AND valid_from < ?`,
  ).run(validFrom, triple.subject, triple.predicate, triple.object, validFrom)

  const id = newId()
  d.prepare(
    `INSERT INTO facts (id, subject, predicate, object, valid_from, valid_until, source_event, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, triple.subject, triple.predicate, triple.object, validFrom, validUntil, sourceEvent, meta)

  return {
    id,
    subject: triple.subject,
    predicate: triple.predicate,
    object: triple.object,
    validFrom,
    validUntil,
    sourceEvent,
    meta: opts.meta ?? {},
  }
}

export function factsAbout(subject: string, opts: FactsAboutOpts = {}): Fact[] {
  const at = opts.at ?? Date.now()
  const d = db()

  const rows = (
    opts.predicate
      ? d
          .prepare(
            `SELECT id, subject, predicate, object, valid_from, valid_until, source_event, meta
               FROM facts
              WHERE subject = ? AND predicate = ?
                AND valid_from <= ?
                AND (valid_until IS NULL OR valid_until > ?)
              ORDER BY valid_from DESC`,
          )
          .all(subject, opts.predicate, at, at)
      : d
          .prepare(
            `SELECT id, subject, predicate, object, valid_from, valid_until, source_event, meta
               FROM facts
              WHERE subject = ?
                AND valid_from <= ?
                AND (valid_until IS NULL OR valid_until > ?)
              ORDER BY valid_from DESC`,
          )
          .all(subject, at, at)
  ) as Row[]

  return rows.map(rowToFact)
}

export function factsCount(): number {
  const row = db().prepare("SELECT count(*) as c FROM facts").get() as { c: number } | undefined
  return row?.c ?? 0
}
