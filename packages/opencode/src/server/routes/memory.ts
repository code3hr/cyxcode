import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Memory } from "../../cyxcode/memory"
import { lazy } from "../../util/lazy"
import { errors } from "../error"

const privacy = z.enum(["public", "private", "sensitive", "never_send"])
const preset = z.enum(["balanced", "strict", "public"])

const item = z.object({
  id: z.string(),
  file: z.string(),
  tags: z.array(z.string()),
  summary: z.string(),
  created: z.string(),
  accessed: z.string(),
  accessCount: z.number(),
  privacy: privacy.optional(),
})

const presetItem = z.object({
  id: preset,
  name: z.string(),
  description: z.string(),
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
      "/presets",
      describeRoute({
        summary: "List memory policy presets",
        description: "List built-in Memory Firewall privacy presets.",
        operationId: "memory.presets",
        responses: {
          200: {
            description: "Memory policy presets",
            content: {
              "application/json": {
                schema: resolver(z.object({ presets: z.array(presetItem) })),
              },
            },
          },
        },
      }),
      async (c) => c.json({ presets: Memory.presets() }),
    )
    .post(
      "/preset",
      describeRoute({
        summary: "Apply memory policy preset",
        description: "Apply a built-in Memory Firewall privacy preset to project memory entries.",
        operationId: "memory.applyPreset",
        responses: {
          200: {
            description: "Memory policy preset result",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    preset: presetItem,
                    updated: z.number(),
                    entries: z.array(item),
                  }),
                ),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator(
        "json",
        z.object({
          id: preset,
        }),
      ),
      async (c) => {
        const out = await Memory.applyPreset(c.req.valid("json").id)
        if (!out) return c.json({ error: "Memory preset not found" }, 404)
        return c.json(out)
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
        const out = await Memory.get(id)
        if (!out) return c.json({ error: "Memory entry not found" }, 404)
        return c.json(out)
      },
    )
    .get(
      "/export",
      describeRoute({
        summary: "Export memory entry",
        description: "Return a memory entry and raw content for export.",
        operationId: "memory.export",
        responses: {
          200: {
            description: "Memory export",
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
        const out = await Memory.get(c.req.valid("query").id)
        if (!out) return c.json({ error: "Memory entry not found" }, 404)
        return c.json(out)
      },
    )
    .patch(
      "/page",
      describeRoute({
        summary: "Update memory entry metadata",
        description: "Update memory tags, summary, or privacy class.",
        operationId: "memory.update",
        responses: {
          200: {
            description: "Updated memory entry",
            content: {
              "application/json": {
                schema: resolver(z.object({ entry: item })),
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
      validator(
        "json",
        z.object({
          privacy: privacy.optional(),
          tags: z.array(z.string()).optional(),
          summary: z.string().optional(),
        }),
      ),
      async (c) => {
        const entry = await Memory.update(c.req.valid("query").id, c.req.valid("json"))
        if (!entry) return c.json({ error: "Memory entry not found" }, 404)
        return c.json({ entry })
      },
    )
    .delete(
      "/page",
      describeRoute({
        summary: "Delete memory entry",
        description: "Delete a memory entry and its backing file.",
        operationId: "memory.delete",
        responses: {
          200: {
            description: "Deletion result",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.boolean() })),
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
        const ok = await Memory.remove(c.req.valid("query").id)
        if (!ok) return c.json({ error: "Memory entry not found" }, 404)
        return c.json({ success: true })
      },
    ),
)
