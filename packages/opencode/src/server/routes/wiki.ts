import path from "path"
import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Instance } from "../../project/instance"
import { Filesystem } from "../../util/filesystem"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { Wiki } from "../../cyxcode/wiki"

const page = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.enum(["doc", "wiki"]),
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  links: z.array(z.string()),
  backlinks: z.array(z.string()),
  hash: z.string(),
  created: z.number(),
  modified: z.number(),
  accessed: z.number(),
  accessCount: z.number(),
})

const node = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.enum(["doc", "wiki"]),
  title: z.string(),
})

const edge = z.object({
  from: z.string(),
  to: z.string(),
  type: z.literal("wikilink"),
})

const write = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const WikiRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List wiki pages",
        description: "List wiki and markdown pages in the current project knowledge index.",
        operationId: "wiki.list",
        responses: {
          200: {
            description: "Wiki pages",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    pages: z.array(page),
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
        const idx = await Wiki.readIndex()
        const pages = query.search ? Wiki.query(query.search.split(/\s+/).filter(Boolean), idx.pages) : idx.pages
        return c.json({ pages: pages.slice(0, query.limit ?? 50), total: pages.length })
      },
    )
    .get(
      "/graph",
      describeRoute({
        summary: "Get wiki graph",
        description: "Return nodes and edges for the current wiki graph.",
        operationId: "wiki.graph",
        responses: {
          200: {
            description: "Wiki graph",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    nodes: z.array(node),
                    edges: z.array(edge),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const idx = await Wiki.readIndex()
        return c.json(Wiki.graph(idx))
      },
    )
    .get(
      "/page",
      describeRoute({
        summary: "Get wiki page",
        description: "Return a wiki page and its content.",
        operationId: "wiki.get",
        responses: {
          200: {
            description: "Wiki page",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    page,
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
        const page = await Wiki.get(id)
        if (!page) return c.json({ error: "Wiki page not found" }, 404)
        const file = Wiki.file(page)
        const content = await Filesystem.readText(file).catch(() => "")
        return c.json({ page, content })
      },
    )
    .post(
      "/rebuild",
      describeRoute({
        summary: "Rebuild wiki index",
        description: "Rescan markdown files and refresh backlinks and recall vectors.",
        operationId: "wiki.rebuild",
        responses: {
          200: {
            description: "Rebuild stats",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    pages: z.number(),
                    indexed: z.number(),
                    links: z.number(),
                    errors: z.number(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z
          .object({
            force: z.boolean().optional(),
          })
          .optional(),
      ),
      async (c) => {
        const body = c.req.valid("json") ?? {}
        const stats = await Wiki.rebuild({ force: body.force ?? false })
        return c.json(stats)
      },
    )
    .post(
      "/page",
      describeRoute({
        summary: "Create wiki page",
        description: "Create a new wiki page in the project wiki directory.",
        operationId: "wiki.create",
        responses: {
          200: {
            description: "Wiki page",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    page,
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("json", write),
      async (c) => {
        const body = c.req.valid("json")
        const page = await Wiki.create(body)
        return c.json({ page })
      },
    )
    .patch(
      "/page",
      describeRoute({
        summary: "Update wiki page",
        description: "Update an existing wiki page.",
        operationId: "wiki.update",
        responses: {
          200: {
            description: "Wiki page",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    page,
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
      validator("json", write),
      async (c) => {
        const id = c.req.valid("query").id
        const body = c.req.valid("json")
        const page = await Wiki.update(id, body).catch(() => undefined)
        if (!page) return c.json({ error: "Wiki page not found" }, 404)
        return c.json({ page })
      },
    )
    .delete(
      "/page",
      describeRoute({
        summary: "Delete wiki page",
        description: "Delete a wiki note from the project wiki directory.",
        operationId: "wiki.delete",
        responses: {
          200: {
            description: "Deletion result",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    success: z.boolean(),
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
        const page = await Wiki.get(id)
        if (!page) return c.json({ error: "Wiki page not found" }, 404)
        try {
          await Wiki.remove(id)
        } catch (err) {
          return c.json({ error: err instanceof Error ? err.message : String(err) }, 400)
        }
        return c.json({ success: true })
      },
    )
)
