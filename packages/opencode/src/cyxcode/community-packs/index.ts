/**
 * Bundled Community Pattern Packs
 *
 * These are the built-in community packs that ship with CyxCode.
 * They are auto-installed to ~/.cyxcode/community/ on first use.
 */

import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const builtinPacks = {
  bun: path.join(__dirname, "bun.json"),
  rust: path.join(__dirname, "rust.json"),
  go: path.join(__dirname, "go.json"),
  ruby: path.join(__dirname, "ruby.json"),
} as const

export type BuiltinPackName = keyof typeof builtinPacks

export function allBuiltinPaths(): string[] {
  return Object.values(builtinPacks)
}

export function getBuiltinPath(name: BuiltinPackName): string {
  return builtinPacks[name]
}
