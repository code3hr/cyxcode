#!/usr/bin/env bun

import path from "path"
import { VulnScanGate } from "../src/pentest/vulnscan/gate"
import { VulnScanTypes } from "../src/pentest/vulnscan/types"

const args = process.argv.slice(2)

function arg(name: string) {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return undefined
  return args[idx + 1]
}

function has(name: string) {
  return args.includes(`--${name}`)
}

function num(name: string) {
  const value = arg(name)
  if (!value) return undefined
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return parsed
  return undefined
}

function severity(name: string, fallback: VulnScanTypes.Severity) {
  const value = arg(name)
  if (!value) return fallback
  const parsed = VulnScanTypes.Severity.safeParse(value)
  if (parsed.success) return parsed.data
  console.error(`Invalid --${name}: ${value}`)
  usage()
  process.exit(1)
}

function usage() {
  console.error(
    [
      "Usage:",
      "  bun run script/vulnscan-gate.ts --root .",
      "",
      "Options:",
      "  --root <path>              default: current directory",
      "  --min-severity <severity>  critical, high, medium, low; default: high",
      "  --fail-on <severity>       critical, high, medium, low; default: high",
      "  --timeout <ms>             dependency scan timeout",
      "  --artifact-dir <path>      write summary and scanner artifacts for CI upload",
      "  --code-only                skip dependency scanner and scan code/config indicators only",
    ].join("\n"),
  )
}

if (has("help")) {
  usage()
  process.exit(0)
}

const root = path.resolve(arg("root") ?? process.cwd())

const out = await VulnScanGate.run({
  root,
  min: severity("min-severity", "high"),
  failOn: severity("fail-on", "high"),
  dependencies: has("code-only") ? false : undefined,
  timeout: num("timeout"),
}).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})

const dir = arg("artifact-dir")
if (dir) {
  const written = await VulnScanGate.write(out, path.resolve(dir)).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  console.log(`artifact_dir: ${path.resolve(dir)}`)
  console.log(`summary_artifact: ${written.summary}`)
}

console.log(out.output)
process.exit(out.exitCode)
