/**
 * CyxCode Community Pattern Pack Management CLI
 *
 * Commands:
 *   cyxcode community list              - List installed packs
 *   cyxcode community install <source>  - Install from file or URL
 *   cyxcode community remove <name>     - Remove installed pack
 *   cyxcode community validate <path>   - Validate pack format
 */

import type { Argv } from "yargs"
import fs from "fs/promises"
import path from "path"
import { cmd } from "./cmd"
import { CyxPaths } from "../../cyxcode/paths"
import { CommunityPatterns } from "../../cyxcode/community"

// --- List subcommand ---

const ListCommand = cmd({
  command: "list",
  describe: "list installed community pattern packs",
  handler: async () => {
    const dir = CyxPaths.globalCommunityDir()

    let files: string[]
    try {
      files = await fs.readdir(dir)
    } catch {
      console.log(`\nNo community packs installed.`)
      console.log(`\nInstall with: cyxcode community install <path|url>\n`)
      return
    }

    const packs: Array<{ name: string; version: string; patterns: number; author: string }> = []

    for (const file of files) {
      if (!file.endsWith(".json")) continue
      try {
        const content = await fs.readFile(path.join(dir, file), "utf-8")
        const pack = JSON.parse(content)
        if (CommunityPatterns.isValidPack(pack)) {
          packs.push({
            name: pack.name,
            version: pack.version,
            patterns: pack.patterns.length,
            author: pack.author || "-",
          })
        }
      } catch {}
    }

    if (packs.length === 0) {
      console.log(`\nNo valid community packs found in ${dir}\n`)
      return
    }

    console.log(`\nCommunity Pattern Packs (${dir})\n`)
    console.log("┌" + "─".repeat(54) + "┐")
    console.log("│ Name           │ Version │ Patterns │ Author      │")
    console.log("├" + "─".repeat(54) + "┤")
    for (const pack of packs) {
      const name = pack.name.slice(0, 14).padEnd(14)
      const version = pack.version.slice(0, 7).padEnd(7)
      const patterns = String(pack.patterns).padEnd(8)
      const author = pack.author.slice(0, 11).padEnd(11)
      console.log(`│ ${name} │ ${version} │ ${patterns} │ ${author} │`)
    }
    console.log("└" + "─".repeat(54) + "┘")
    console.log()
  },
})

// --- Install subcommand ---

const InstallCommand = cmd({
  command: "install <source>",
  describe: "install a community pack from file or URL",
  builder: (yargs: Argv) =>
    yargs.positional("source", {
      describe: "path to JSON file or URL",
      type: "string",
      demandOption: true,
    }),
  handler: async (args) => {
    const source = args.source as string
    let content: string

    // Fetch content
    if (source.startsWith("http://") || source.startsWith("https://")) {
      try {
        const response = await fetch(source)
        if (!response.ok) {
          console.error(`Failed to fetch: ${response.statusText}`)
          process.exitCode = 1
          return
        }
        content = await response.text()
      } catch (e) {
        console.error(`Failed to fetch URL: ${e}`)
        process.exitCode = 1
        return
      }
    } else {
      try {
        content = await fs.readFile(source, "utf-8")
      } catch (e) {
        console.error(`Failed to read file: ${source}`)
        process.exitCode = 1
        return
      }
    }

    // Parse and validate
    let pack: any
    try {
      pack = JSON.parse(content)
    } catch {
      console.error("Invalid JSON file")
      process.exitCode = 1
      return
    }

    if (!CommunityPatterns.isValidPack(pack)) {
      console.error("Invalid pack format - missing required fields (name, version, patterns)")
      process.exitCode = 1
      return
    }

    // Test regex patterns compile
    for (const p of pack.patterns) {
      try {
        new RegExp(p.regex, "i")
      } catch (e) {
        console.error(`Invalid regex in pattern "${p.id}": ${p.regex}`)
        process.exitCode = 1
        return
      }
    }

    // Install
    const dir = CyxPaths.globalCommunityDir()
    await fs.mkdir(dir, { recursive: true })
    const destPath = path.join(dir, `${pack.name}.json`)
    await fs.writeFile(destPath, content)

    console.log(`\nInstalled ${pack.name} v${pack.version} (${pack.patterns.length} patterns)`)
    console.log(`Location: ${destPath}\n`)
  },
})

