import { ModelsDev } from "./models"
import type { Provider } from "./provider"

export namespace Reasoning {
  type Variants = Record<string, Record<string, unknown>>

  // Translate metadata only for request shapes supported by CyxCode's pinned SDKs.
  export function variants(
    options: ModelsDev.Model["reasoning_options"],
    model: Provider.Model,
    limit: number,
  ): Variants | undefined {
    if (options === undefined) return
    if (!ModelsDev.Model.shape.reasoning_options.safeParse(options).success) return
    if (!options.length) return {}
    const control = options.find((option) => option.type === "effort")
    if (control) {
      const supported = [
        "@ai-sdk/openai",
        "@ai-sdk/azure",
        "@ai-sdk/openai-compatible",
        "@ai-sdk/anthropic",
        "@ai-sdk/google-vertex/anthropic",
        "@ai-sdk/google",
        "@ai-sdk/google-vertex",
        "@ai-sdk/amazon-bedrock",
        "@ai-sdk/groq",
      ]
      if (!supported.includes(model.api.npm)) return
      return Object.fromEntries(
        control.values.flatMap((value) => {
          const id = value ?? "none"
          const settings = effort(model, id)
          return settings ? [[id, settings]] : []
        }),
      )
    }
    const toggle: Variants =
      options.some((option) => option.type === "toggle") && model.api.npm === "@ai-sdk/cohere"
        ? { none: { thinking: { type: "disabled" } }, high: { thinking: { type: "enabled" } } }
        : {}
    const bounds = options.find((option) => option.type === "budget_tokens")
    if (!bounds) return Object.keys(toggle).length ? toggle : undefined
    if (
      ![
        "@ai-sdk/anthropic",
        "@ai-sdk/google-vertex/anthropic",
        "@ai-sdk/google",
        "@ai-sdk/google-vertex",
        "@ai-sdk/amazon-bedrock",
        "@ai-sdk/cohere",
      ].includes(model.api.npm)
    )
      return Object.keys(toggle).length ? toggle : undefined
    const max = Math.floor(Math.min(bounds.max ?? limit - 1, model.limit.output - 1, limit - 1))
    const min = Math.max(0, Math.ceil(bounds.min ?? 0))
    if (max <= 0 || min > max) return toggle
    return {
      ...toggle,
      ...Object.fromEntries(
        (
          [
            ["high", Math.min(Math.max(min, Math.floor((max + 1) / 2)), max)],
            ["max", max],
          ] as const
        ).map(([id, value]) => [id, budget(model, value)]),
      ),
    }
  }

  function effort(model: Provider.Model, value: string): Record<string, unknown> | undefined {
    switch (model.api.npm) {
      case "@ai-sdk/openai-compatible":
        return { reasoningEffort: value }
      case "@ai-sdk/openai":
      case "@ai-sdk/azure":
        if (!["none", "minimal", "low", "medium", "high", "xhigh"].includes(value)) return
        return { reasoningEffort: value, reasoningSummary: "auto", include: ["reasoning.encrypted_content"] }
      case "@ai-sdk/groq":
        if (!["none", "default", "low", "medium", "high"].includes(value)) return
        return { reasoningEffort: value }
      case "@ai-sdk/anthropic":
      case "@ai-sdk/google-vertex/anthropic":
        if (!["low", "medium", "high", "max"].includes(value)) return
        return {
          ...(["opus-4-6", "opus-4.6", "sonnet-4-6", "sonnet-4.6"].some((id) => model.api.id.includes(id)) && {
            thinking: { type: "adaptive" },
          }),
          effort: value,
        }
      case "@ai-sdk/google":
      case "@ai-sdk/google-vertex":
        if (!["minimal", "low", "medium", "high"].includes(value)) return
        return { thinkingConfig: { includeThoughts: true, thinkingLevel: value } }
      case "@ai-sdk/amazon-bedrock":
        if (!["low", "medium", "high", "max"].includes(value)) return
        if (["opus-4-6", "opus-4.6", "sonnet-4-6", "sonnet-4.6"].some((id) => model.api.id.includes(id))) {
          return { reasoningConfig: { type: "adaptive", maxReasoningEffort: value } }
        }
        if (model.api.id.includes("anthropic")) return
        return { reasoningConfig: { type: "enabled", maxReasoningEffort: value } }
    }
  }

  function budget(model: Provider.Model, value: number): Record<string, unknown> {
    switch (model.api.npm) {
      case "@ai-sdk/anthropic":
      case "@ai-sdk/google-vertex/anthropic":
        return { thinking: { type: "enabled", budgetTokens: value } }
      case "@ai-sdk/google":
      case "@ai-sdk/google-vertex":
        return { thinkingConfig: { includeThoughts: true, thinkingBudget: value } }
      case "@ai-sdk/amazon-bedrock":
        return { reasoningConfig: { type: "enabled", budgetTokens: value } }
      case "@ai-sdk/cohere":
        return { thinking: { type: "enabled", tokenBudget: value } }
      default:
        throw new Error(`Unsupported reasoning budget adapter: ${model.api.npm}`)
    }
  }
}
