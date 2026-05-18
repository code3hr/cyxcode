import type { Argv } from "yargs"
import fs from "fs/promises"
import * as prompts from "@clack/prompts"
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { Wiki } from "../../cyxcode/wiki"

async function body(args: { body?: string; file?: string }) {
  if (args.body) return args.body
  if (args.file) return await fs.readFile(args.file, "utf-8")
  if (!process.stdin.isTTY) return await Bun.stdin.text()
  return ""
}

function tags(raw?: string | string[]) {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean)
}

const CreateCommand = cmd({
  command: "create <title>",
  describe: "create a wiki note",
  builder: (yargs: Argv) =>
    yargs
      .positional("title", {
        type: "string",
        describe: "note title",
        demandOption: true,
      })
      .option("body", {
        type: "string",
        describe: "note body",
      })
      .option("file", {
        type: "string",
        describe: "read note body from file",
      })
      .option("tags", {
        type: "string",
        describe: "comma-separated tags",
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const note = await Wiki.create({
        title: args.title as string,
        body: await body({ body: args.body as string | undefined, file: args.file as string | undefined }),
        tags: tags(args.tags as string | string[] | undefined),
      })

      console.log(note.path)
    })
  },
})

const UpdateCommand = cmd({
  command: "update <id>",
  describe: "update an existing wiki note",
  builder: (yargs: Argv) =>
    yargs
      .positional("id", {
        type: "string",
        describe: "note id or path",
        demandOption: true,
      })
      .option("title", {
        type: "string",
        describe: "new note title",
      })
      .option("body", {
        type: "string",
        describe: "note body",
      })
      .option("file", {
        type: "string",
        describe: "read note body from file",
      })
      .option("tags", {
        type: "string",
        describe: "comma-separated tags",
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const prev = await Wiki.get(args.id as string)
      if (!prev) {
        throw new Error("wiki page not found")
      }

      const next = tags(args.tags as string | string[] | undefined)

      const note = await Wiki.update(args.id as string, {
        title: (args.title as string | undefined) || prev.title,
        body: await body({ body: args.body as string | undefined, file: args.file as string | undefined }),
        tags: next.length > 0 ? next : prev.tags,
      })

      console.log(note.path)
    })
  },
})

const RenameCommand = cmd({
  command: "rename <id> <title>",
  describe: "rename a wiki note",
  builder: (yargs: Argv) =>
    yargs
      .positional("id", {
        type: "string",
        describe: "note id or path",
        demandOption: true,
      })
      .positional("title", {
        type: "string",
        describe: "new note title",
        demandOption: true,
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const note = await Wiki.rename(args.id as string, args.title as string)
      console.log(note.path)
    })
  },
})

const DeleteCommand = cmd({
  command: "delete <id>",
  describe: "delete a wiki note",
  builder: (yargs: Argv) =>
    yargs.positional("id", {
      type: "string",
      describe: "note id or path",
      demandOption: true,
    }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      if (process.stdin.isTTY) {
        const ok = await prompts.confirm({
          message: `Delete ${args.id as string}?`,
          initialValue: false,
        })
        if (prompts.isCancel(ok) || !ok) return
      }

      await Wiki.remove(args.id as string)
      console.log("deleted")
    })
  },
})

const QueryCommand = cmd({
  command: "query [terms..]",
  describe: "query wiki notes",
  builder: (yargs: Argv) =>
    yargs
      .positional("terms", {
        type: "string",
        array: true,
        default: [],
        describe: "search terms",
      })
      .option("limit", {
        type: "number",
        default: 10,
        describe: "max notes to print",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "print JSON output",
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const idx = await Wiki.readIndex()
      const q = (args.terms as string[]).flatMap((item) => item.split(/\s+/)).filter(Boolean)
      const rows = (q.length > 0 ? Wiki.query(q, idx.pages) : idx.pages).slice(0, args.limit as number)

      if (args.json) {
        console.log(JSON.stringify(rows, null, 2))
        return
      }

      for (const page of rows) {
        console.log(`${page.title}`)
        console.log(`  ${page.path}`)
        console.log(`  ${page.links.length} links | ${page.backlinks.length} backlinks | ${page.kind}`)
        if (page.summary) console.log(`  ${page.summary}`)
        console.log("")
      }
    })
  },
})

export const WikiCommand = cmd({
  command: "wiki",
  describe: "create and query wiki notes",
  builder: (yargs: Argv) =>
    yargs.command(CreateCommand).command(UpdateCommand).command(RenameCommand).command(DeleteCommand).command(QueryCommand).demandCommand(),
  handler: () => {},
})
