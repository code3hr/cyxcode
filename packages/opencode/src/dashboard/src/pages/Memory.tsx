import { Component, For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js"
import { useSearchParams, A } from "@solidjs/router"
import { memoryApi, type MemoryEntry, type MemoryPreset } from "../api/client"

const classes: Array<NonNullable<MemoryEntry["privacy"]>> = ["public", "private", "sensitive", "never_send"]

const Memory: Component = () => {
  const [search, setSearch] = useSearchParams()
  const [term, setTerm] = createSignal("")
  const [items, setItems] = createSignal<MemoryEntry[]>([])
  const [cur, setCur] = createSignal<MemoryEntry | null>(null)
  const [text, setText] = createSignal("")
  const [privacy, setPrivacy] = createSignal<NonNullable<MemoryEntry["privacy"]>>("private")
  const [presets, setPresets] = createSignal<MemoryPreset[]>([])
  const [preset, setPreset] = createSignal<MemoryPreset["id"]>("balanced")
  const [load, setLoad] = createSignal(true)
  const [busy, setBusy] = createSignal(false)
  const [err, setErr] = createSignal<string | null>(null)
  const [msg, setMsg] = createSignal<string | null>(null)

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

  const fetchPresets = async () => {
    const res = await memoryApi.presets()
    if (res.data) setPresets(res.data.presets)
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
    setPrivacy(res.data.entry.privacy ?? "private")
  }

  createEffect(() => {
    const q = term().trim()
    const timer = window.setTimeout(() => void fetchList(q), 180)
    onCleanup(() => window.clearTimeout(timer))
  })

  onMount(() => void fetchPresets())

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

  const refresh = async (id?: string) => {
    await fetchList(term().trim())
    if (id) await fetchPage(id)
  }

  const save = async () => {
    const item = cur()
    if (!item) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    const res = await memoryApi.update(item.id, { privacy: privacy() })
    if (res.error) setErr(res.error)
    if (res.data) {
      setCur(res.data.entry)
      setItems(items().map((entry) => entry.id === res.data!.entry.id ? res.data!.entry : entry))
      setMsg("Memory updated")
    }
    setBusy(false)
  }

  const apply = async () => {
    setBusy(true)
    setErr(null)
    setMsg(null)
    const res = await memoryApi.applyPreset(preset())
    if (res.error) setErr(res.error)
    if (res.data) {
      setItems(res.data.entries)
      const item = cur()
      const next = item ? res.data.entries.find((entry) => entry.id === item.id) : undefined
      if (next) {
        setCur(next)
        setPrivacy(next.privacy ?? "private")
      }
      setMsg(`${res.data.preset.name} preset updated ${res.data.updated} memories`)
    }
    setBusy(false)
  }

  const download = async () => {
    const item = cur()
    if (!item) return
    setBusy(true)
    setErr(null)
    const res = await memoryApi.export(item.id)
    if (res.error) setErr(res.error)
    if (res.data) {
      const blob = new Blob([res.data.content], { type: "text/markdown" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.data.entry.file
      a.click()
      URL.revokeObjectURL(url)
      setMsg("Memory exported")
    }
    setBusy(false)
  }

  const remove = async () => {
    const item = cur()
    if (!item || !window.confirm(`Delete memory ${item.id}?`)) return
    setBusy(true)
    setErr(null)
    setMsg(null)
    const res = await memoryApi.delete(item.id)
    if (res.error) setErr(res.error)
    if (res.data) {
      setCur(null)
      setText("")
      setSearch({})
      await refresh()
      setMsg("Memory deleted")
    }
    setBusy(false)
  }

  return (
    <div class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-100">Memory</h1>
          <p class="text-gray-400 mt-1">Saved project context and recalled source notes</p>
        </div>

        <div class="flex flex-wrap gap-3">
          <div class="stat-card min-w-72">
            <div class="text-xs uppercase tracking-wide text-gray-500 mb-2">Policy preset</div>
            <div class="flex flex-wrap gap-2">
              <select class="select text-sm" value={preset()} onChange={(e) => setPreset(e.currentTarget.value as MemoryPreset["id"])}>
                <For each={presets()}>{(item) => <option value={item.id}>{item.name}</option>}</For>
              </select>
              <button class="btn btn-primary text-sm" onClick={apply} disabled={busy() || presets().length === 0}>
                Apply
              </button>
            </div>
            <div class="mt-2 text-xs text-gray-500">{presets().find((item) => item.id === preset())?.description ?? ""}</div>
          </div>
          <div class="stat-card">
            <div class="text-xs uppercase tracking-wide text-gray-500">Entries</div>
            <div class="text-lg font-semibold text-gray-100">{items().length}</div>
          </div>
          <A class="btn btn-secondary" href="/dashboard/graph">
            Graph
          </A>
        </div>
      </div>

      <Show when={err()}>
        <div class="bg-red-900/50 border border-red-700 rounded p-4 text-red-200">{err()}</div>
      </Show>
      <Show when={msg()}>
        <div class="bg-cyan-950/50 border border-cyan-800 rounded p-3 text-sm text-cyan-200">{msg()}</div>
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
                    class={`w-full text-left rounded border p-3 transition-colors ${
                      cur()?.id === item.id ? "bg-amber-900/30 border-amber-700" : "bg-gray-800 border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <div class="font-medium text-gray-100 truncate">{item.summary}</div>
                    <div class="text-xs text-gray-500 truncate">{item.id}</div>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <span class={`badge ${badge(item.privacy ?? "private")}`}>{item.privacy ?? "private"}</span>
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
          <Show when={cur()} fallback={<div class="text-sm text-gray-500">No memory selected.</div>}>
            <div class="space-y-4">
              <div>
                <div class="text-xl font-semibold text-gray-100">{cur()!.summary}</div>
                <div class="text-xs text-gray-500 mt-1">{cur()!.file}</div>
              </div>

              <div class="flex flex-wrap gap-2">
                <span class="badge bg-amber-900/40 text-amber-300">memory</span>
                <span class={`badge ${badge(cur()!.privacy ?? "private")}`}>{cur()!.privacy ?? "private"}</span>
                <span class="badge bg-gray-700 text-gray-300">{cur()!.tags.length} tags</span>
                <span class="badge bg-gray-700 text-gray-300">{cur()!.accessCount} loads</span>
              </div>

              <div class="flex flex-wrap gap-2">
                <A class="btn btn-secondary text-xs" href={`/dashboard/graph?id=${encodeURIComponent(cur()!.id)}`}>
                  Graph
                </A>
                <button class="btn btn-secondary text-xs" onClick={download} disabled={busy()}>
                  Export
                </button>
                <button class="btn btn-danger text-xs" onClick={remove} disabled={busy()}>
                  Delete
                </button>
              </div>

              <div class="rounded border border-gray-700 bg-gray-900 p-3">
                <div class="text-sm text-gray-400 mb-2">Privacy class</div>
                <div class="flex flex-wrap gap-2">
                  <select class="select text-sm" value={privacy()} onChange={(e) => setPrivacy(e.currentTarget.value as NonNullable<MemoryEntry["privacy"]>)}>
                    <For each={classes}>{(item) => <option value={item}>{item}</option>}</For>
                  </select>
                  <button class="btn btn-primary text-sm" onClick={save} disabled={busy()}>
                    Save
                  </button>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Tags</div>
                <div class="flex flex-wrap gap-2">
                  <For each={cur()!.tags}>{(tag) => <span class="badge bg-gray-700 text-gray-300">{tag}</span>}</For>
                </div>
              </div>

              <div>
                <div class="text-sm text-gray-400 mb-2">Content</div>
                <pre class="max-h-[60vh] overflow-y-auto rounded bg-gray-900 border border-gray-700 p-3 text-xs text-gray-300 whitespace-pre-wrap break-words">
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

function badge(value: NonNullable<MemoryEntry["privacy"]>) {
  if (value === "public") return "bg-emerald-900/40 text-emerald-300"
  if (value === "sensitive") return "bg-orange-950 text-orange-300"
  if (value === "never_send") return "bg-red-950 text-red-300"
  return "bg-blue-900/40 text-blue-300"
}

export default Memory
