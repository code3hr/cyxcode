import { describe, test, expect, beforeEach, afterAll } from "bun:test"
import path from "path"
import fs from "fs"
import os from "os"
import { close, setDbPathOverride } from "../../../src/cyxcode/recall/db"
import { recordFact, factsAbout } from "../../../src/cyxcode/recall/facts"

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cyxrecall-"))
const dbPath = path.join(tmpRoot, "recall.db")

beforeEach(() => {
  close()
  try { fs.unlinkSync(dbPath) } catch {}
  setDbPathOverride(dbPath)
})

afterAll(() => {
  close()
  setDbPathOverride(null)
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch {}
})

describe("recall/facts", () => {
  test("recordFact then factsAbout roundtrips the triple", () => {
    const fact = recordFact({ subject: "pnpm", predicate: "failed_on", object: "node@18.0.0" })
    expect(fact.subject).toBe("pnpm")
    expect(fact.predicate).toBe("failed_on")
    expect(fact.object).toBe("node@18.0.0")
    expect(fact.validUntil).toBeNull()

    const found = factsAbout("pnpm")
    expect(found).toHaveLength(1)
    expect(found[0].id).toBe(fact.id)
  })

  test("re-inserting (s,p,o) with a newer validFrom closes the prior row", () => {
    const first = recordFact(
      { subject: "pnpm", predicate: "failed_on", object: "node@18" },
      { validFrom: 1_700_000_000_000 },
    )
    recordFact(
      { subject: "pnpm", predicate: "failed_on", object: "node@18" },
      { validFrom: 1_700_000_100_000 },
    )

    const currentNow = factsAbout("pnpm", { at: 1_700_000_200_000 })
    expect(currentNow).toHaveLength(1)
    expect(currentNow[0].id).not.toBe(first.id)

    // In the window where only the first fact was valid, we still see it.
    const pastWindow = factsAbout("pnpm", { at: 1_700_000_050_000 })
    expect(pastWindow).toHaveLength(1)
    expect(pastWindow[0].id).toBe(first.id)
  })

  test("factsAbout filters by predicate", () => {
    recordFact({ subject: "kai", predicate: "works_on", object: "orion" })
    recordFact({ subject: "kai", predicate: "recommended", object: "clerk" })
    const worksOn = factsAbout("kai", { predicate: "works_on" })
    expect(worksOn).toHaveLength(1)
    expect(worksOn[0].object).toBe("orion")
  })

  test("factsAbout at a timestamp before validFrom returns nothing", () => {
    recordFact({ subject: "x", predicate: "y", object: "z" }, { validFrom: 2_000_000_000_000 })
    const found = factsAbout("x", { at: 1_999_999_999_999 })
    expect(found).toHaveLength(0)
  })

  test("factsAbout respects explicit validUntil", () => {
    recordFact(
      { subject: "x", predicate: "y", object: "z" },
      { validFrom: 1_700_000_000_000, validUntil: 1_700_000_500_000 },
    )
    expect(factsAbout("x", { at: 1_700_000_400_000 })).toHaveLength(1)
    expect(factsAbout("x", { at: 1_700_000_600_000 })).toHaveLength(0)
  })
})
