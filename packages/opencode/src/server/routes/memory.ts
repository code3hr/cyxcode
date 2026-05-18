import path from "path"
import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Memory } from "../../cyxcode/memory"
import { Filesystem } from "../../util/filesystem"
import { lazy } from "../../util/lazy"
import { errors } from "../error"

const item = z.object({
  id: z.string(),
  file: z.string(),
  tags: z.array(z.string()),
  summary: z.string(),
  created: z.string(),
  accessed: z.string(),
  accessCount: z.number(),
})

export const MemoryRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List memories",
        description: "List indexed project memory entries.",
        operationId: "memory.list",
        responses: {
          200: {
            description: "Memory entries",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    entries: z.array(item),
                    total: z.number(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          search: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const idx = await Memory.readIndex()
        const low = query.search?.trim().toLowerCase() || ""
        const entries = idx.entries.filter((entry) => {
          if (!low) return true
          const meta = JSON.stringify(entry)
          return (
            entry.id.toLowerCase().includes(low) ||
            entry.summary.toLowerCase().includes(low) ||
            entry.file.toLowerCase().includes(low) ||
            entry.tags.some((tag) => tag.toLowerCase().includes(low)) ||
            meta.toLowerCase().includes(low)
          )
        })
        return c.json({ entries: entries.slice(0, query.limit ?? 50), total: entries.length })
      },
    )
    .get(
      "/page",
      describeRoute({
        summary: "Get memory entry",
        description: "Return a memory entry and its content.",
        operationId: "memory.get",
        responses: {
          200: {
            description: "Memory entry",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    entry: item,
                    content: z.string(),
                  }),
                ),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator(
        "query",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => {
        const id = c.req.valid("query").id
        const idx = await Memory.readIndex()
        const entry = idx.entries.find((item) => item.id === id)
        if (!entry) return c.json({ error: "Memory entry not found" }, 404)
        const content = await Filesystem.readText(path.join(Memory.getBasePath(), entry.file)).catch(() => "")
        return c.json({ entry, content })
      },
    ),
)
