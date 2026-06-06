import fs from "fs/promises"
import path from "path"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"
import { CyxPaths } from "../paths"
import type { Privacy } from "./privacy"

const mark = "cyxmem:v1"

function b64(buf: Buffer) {
  return buf.toString("base64url")
}

function raw(text: string) {
  return Buffer.from(text, "base64url")
}

function sealed(privacy?: Privacy) {
  return privacy === "sensitive" || privacy === "never_send"
}

async function key() {
  if (process.env.CYXCODE_MEMORY_KEY) return createHash("sha256").update(process.env.CYXCODE_MEMORY_KEY).digest()
  const file = path.join(CyxPaths.projectDir(), "cyxwatch", "memory.key")
  const hit = await fs.readFile(file, "utf-8").catch(() => "")
  if (hit.trim()) return Buffer.from(hit.trim(), "base64url")
  const next = randomBytes(32)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, b64(next), { flag: "wx" }).catch(() => {})
  return Buffer.from((await fs.readFile(file, "utf-8")).trim(), "base64url")
}

async function decrypt(text: string) {
  const parts = text.trim().split(".")
  if (parts.length !== 4 || parts[0] !== mark) return undefined
  try {
    const dec = createDecipheriv("aes-256-gcm", await key(), raw(parts[1]!))
    dec.setAuthTag(raw(parts[2]!))
    return Buffer.concat([dec.update(raw(parts[3]!)), dec.final()]).toString("utf-8")
  } catch {
    return undefined
  }
}

export namespace MemoryCrypto {
  export function isEncrypted(text: string) {
    return text.trim().startsWith(`${mark}.`)
  }

  export async function open(text: string) {
    if (!isEncrypted(text)) return text
    return (await decrypt(text)) ?? ""
  }

  export async function seal(text: string) {
    if (isEncrypted(text)) return text
    const iv = randomBytes(12)
    const enc = createCipheriv("aes-256-gcm", await key(), iv)
    const data = Buffer.concat([enc.update(text, "utf-8"), enc.final()])
    return [mark, b64(iv), b64(enc.getAuthTag()), b64(data)].join(".")
  }

  export async function store(text: string, privacy?: Privacy) {
    const plain = isEncrypted(text) ? await decrypt(text) : text
    if (plain === undefined) return text
    if (sealed(privacy)) return await seal(plain)
    return plain
  }
}
