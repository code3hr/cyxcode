import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packsDir = path.join(__dirname, "../../src/cyxcode/community-packs")

// Inline validation to avoid import issues
function isValidPack(data: any): boolean {
  return (
    data &&
    typeof data.name === "string" &&
    typeof data.version === "string" &&
    Array.isArray(data.patterns) &&
    data.patterns.every(
      (p: any) =>
        typeof p.id === "string" &&
        typeof p.regex === "string" &&
        typeof p.description === "string" &&
        Array.isArray(p.fixes)
    )
  )
}

async function loadPack(name: string): Promise<any> {
  const content = await fs.readFile(path.join(packsDir, `${name}.json`), "utf-8")
  return JSON.parse(content)
}

const packNames = ["bun", "rust", "go", "ruby"]

describe("Community Pattern Packs", () => {
  test("all packs exist", async () => {
    for (const name of packNames) {
      const packPath = path.join(packsDir, `${name}.json`)
      const exists = await fs.access(packPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    }
  })

  test("all packs are valid JSON with required fields", async () => {
    for (const name of packNames) {
      const pack = await loadPack(name)
      expect(isValidPack(pack)).toBe(true)
      expect(pack.name).toContain(name)
      expect(pack.version).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })

  test("all regex patterns compile", async () => {
    for (const name of packNames) {
      const pack = await loadPack(name)
      for (const p of pack.patterns) {
        expect(() => new RegExp(p.regex, "i")).not.toThrow()
      }
    }
  })

  test("pattern IDs are unique within each pack", async () => {
    for (const name of packNames) {
      const pack = await loadPack(name)
      const ids = pack.patterns.map((p: any) => p.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  test("each pattern has at least one fix", async () => {
    for (const name of packNames) {
      const pack = await loadPack(name)
      for (const p of pack.patterns) {
        expect(p.fixes.length).toBeGreaterThan(0)
      }
    }
  })

  test("each fix has required fields", async () => {
    for (const name of packNames) {
      const pack = await loadPack(name)
      for (const p of pack.patterns) {
        for (const fix of p.fixes) {
          expect(typeof fix.id).toBe("string")
          expect(typeof fix.description).toBe("string")
          expect(typeof fix.priority).toBe("number")
          // Either command or instructions must be present
          expect(fix.command || fix.instructions).toBeTruthy()
        }
      }
    }
  })

  test("pattern categories match pack name", async () => {
    for (const name of packNames) {
      const pack = await loadPack(name)
      for (const p of pack.patterns) {
        // Category should contain the language name
        expect(p.category.toLowerCase()).toContain(name)
      }
    }
  })
})

describe("Bun Pack Patterns", () => {
  test("matches bun package not found error", async () => {
    const pack = await loadPack("bun")
    const pattern = pack.patterns.find((p: any) => p.id === "bun-pkg-not-found")
    expect(pattern).toBeDefined()

    const regex = new RegExp(pattern.regex, "i")
    expect(regex.test('error: package "lodash" not found')).toBe(true)
  })

  test("matches bun module resolution error", async () => {
    const pack = await loadPack("bun")
    const pattern = pack.patterns.find((p: any) => p.id === "bun-module-not-found")
    expect(pattern).toBeDefined()

    const regex = new RegExp(pattern.regex, "i")
    expect(regex.test("Cannot find module 'express'")).toBe(true)
  })
})

describe("Rust Pack Patterns", () => {
  test("matches rust borrow checker error", async () => {
    const pack = await loadPack("rust")
    const pattern = pack.patterns.find((p: any) => p.id === "rust-borrow-moved")
    expect(pattern).toBeDefined()

    const regex = new RegExp(pattern.regex, "i")
    expect(regex.test("error[E0382]: use of moved value: `x`")).toBe(true)
  })

  test("matches rust lifetime error", async () => {
    const pack = await loadPack("rust")
    const pattern = pack.patterns.find((p: any) => p.id === "rust-lifetime-missing")
    expect(pattern).toBeDefined()

    const regex = new RegExp(pattern.regex, "i")
    expect(regex.test("error[E0106]: missing lifetime specifier")).toBe(true)
  })
})

describe("Go Pack Patterns", () => {
  test("matches go module not found error", async () => {
    const pack = await loadPack("go")
    const pattern = pack.patterns.find((p: any) => p.id === "go-mod-not-found")
    expect(pattern).toBeDefined()

    const regex = new RegExp(pattern.regex, "i")
    expect(regex.test("go: module github.com/example/pkg not found")).toBe(true)
  })

  test("matches go import cycle error", async () => {
    const pack = await loadPack("go")
    const pattern = pack.patterns.find((p: any) => p.id === "go-import-cycle")
    expect(pattern).toBeDefined()

    const regex = new RegExp(pattern.regex, "i")
    expect(regex.test("import cycle not allowed")).toBe(true)
  })
})

describe("Ruby Pack Patterns", () => {
  test("matches ruby load error", async () => {
    const pack = await loadPack("ruby")
    const pattern = pack.patterns.find((p: any) => p.id === "ruby-load-file")
    expect(pattern).toBeDefined()

    const regex = new RegExp(pattern.regex, "i")
    expect(regex.test("cannot load such file -- json")).toBe(true)
  })

  test("matches rails migration error", async () => {
    const pack = await loadPack("ruby")
    const pattern = pack.patterns.find((p: any) => p.id === "ruby-rails-migration-pending")
    expect(pattern).toBeDefined()

    const regex = new RegExp(pattern.regex, "i")
    expect(regex.test("Migrations are pending")).toBe(true)
  })
})

describe("Index Module", () => {
  test("exports builtin pack paths", async () => {
    const indexPath = path.join(packsDir, "index.ts")
    const exists = await fs.access(indexPath).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  })
})
