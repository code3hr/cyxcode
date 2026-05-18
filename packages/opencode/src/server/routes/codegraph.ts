import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { Codegraph } from "../../cyxcode/codegraph"

const file = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.literal("file"),
  title: z.string(),
  hash: z.string(),
  imports: z.array(z.string()),
  uses: z.array(z.string()),
  exports: z.array(z.string()),
  symbols: z.array(z.string()),
  modified: z.number(),
})

const node = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.enum(["file", "symbol"]),
  title: z.string(),
})

const edge = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(["import", "declares", "uses"]),
})

export const CodegraphRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List codegraph files",
        description: "List scanned code files in the current project code graph.",
        operationId: "codegraph.list",
        responses: {
          200: {
            description: "Codegraph files",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    files: z.array(file),
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
        const idx = await Codegraph.readIndex()
        const files = query.search ? Codegraph.query(query.search.split(/\s+/).filter(Boolean), idx.files) : idx.files
        return c.json({ files: files.slice(0, query.limit ?? 50), total: files.length })
      },
    )
    .get(
      "/graph",
      describeRoute({
        summary: "Get codegraph",
        description: "Return nodes and edges for the current code graph.",
        operationId: "codegraph.graph",
        responses: {
          200: {
            description: "Code graph",
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
        const idx = await Codegraph.readIndex()
        return c.json(Codegraph.graph(idx))
      },
    )
    .get(
      "/page",
      describeRoute({
        summary: "Get code file",
        description: "Return a scanned code file and its content.",
        operationId: "codegraph.get",
        responses: {
          200: {
            description: "Code file",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    file,
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
        const page = await Codegraph.page(id)
        if (!page) return c.json({ error: "Code file not found" }, 404)
        return c.json(page)
      },
    )
    .post(
      "/rebuild",
      describeRoute({
        summary: "Rebuild code graph",
        description: "Rescan code files and refresh imports and symbol relationships.",
        operationId: "codegraph.rebuild",
        responses: {
          200: {
            description: "Rebuild stats",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    files: z.number(),
                    symbols: z.number(),
                    imports: z.number(),
                    edges: z.number(),
                    errors: z.number(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await Codegraph.rebuild())
      },
    ),
)
