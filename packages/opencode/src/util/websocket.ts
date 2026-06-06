import { CyxWatch } from "@/cyxcode/watch"

function text(input: string | URL) {
  return input instanceof URL ? input.toString() : input
}

export namespace Websocket {
  export function connect(input: string | URL, protocols?: string | string[]) {
    const url = text(input)
    const guard = CyxWatch.enforce({
      permission: "websocket",
      patterns: [url],
      metadata: {
        url,
        method: "WEBSOCKET",
      },
    })

    void CyxWatch.socket({
      url,
      guard,
    })

    if (protocols === undefined) return new WebSocket(url)
    return new WebSocket(url, protocols)
  }
}
