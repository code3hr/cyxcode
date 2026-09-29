import type { NamedError } from "@cyxcode/util/error"
import { MessageV2 } from "./message-v2"

export namespace SessionRetry {
  export const RETRY_INITIAL_DELAY = 2000
  export const RETRY_BACKOFF_FACTOR = 2
  export const RETRY_JITTER_FACTOR = 0.25
  export const RETRY_MAX_RETRIES = 5
  export const RETRY_MAX_DELAY_NO_HEADERS = 30_000 // 30 seconds
  export const RETRY_MAX_DELAY = 2_147_483_647 // max 32-bit signed integer for setTimeout

  const patterns = [
    /\b(?:429|500|502|503|504|524)\b/i,
    /rate increased too quickly|rate[-_ ]limit|too many requests/i,
    /overloaded|service[-_ ]unavailable|internal[-_ ](?:server )?error|server[-_ ]error|provider[-_ ]returned[-_ ]error/i,
    /terminated|fetch failed|failed to fetch|network[-_\s]error|upstream connect|connection (?:error|refused|lost)|socket connection was closed|socket hang up|reset before headers|getaddrinfo|enotfound|eai_again|econnrefused|econnreset|etimedout/i,
    /^timeout$|\b(?:request|response|connection|network|stream|read) (?:timeout|timed out|time out)\b/i,
    /try your request again|retry your request|resource[ _]exhausted/i,
    /\btry again (?:later|in\b)|\b(?:currently|temporarily) at capacity\b/i,
  ]

  function matches(value: unknown) {
    return typeof value === "string" && patterns.some((pattern) => pattern.test(value))
  }

  export async function sleep(ms: number, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted()
    return new Promise((resolve, reject) => {
      const abortHandler = () => {
        clearTimeout(timeout)
        reject(new DOMException("Aborted", "AbortError"))
      }
      const timeout = setTimeout(
        () => {
          signal.removeEventListener("abort", abortHandler)
          resolve()
        },
        Math.min(ms, RETRY_MAX_DELAY),
      )
      signal.addEventListener("abort", abortHandler, { once: true })
    })
  }

  export function delay(attempt: number, error?: MessageV2.APIError, random = Math.random()) {
    if (error) {
      const headers = error.data.responseHeaders
      if (headers) {
        const retryAfterMs = headers["retry-after-ms"]
        if (retryAfterMs) {
          const parsedMs = Number.parseFloat(retryAfterMs)
          if (Number.isFinite(parsedMs) && parsedMs >= 0) {
            return Math.min(parsedMs, RETRY_MAX_DELAY)
          }
        }

        const retryAfter = headers["retry-after"]
        if (retryAfter) {
          const parsedSeconds = Number.parseFloat(retryAfter)
          if (Number.isFinite(parsedSeconds) && parsedSeconds >= 0) {
            // convert seconds to milliseconds
            return Math.min(Math.ceil(parsedSeconds * 1000), RETRY_MAX_DELAY)
          }
          // Try parsing as HTTP date format
          const parsed = Date.parse(retryAfter) - Date.now()
          if (!Number.isNaN(parsed) && parsed > 0) {
            return Math.min(Math.ceil(parsed), RETRY_MAX_DELAY)
          }
        }
      }
    }

    return Math.min(
      Math.ceil(RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1) * (1 + RETRY_JITTER_FACTOR * random)),
      error?.data.responseHeaders ? RETRY_MAX_DELAY : RETRY_MAX_DELAY_NO_HEADERS,
    )
  }

  export function retryable(error: ReturnType<NamedError["toObject"]>) {
    // context overflow errors should not be retried
    if (MessageV2.ContextOverflowError.isInstance(error)) return undefined
    if (MessageV2.APIError.isInstance(error)) {
      if (
        !error.data.isRetryable &&
        !(error.data.statusCode !== undefined && error.data.statusCode >= 500 && error.data.statusCode < 600) &&
        !matches(error.data.message) &&
        !matches(error.data.responseBody)
      )
        return undefined
      if (error.data.responseBody?.includes("FreeUsageLimitError"))
        return `Free usage exceeded, check your account at https://opencode.ai/zen`
      return error.data.message.includes("Overloaded") ? "Provider is overloaded" : error.data.message
    }

    const message = error.data?.message
    if (typeof message !== "string") return undefined
    if (/too_many_requests/i.test(message)) return "Too Many Requests"
    if (/exhausted|unavailable/i.test(message)) return "Provider is overloaded"
    if (matches(message)) return message
    return undefined
  }
}
