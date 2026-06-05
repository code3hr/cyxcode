import { CyxWatch } from "@/cyxcode/watch"

type Body = BodyInit | FormData | null | undefined

function size(body: Body) {
  if (!body) return undefined
  if (typeof body === "string") return Buffer.byteLength(body)
  if (body instanceof URLSearchParams) return Buffer.byteLength(body.toString())
  if (body instanceof Blob) return body.size
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  if (body instanceof FormData) return undefined
  return undefined
}

export namespace Http {
  export function bodySize(body: Body) {
    return size(body)
  }

  export async function fetch(input: RequestInfo | URL, init?: RequestInit) {
    const req = new Request(input, init)
    const bytes = size(init?.body ?? null)

    const guard = CyxWatch.enforce({
      permission: "webfetch",
      patterns: [req.url],
      metadata: {
        url: req.url,
        method: req.method,
        bytes,
      },
    })

    await CyxWatch.request({
      url: req.url,
      method: req.method,
      bytes,
      guard,
    })
    return await globalThis.fetch(req)
  }
}
