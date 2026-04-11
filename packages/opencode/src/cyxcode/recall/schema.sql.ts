export const SCHEMA_VERSION = 1

export const PRAGMAS = [
  "PRAGMA journal_mode = WAL",
  "PRAGMA synchronous = NORMAL",
  "PRAGMA foreign_keys = ON",
  "PRAGMA busy_timeout = 5000",
]

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta_kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vectors (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  text         TEXT NOT NULL,
  embedding    BLOB NOT NULL,
  dim          INTEGER NOT NULL,
  model        TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  accessed_at  INTEGER NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  meta         TEXT NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vectors_pair    ON vectors(source, source_id);
CREATE        INDEX IF NOT EXISTS idx_vectors_source  ON vectors(source);
CREATE        INDEX IF NOT EXISTS idx_vectors_created ON vectors(created_at);

CREATE TABLE IF NOT EXISTS facts (
  id           TEXT PRIMARY KEY,
  subject      TEXT NOT NULL,
  predicate    TEXT NOT NULL,
  object       TEXT NOT NULL,
  valid_from   INTEGER NOT NULL,
  valid_until  INTEGER,
  source_event TEXT,
  meta         TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_facts_spo      ON facts(subject, predicate, object);
CREATE INDEX IF NOT EXISTS idx_facts_subject  ON facts(subject);
CREATE INDEX IF NOT EXISTS idx_facts_temporal ON facts(valid_from, valid_until);

CREATE TABLE IF NOT EXISTS source_watermarks (
  source          TEXT PRIMARY KEY,
  last_indexed_at INTEGER NOT NULL,
  last_source_id  TEXT
);
`
