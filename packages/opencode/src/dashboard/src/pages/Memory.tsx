import { Component, For, Show, createEffect, createSignal, onCleanup } from "solid-js"
import { useSearchParams, A } from "@solidjs/router"
import { memoryApi, type MemoryEntry } from "../api/client"

const Memory: Component = () => {
  const [search, setSearch] = useSearchParams()
  const [term, setTerm] = createSignal("")
  const [items, setItems] = createSignal<MemoryEntry[]>([])
  const [cur, setCur] = createSignal<MemoryEntry | null>(null)
  const [text, setText] = createSignal("")
  const [load, setLoad] = createSignal(true)
  const [err, setErr] = createSignal<string | null>(null)

  const fetchList = async (q = "") => {
    setLoad(true)
    setErr(null)
    const res = await memoryApi.list({ search: q || undefined, limit: 100 })
    if (res.error) {
      setErr(res.error)
      setLoad(false)
      return
    }
    if (res.data) setItems(res.data.entries)
    setLoad(false)
  }

  const fetchPage = async (id: string) => {
    const res = await memoryApi.get(id)
    if (res.error) {
      setErr(res.error)
      setCur(null)
      setText("")
      return
    }
    if (!res.data) return
    setCur(res.data.entry)
    setText(res.data.content)
  }

  createEffect(() => {
    const q = term().trim()
    const timer = window.setTimeout(() => void fetchList(q), 180)
    onCleanup(() => window.clearTimeout(timer))
  })

  createEffect(() => {
    const id = search.id || items()[0]?.id || ""
    if (!id) return
    if (cur()?.id !== id) void fetchPage(id)
  })

  const pick = (id: string) => {
    const next = items().find((item) => item.id === id) ?? null
    setCur(next)
    setSearch({ id })
    void fetchPage(id)
  }

  return (
    <div class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Memory Explorer</h1>
          <p class="text-gray-400 mt-1">Browse project memories and inspect their source content</p>
        </div>

        <div class="flex flex-wrap gap-3">
          <div class="px-4 py-3 rounded-lg bg-gray-800 border border-gray-700">
            <div class="text-xs uppercase tracking-wide text-gray-500">Entries</div>
            <div class="text-lg font-semibold text-gray-100">{items().length}</div>
          </div>
          <A class="btn btn-secondary" href="/dashboard/graph">
            Back to graph
          </A>
        </div>
      </div>

      <Show when={err()}>
        <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">{err()}</div>
      </Show>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div class="xl:col-span-4 card">
          <div class="card-header">Entries</div>
          <input class="input w-full mb-4" type="text" placeholder="Search memory..." value={term()} onInput={(e) => setTerm(e.currentTarget.value)} />
          <div class="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
            <Show when={!load() || items().length > 0} fallback={<div class="text-sm text-gray-500">Loading memory index...</div>}>
              <For each={items()}>
                {(item) => (
                  <button
                    onClick={() => pick(item.id)}
                    class={`w-full text-left rounded-lg border p-3 transition-colors ${
                      cur()?.id === item.id ? "bg-amber-900/30 border-amber-700" : "bg-gray-800 border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <div class="font-medium text-gray-100 truncate">{item.summary}</div>
                    <div class="text-xs text-gray-500 truncate">{item.id}</div>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <For each={item.tags.slice(0, 4)}>{(tag) => <span class="badge bg-gray-700 text-gray-300">{tag}</span>}</For>
                    </div>
                  </button>
                )}
              </For>
            </Show>
          </div>
        </div>

        <div class="xl:col-span-8 card">
          <div class="card-header">Details</div>
          <Show when={cur()} fallback={<div class="text-sm text-gray-500">Select a memory to inspect its content.</div>}>
            <div class="space-y-4">
              <div>
                <div class="text-xl font-semibold text-gray-100">{cur()!.summary}</div>
                <div class="text-xs text-gray-500 mt-1">{cur()!.file}</div>
              </div>

              <div class="flex flex-wrap gap-2">
                <span class="badge bg-amber-900/40 text-amber-300">memory</span>
                <span class="badge bg-gray-700 text-gray-300">{cur()!.tags.length} tags</span>
                <span class="badge bg-gray-700 text-gray-300">{cur()!.accessCount} loads</span>
              </div>

              <div class="flex flex-wrap gap-2">
                <A class="btn btn-secondary text-xs" href={`/dashboard/graph?id=${encodeURIComponent(cur()!.id)}`}>
                  Back to graph
                </A>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Tags</div>
                <div class="flex flex-wrap gap-2">
                  <For each={cur()!.tags}>{(tag) => <span class="badge bg-gray-700 text-gray-300">{tag}</span>}</For>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Content</div>
                <pre class="max-h-[60vh] overflow-y-auto rounded-lg bg-gray-900 border border-gray-700 p-3 text-xs text-gray-300 whitespace-pre-wrap break-words">
                  {text().slice(0, 5000)}
                </pre>
              </div>

              <div class="text-xs text-gray-500">
                Created {cur()!.created} | accessed {cur()!.accessed}
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}

export default Memory
