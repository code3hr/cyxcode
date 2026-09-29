import { expect, test } from "bun:test"
import { Selection } from "../../src/acp/selection"
import { ModelID, ProviderID } from "../../src/provider/schema"

const providers: Selection.Catalog = [
  {
    id: "custom",
    name: "CyxCode Models",
    models: {
      "org/model": { id: "org/model", name: "Model", variants: { low: {}, high: {}, default: {} } },
      "org/model/high": { id: "org/model/high", name: "Separate model" },
    },
  },
]

test("exact slash-containing model IDs take precedence over variant suffixes", () => {
  expect(Selection.parse("custom/org/model/high", providers)).toEqual({
    model: { providerID: ProviderID.make("custom"), modelID: ModelID.make("org/model/high") },
  })
  expect(Selection.parse("custom/org/model/low", providers)).toEqual({
    model: { providerID: ProviderID.make("custom"), modelID: ModelID.make("org/model") },
    variant: "low",
  })
  expect(Selection.parse("custom/org/model/toString", providers).variant).toBeUndefined()
})

test("effort options expose one default without inventing an explicit effort", () => {
  const options = Selection.options({
    providers,
    model: { providerID: ProviderID.make("custom"), modelID: ModelID.make("org/model") },
    modes: [],
  })
  expect(options.map((option) => option.id)).toEqual(["model", "effort"])
  expect(options[1].currentValue).toBe("default")
  expect(options[1].options.filter((option) => "value" in option && option.value === "default")).toHaveLength(1)
  expect(Selection.models(providers, true)).toContainEqual({
    modelId: "custom/org/model/low",
    name: "CyxCode Models/Model (low)",
  })
})