// --- Remove subcommand ---

const RemoveCommand = cmd({
  command: "remove <name>",
  describe: "remove an installed community pack",
  builder: (yargs: Argv) =>
    yargs.positional("name", {
      describe: "pack name to remove",
      type: "string",
      demandOption: true,
    }),
  handler: async (args) => {
    const name = args.name as string
    const dir = CyxPaths.globalCommunityDir()

    // Try both with and without -errors suffix
    const candidates = [`${name}.json`, `${name}-errors.json`]
    let packPath: string | null = null

    for (const candidate of candidates) {
      const fullPath = path.join(dir, candidate)
      try {
        await fs.access(fullPath)
        packPath = fullPath
        break
      } catch {}
    }

    if (!packPath) {
      console.error(`Pack "${name}" not found in ${dir}`)
      process.exitCode = 1
      return
    }

    await fs.unlink(packPath)
    console.log(`\nRemoved ${path.basename(packPath)}\n`)
  },
})

// --- Validate subcommand ---

const ValidateCommand = cmd({
  command: "validate <path>",
  describe: "validate a community pack file",
  builder: (yargs: Argv) =>
    yargs.positional("path", {
      describe: "path to JSON file",
      type: "string",
      demandOption: true,
    }),
  handler: async (args) => {
    const filePath = args.path as string
    let content: string

    try {
      content = await fs.readFile(filePath, "utf-8")
    } catch {
      console.error(`Cannot read file: ${filePath}`)
      process.exitCode = 1
      return
    }

    let pack: any
    try {
      pack = JSON.parse(content)
    } catch (e) {
      console.error("Invalid JSON")
      process.exitCode = 1
      return
    }

    const errors: string[] = []

    // Check required fields
    if (typeof pack.name !== "string") errors.push("Missing: name")
    if (typeof pack.version !== "string") errors.push("Missing: version")
    if (!Array.isArray(pack.patterns)) errors.push("Missing: patterns array")

    // Check each pattern
    if (Array.isArray(pack.patterns)) {
      for (let i = 0; i < pack.patterns.length; i++) {
        const p = pack.patterns[i]
        if (typeof p.id !== "string") errors.push(`Pattern ${i}: missing id`)
        if (typeof p.regex !== "string") errors.push(`Pattern ${i}: missing regex`)
        if (typeof p.description !== "string") errors.push(`Pattern ${i}: missing description`)
        if (!Array.isArray(p.fixes)) errors.push(`Pattern ${i}: missing fixes array`)

        // Test regex compiles
        if (typeof p.regex === "string") {
          try {
            new RegExp(p.regex, "i")
          } catch {
            errors.push(`Pattern ${i} (${p.id || "unknown"}): invalid regex`)
          }
        }
      }
    }

    if (errors.length > 0) {
      console.log("\nValidation FAILED:\n")
      for (const err of errors) {
        console.log(`  - ${err}`)
      }
      console.log()
      process.exitCode = 1
    } else {
      console.log(`\nValidation PASSED`)
      console.log(`  Name: ${pack.name}`)
      console.log(`  Version: ${pack.version}`)
      console.log(`  Author: ${pack.author || "(not specified)"}`)
      console.log(`  Patterns: ${pack.patterns.length}`)
      console.log()
    }
  },
})

// --- Main community command ---

export const CommunityCommand = cmd({
  command: "community",
  describe: "manage community pattern packs",
  builder: (yargs) =>
    yargs
      .command(ListCommand)
      .command(InstallCommand)
      .command(RemoveCommand)
      .command(ValidateCommand)
      .demandCommand(1, "Please specify a subcommand"),
  async handler() {},
})
