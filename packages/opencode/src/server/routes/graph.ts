import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { lazy } from "../../util/lazy"
import { errors } from "../error"
import { Graph } from "../../cyxcode/graph"

const node = z.object({
  id: z.string(),
  kind: z.enum(["wiki", "code", "symbol", "memory", "learned", "concept", "cyxwatch"]),
  title: z.string(),
  path: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})

const edge = z.object({
  from: z.string(),
  to: z.string(),
  type: z.string(),
})

export const GraphRoutes = lazy(() =>
  new Hono().get(
    "/",
    describeRoute({
      summary: "Get knowledge graph",
      description: "Return the unified knowledge graph across wiki pages, code files, memories, learned patterns, and semantic facts.",
      operationId: "graph.get",
      responses: {
        200: {
          description: "Knowledge graph",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  nodes: z.array(node),
                  edges: z.array(edge),
                  stats: z.object({
                    wiki: z.number(),
                    code: z.number(),
                    memory: z.number(),
                    learned: z.number(),
                    facts: z.number(),
                    cyxwatch: z.number(),
                  }),
                }),
              ),
            },
          },
        },
        ...errors(400),
      },
    }),
    validator(
      "query",
      z.object({
        id: z.string().optional(),
        q: z.string().optional(),
        hop: z.coerce.number().min(1).max(4).optional(),
        limit: z.coerce.number().min(20).max(500).optional(),
        symbols: z.enum(["true", "false"]).optional(),
      }),
    ),
    async (c) => {
      const query = c.req.valid("query")
      const full = !query.id && !query.q && !query.hop && !query.limit && !query.symbols
      const data = await Graph.build(full ? {} : { symbols: query.symbols === "true" })
      if (full) return c.json(data)
      return c.json(Graph.focus(data, {
        id: query.id,
        q: query.q,
        hop: query.hop,
        limit: query.limit,
      }))
    },
  ),
)
