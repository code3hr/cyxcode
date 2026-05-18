import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import z from "zod"
import { lazy } from "../../util/lazy"
import { errors } from "../error"
import { Graph } from "../../cyxcode/graph"

const node = z.object({
  id: z.string(),
  kind: z.enum(["wiki", "code", "symbol", "memory", "learned", "concept"]),
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
                  }),
                }),
              ),
            },
          },
        },
        ...errors(400),
      },
    }),
    async (c) => {
      return c.json(await Graph.build())
    },
  ),
)
