import { createHash } from "node:crypto"

export namespace Message {
  // UUID v5 in the URL namespace keeps ACP IDs stable across reconnects and replay.
  // Internal CyxCode message and part IDs remain unchanged.
  export function id(value: string) {
    const bytes = createHash("sha1")
      .update(Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex"))
      .update(`urn:cyxcode:acp:${value}`)
      .digest()
    bytes[6] = (bytes[6] & 0x0f) | 0x50
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = bytes.subarray(0, 16).toString("hex")
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
}
