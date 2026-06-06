export type Privacy = "public" | "private" | "sensitive" | "never_send"

const vals = new Set(["public", "private", "sensitive", "never_send"])
const tags = new Set([
  "api-key",
  "bearer",
  "credential",
  "credentials",
  "password",
  "private-key",
  "secret",
  "secrets",
  "ssh-key",
  "token",
])

const paths = [
  /(^|[\\/])\.env($|[.\-_\\/])/i,
  /(^|[\\/])\.ssh([\\/]|$)/i,
  /(^|[\\/])id_(rsa|ed25519|ecdsa|dsa)($|[.\-_\\/])/i,
  /(^|[\\/])(credentials|secrets?)($|[.\-_\\/])/i,
]

export namespace MemoryPrivacy {
  export function norm(value: unknown): Privacy {
    const out = String(value)
    return vals.has(out) ? (out as Privacy) : "private"
  }

  export function block(input: { id?: string; path?: string; file?: string; title?: string; summary?: string; tags?: string[] }) {
    const path = [input.id, input.path, input.file].filter(Boolean).join(" ")
    if (paths.some((item) => item.test(path))) return true
    const all = [
      ...(input.tags ?? []),
      ...(input.title ?? "").split(/[\s,;:/\\._-]+/),
      ...(input.summary ?? "").split(/[\s,;:/\\._-]+/),
    ].map((item) => item.toLowerCase())
    return all.some((item) => tags.has(item))
  }

  export function classify(input: { id?: string; path?: string; file?: string; title?: string; summary?: string; tags?: string[]; privacy?: unknown }) {
    if (block(input)) return "never_send"
    return norm(input.privacy)
  }
}
