import { Component, For, JSX, Show } from "solid-js"

export interface Column<T> {
  key: string
  header: string
  width?: string
  render?: (item: T) => JSX.Element
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  emptyState?: JSX.Element
  onRowClick?: (item: T) => void
  keyField?: keyof T
}

export function DataTable<T extends Record<string, any>>(props: DataTableProps<T>) {
  return (
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <For each={props.columns}>
              {(column) => (
                <th style={{ width: column.width }}>{column.header}</th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <Show when={props.loading}>
            <tr>
              <td colspan={props.columns.length} class="text-center py-8">
                <div class="flex items-center justify-center gap-2">
                  <span class="animate-pulse text-sm text-gray-400">Loading...</span>
                </div>
              </td>
            </tr>
          </Show>

          <Show when={!props.loading && props.data.length === 0}>
            <tr>
              <td colspan={props.columns.length} class="py-8 text-center text-gray-400">
                {props.emptyState || props.emptyMessage || "No data available"}
              </td>
            </tr>
          </Show>

          <Show when={!props.loading && props.data.length > 0}>
            <For each={props.data}>
              {(item) => (
                <tr
                  class={props.onRowClick ? "cursor-pointer hover:bg-gray-750" : ""}
                  onClick={() => props.onRowClick?.(item)}
                >
                  <For each={props.columns}>
                    {(column) => (
                      <td>
                        {column.render ? column.render(item) : item[column.key]}
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </Show>
        </tbody>
      </table>
    </div>
  )
}
