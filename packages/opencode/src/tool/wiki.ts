import fs from "fs/promises"
import z from "zod"
import { Wiki } from "../cyxcode/wiki"
import { Tool } from "./tool"

const MAX = 20
const TEXT = 8000

export const WikiReadTool = Tool.define("wikiread", {
  description: [
    "Read project wiki pages and Obsidian-style knowledge notes.",
    "Use this when you need existing wiki context, backlinks, summaries, or note contents before updating project knowledge.",
  ].join("\n"),
  parameters: z.object({
    query: z.string().optional().describe("Search terms for matching wiki pages"),
    id: z.string().optional().describe("A wiki page id or path to read"),
    limit: z.coerce.number().min(1).max(MAX).optional().describe("Maximum pages to return"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "wikiread",
      patterns: [params.id ?? params.query ?? "*"],
      always: ["*"],
      metadata: {},
    })

    const idx = await Wiki.readIndex()
    const page = params.id ? idx.pages.find((item) => item.id === params.id || item.path === params.id) : undefined
    if (params.id && !page) throw new Error("wiki page not found")
    const pages = page
      ? [page]
      : params.query
        ? Wiki.query(params.query.split(/\s+/).filter(Boolean), idx.pages)
        : idx.pages
    const list = pages.slice(0, params.limit ?? 10)
    const out = await Promise.all(
      list.map(async (item) => {
        const body = page ? await fs.readFile(Wiki.file(item), "utf-8").catch(() => "") : ""
        return [
          `<wiki-page id="${item.id}" path="${item.path}" title="${item.title}">`,
          `Summary: ${item.summary}`,
          item.tags.length > 0 ? `Tags: ${item.tags.join(", ")}` : "",
          item.links.length > 0 ? `Links: ${item.links.join(", ")}` : "",
          item.backlinks.length > 0 ? `Backlinks: ${item.backlinks.join(", ")}` : "",
          body ? ["", body.trim().slice(0, TEXT)].join("\n") : "",
          `</wiki-page>`,
        ]
          .filter(Boolean)
          .join("\n")
      }),
    )

    return {
      title: `${list.length} wiki pages`,
      output: out.join("\n\n") || "No wiki pages found.",
      metadata: {
        pages: list.map((item) => item.id),
      },
    }
  },
})

export const WikiWriteTool = Tool.define("wikiwrite", {
  description: [
    "Create or update project wiki notes.",
    "Use this to preserve durable discoveries, architecture notes, decisions, and links as markdown wiki pages.",
  ].join("\n"),
  parameters: z.object({
    id: z.string().optional().describe("Existing wiki page id or path to update"),
    title: z.string().describe("Wiki note title"),
    body: z.string().optional().describe("Markdown body. Use [[wikilinks]] to connect related notes."),
    tags: z.array(z.string()).optional().describe("Short tags for later retrieval"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "wikiwrite",
      patterns: [params.id ?? params.title],
      always: ["*"],
      metadata: {},
    })

    const idx = await Wiki.readIndex()
    const hit = params.id
      ? idx.pages.find((item) => item.id === params.id || item.path === params.id)
      : idx.pages.find((item) => item.kind === "wiki" && item.title === params.title)

    if (params.id && !hit) throw new Error("wiki page not found")
    if (hit?.kind !== undefined && hit.kind !== "wiki") throw new Error("can only update wiki notes")

    const page = hit
      ? await Wiki.update(hit.id, {
          title: params.title,
          body: params.body,
          tags: params.tags,
        })
      : await Wiki.create({
          title: params.title,
          body: params.body,
          tags: params.tags,
        })

    return {
      title: page.title,
      output: JSON.stringify(page, null, 2),
      metadata: {
        page,
      },
    }
  },
})
