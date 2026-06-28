import { Flag } from "@/flag/flag"

const patternBlock =
  /\b(?:don't|do not|never|no|disable|skip|stop|turn off)\b[^.\n]{0,80}\b(?:cyxcode|pattern|matching|short[- ]?circuit|recovery)\b/i

type TextPart = {
  type: string
  text?: string
  ignored?: boolean
  synthetic?: boolean
}

type UserMessage = {
  info: {
    role: string
  }
  parts: readonly TextPart[]
}

export function shouldSkipPatternMatch(parts: readonly TextPart[] | undefined): boolean {
  if (Flag.CYXCODE_DISABLE_PATTERN_MATCHING) return true
  if (!parts?.length) return false
  const text = parts
    .filter((part) => part.type === "text" && !part.ignored && !part.synthetic && part.text)
    .map((part) => part.text!)
    .join("\n")
    .toLowerCase()
    .trim()
  return patternBlock.test(text)
}

export function shouldSkipPatternMatchFromMessages(messages: readonly UserMessage[] | undefined): boolean {
  if (!messages?.length) return false
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.info.role !== "user") continue
    return shouldSkipPatternMatch(msg.parts)
  }
  return false
}
