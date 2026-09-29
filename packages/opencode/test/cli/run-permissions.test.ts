import { expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"

test("run rejects descendant permissions and ignores unrelated sessions", async () => {
  await using tmp = await tmpdir()
  const replies: { id: string; reply: string }[] = []
  const complete = Promise.withResolvers<void>()
  let events: ReadableStreamDefaultController<Uint8Array>
  const emit = (type: string, properties: object) =>
    events.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type, properties })}\n\n`))
  using server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/event") {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              events = controller
              controller.enqueue(new TextEncoder().encode(": connected\n\n"))
            },
          }),
          {
            headers: { "content-type": "text/event-stream" },
          },
        )
      }
      if (url.pathname === "/config") return Response.json({ share: "disabled" })
      if (url.pathname === "/session") return Response.json({ id: "ses_root" })
      if (url.pathname === "/session/ses_root/message") {
        emit("session.created", { info: { id: "ses_child", parentID: "ses_root" } })
        emit("session.created", { info: { id: "ses_grandchild", parentID: "ses_child" } })
        emit("session.created", { info: { id: "ses_other", parentID: "ses_unrelated" } })
        for (const id of ["root", "child", "grandchild", "other", "unrelated"]) {
          emit("permission.asked", {
            id: `per_${id}`,
            sessionID: `ses_${id}`,
            permission: "read",
            patterns: ["test.txt"],
          })
        }
        await Promise.race([complete.promise, Bun.sleep(2000)])
        emit("session.status", { sessionID: "ses_root", status: { type: "idle" } })
        return Response.json({})
      }
      const match = /^\/permission\/(per_[^/]+)\/reply$/.exec(url.pathname)
      if (match) {
        const body = await request.json()
        replies.push({ id: match[1], reply: body.reply })
        if (replies.length === 3) complete.resolve()
        return Response.json(true)
      }
      return new Response("Unexpected test route", { status: 404 })
    },
  })
  const child = Bun.spawn(
    [
      process.execPath,
      "run",
      "--conditions=browser",
      path.resolve(import.meta.dir, "../../src/index.ts"),
      "run",
      "--attach",
      server.url.origin,
      "--dir",
      tmp.path,
      "--format",
      "json",
      "test",
    ],
    {
      cwd: path.resolve(import.meta.dir, "../.."),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, CYXCODE_DISABLE_AUTOUPDATE: "true", CYXCODE_AUTO_SHARE: "false" },
    },
  )
  child.stdin.end()
  const timer = setTimeout(() => child.kill(), 60000)
  try {
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect({ code, stderr: code ? stderr : undefined, stdout: code ? stdout : undefined }).toEqual({
      code: 0,
      stderr: undefined,
      stdout: undefined,
    })
    expect(replies).toEqual([
      { id: "per_root", reply: "reject" },
      { id: "per_child", reply: "reject" },
      { id: "per_grandchild", reply: "reject" },
    ])
  } finally {
    clearTimeout(timer)
    if (child.exitCode === null) child.kill()
  }
})
