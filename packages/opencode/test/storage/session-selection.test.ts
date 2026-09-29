import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { readdir } from "node:fs/promises"
import path from "node:path"

test("selection migration preserves existing sessions and adds nullable fields", async () => {
  const dir = path.join(import.meta.dir, "../../migration")
  const entries = (await readdir(dir)).sort()
  const index = entries.findIndex((entry) => entry.endsWith("_session_selection"))
  expect(index).toBeGreaterThan(0)
  using db = new Database(":memory:")
  for (const entry of entries.slice(0, index)) {
    const file = Bun.file(path.join(dir, entry, "migration.sql"))
    if (await file.exists()) db.exec(await file.text())
  }
  db.exec(
    "INSERT INTO project (id, worktree, time_created, time_updated, sandboxes) VALUES ('project', '/project', 1, 1, '[]')",
  )
  db.exec(
    "INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated) VALUES ('session', 'project', 'slug', '/project', 'Saved session', 'old', 1, 1)",
  )
  db.exec(await Bun.file(path.join(dir, entries[index], "migration.sql")).text())
  expect(db.query("SELECT title, agent, model FROM session WHERE id = 'session'").get()).toEqual({
    title: "Saved session",
    agent: null,
    model: null,
  })
  expect(db.query("PRAGMA foreign_key_check").all()).toEqual([])
})
