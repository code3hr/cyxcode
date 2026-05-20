import { useGlobalSync } from "@/context/global-sync"
import { decode64 } from "@/utils/base64"
import { useParams } from "@solidjs/router"
import { createMemo } from "solid-js"

export const popularProviders = [
  "opencode",
  "opencode-go",
  "anthropic",
  "github-copilot",
  "openai",
  "google",
  "openrouter",
  "vercel",
]
const popularProviderSet = new Set(popularProviders)

function brand<T extends { id: string; name: string }>(item: T): T {
  const name = item.id === "opencode" ? "CyxCode" : item.id === "opencode-go" ? "CyxCode Go" : item.name
  if (name === item.name) return item
  return { ...item, name }
}

export function useProviders() {
  const globalSync = useGlobalSync()
  const params = useParams()
  const dir = createMemo(() => decode64(params.dir) ?? "")
  const providers = () => {
    if (dir()) {
      const [projectStore] = globalSync.child(dir())
      return projectStore.provider
    }
    return globalSync.data.provider
  }
  return {
    all: () => providers().all.map(brand),
    default: () => providers().default,
    popular: () => providers().all.filter((p) => popularProviderSet.has(p.id)).map(brand),
    connected: () => {
      const connected = new Set(providers().connected)
      return providers().all.filter((p) => connected.has(p.id)).map(brand)
    },
    paid: () => {
      const connected = new Set(providers().connected)
      return providers().all.filter(
        (p) => connected.has(p.id) && (p.id !== "opencode" || Object.values(p.models).some((m) => m.cost?.input)),
      ).map(brand)
    },
  }
}
