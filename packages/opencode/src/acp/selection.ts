import type { SessionConfigOption } from "@agentclientprotocol/sdk"
import { Provider } from "../provider/provider"
import { ModelID, type ProviderID } from "../provider/schema"

export namespace Selection {
  export type Model = { providerID: ProviderID; modelID: ModelID }
  export type Catalog = Array<{
    id: string
    name: string
    models: Record<string, { id: string; name: string; variants?: Record<string, unknown> }>
  }>
  export type Input = {
    providers: Catalog
    model: Model
    variant?: string
    modes: Array<{ id: string; name: string; description?: string }>
    mode?: string
  }

  export function sort<T extends { name: string }>(providers: T[]) {
    return [...providers].sort((a, b) => {
      const left = a.name.toLowerCase()
      const right = b.name.toLowerCase()
      return left < right ? -1 : left > right ? 1 : 0
    })
  }

  export function variants(providers: Catalog, model: Model) {
    return Object.keys(
      providers.find((provider) => provider.id === model.providerID)?.models[model.modelID]?.variants ?? {},
    )
  }

  export function models(providers: Catalog, expanded = false) {
    return providers.flatMap((provider) =>
      Provider.sort(Object.values(provider.models)).flatMap((model) => {
        const base = { modelId: `${provider.id}/${model.id}`, name: `${provider.name}/${model.name}` }
        if (!expanded || !model.variants) return [base]
        return [
          base,
          ...Object.keys(model.variants)
            .filter((variant) => variant !== "default")
            .map((variant) => ({ modelId: `${base.modelId}/${variant}`, name: `${base.name} (${variant})` })),
        ]
      }),
    )
  }

  export function format(model: Model, variant: string | undefined, variants: string[], expanded: boolean) {
    const base = `${model.providerID}/${model.modelID}`
    return expanded && variant && variants.includes(variant) ? `${base}/${variant}` : base
  }

  export function metadata(input: { model: Model; variant?: string; availableVariants: string[] }) {
    return {
      opencode: {
        modelId: `${input.model.providerID}/${input.model.modelID}`,
        variant: input.variant ?? null,
        availableVariants: input.availableVariants,
      },
    }
  }

  export function parse(value: string, providers: Catalog): { model: Model; variant?: string } {
    const model = Provider.parseModel(value)
    const provider = providers.find((provider) => provider.id === model.providerID)
    if (!provider || Object.hasOwn(provider.models, model.modelID)) return { model }
    const index = model.modelID.lastIndexOf("/")
    const base = model.modelID.slice(0, index)
    const variant = model.modelID.slice(index + 1)
    if (index > -1 && Object.hasOwn(provider.models[base]?.variants ?? {}, variant)) {
      return { model: { providerID: model.providerID, modelID: ModelID.make(base) }, variant }
    }
    return { model }
  }

  export function options(input: Input): Extract<SessionConfigOption, { type: "select" }>[] {
    const efforts = variants(input.providers, input.model)
    return [
      {
        id: "model",
        name: "Model",
        category: "model",
        type: "select",
        currentValue: `${input.model.providerID}/${input.model.modelID}`,
        options: models(sort(input.providers)).map((model) => ({ value: model.modelId, name: model.name })),
      },
      ...(efforts.length
        ? [
            {
              id: "effort",
              name: "Effort",
              category: "thought_level",
              type: "select" as const,
              currentValue: input.variant && efforts.includes(input.variant) ? input.variant : "default",
              options: [...new Set(["default", ...efforts])].map((value) => ({
                value,
                name: value === "default" ? "Default" : value,
              })),
            },
          ]
        : []),
      ...(input.mode && input.modes.some((mode) => mode.id === input.mode)
        ? [
            {
              id: "mode",
              name: "Session Mode",
              category: "mode",
              type: "select" as const,
              currentValue: input.mode,
              options: input.modes.map((mode) => ({ value: mode.id, name: mode.name, description: mode.description })),
            },
          ]
        : []),
    ]
  }
}
