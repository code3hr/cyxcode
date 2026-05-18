import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { Graph } from "../../cyxcode/graph"

type Node = Awaited<ReturnType<typeof Graph.build>>["nodes"][number]

function text(v: unknown): string {
  if (v === undefined || v === null) return ""
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v)
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(" ")
  if (typeof v === "object") return Object.values(v).map(text).filter(Boolean).join(" ")
  return ""
}

function hit(node: Node, q: string[]): boolean {
  if (q.length === 0) return true
  const hay = [node.id, node.title, node.path, node.summary, ...(node.tags ?? []), text(node.meta)].join(" ").toLowerCase()
  return q.every((item) => hay.includes(item))
}

const QueryCommand = cmd({
  command: "query [terms..]",
  describe: "query the knowledge graph",
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
        default: 20,
        describe: "max nodes to print",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "print JSON output",
      }),
  handler: async (args) => {
    const q = (args.terms as string[])
      .flatMap((item) => item.split(/\s+/))
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
    const graph = await Graph.build()
    const nodes = graph.nodes.filter((node) => hit(node, q)).slice(0, args.limit as number)
    const seen = new Set(nodes.map((node) => node.id))
    const edges = graph.edges.filter((edge) => seen.has(edge.from) || seen.has(edge.to))

    if (args.json) {
      console.log(JSON.stringify({ ...graph, nodes, edges }, null, 2))
      return
    }

    console.log(`\nKnowledge Graph\n`)
    console.log(`  nodes: ${graph.nodes.length}`)
    console.log(`  edges: ${graph.edges.length}`)
    console.log(`  wiki: ${graph.stats.wiki}  code: ${graph.stats.code}  memory: ${graph.stats.memory}  learned: ${graph.stats.learned}  facts: ${graph.stats.facts}`)
    console.log("")

    for (const node of nodes) {
      console.log(`${node.title}`)
      if (node.path) console.log(`  ${node.path}`)
      if (node.summary) console.log(`  ${node.summary}`)
      if (node.tags?.length) console.log(`  tags: ${node.tags.slice(0, 8).join(", ")}`)
      console.log("")
    }

    if (edges.length === 0) return

    console.log("Related edges")
    for (const edge of edges.slice(0, args.limit as number)) {
      console.log(`  ${edge.from} -> ${edge.to} (${edge.type})`)
    }
  },
})

export const GraphCommand = cmd({
  command: "graph",
  describe: "query the knowledge graph",
  builder: (yargs: Argv) => yargs.command(QueryCommand).demandCommand(),
  handler: () => {},
})
