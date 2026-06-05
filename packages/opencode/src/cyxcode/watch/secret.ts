import { CyxWatch } from "../watch"

type Hit = {
  name: string
  re: RegExp
}

const hits: Hit[] = [
  {
    name: "private_key",
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g,
  },
  {
    name: "github_token",
    re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,}\b/g,
  },
  {
    name: "aws_access_key",
    re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    name: "bearer_token",
    re: /\bBearer\s+[A-Za-z0-9._~+/=-]{24,}\b/g,
  },
  {
    name: "named_secret",
    re: /\b(?:api[_-]?key|token|secret|password|access[_-]?key|client[_-]?secret)\b\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{16,}["']?/gi,
  },
]

function label(name: string, count: number) {
  return `[REDACTED:${name}:${count}]`
}

export namespace WatchSecret {
  export function redact(text: string) {
    let next = text
    const count = new Map<string, number>()

    for (const hit of hits) {
      next = next.replace(hit.re, () => {
        const n = (count.get(hit.name) ?? 0) + 1
        count.set(hit.name, n)
        return label(hit.name, n)
      })
    }

    const detectors = Array.from(count.keys())
    return {
      content: next,
      redacted: detectors.length > 0,
      count: Array.from(count.values()).reduce((sum, item) => sum + item, 0),
      detectors,
    }
  }

  export async function scan(input: { source: string; text: string }) {
    const out = redact(input.text)
    if (out.redacted) {
      await CyxWatch.secret({
        source: input.source,
        detectors: out.detectors,
        count: out.count,
        bytes: Buffer.byteLength(input.text),
      })
    }
    return out
  }
}
