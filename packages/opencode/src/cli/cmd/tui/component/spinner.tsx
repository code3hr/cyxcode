import { Show, createSignal, onCleanup, onMount } from "solid-js"
import { useTheme } from "../context/theme"
import { useKV } from "../context/kv"
import type { JSX } from "@opentui/solid"
import type { RGBA } from "@opentui/core"

const frames = ["|", "/", "-", "\\"]

export function Spinner(props: { children?: JSX.Element; color?: RGBA }) {
  const { theme } = useTheme()
  const kv = useKV()
  const color = () => props.color ?? theme.textMuted
  const [idx, set] = createSignal(0)

  onMount(() => {
    const timer = setInterval(() => set((idx() + 1) % frames.length), 80)
    onCleanup(() => clearInterval(timer))
  })

  return (
    <Show when={kv.get("animations_enabled", true)} fallback={<text fg={color()}>... {props.children}</text>}>
      <box flexDirection="row" gap={1}>
        <text fg={color()}>{frames[idx()]}</text>
        <Show when={props.children}>
          <text fg={color()}>{props.children}</text>
        </Show>
      </box>
    </Show>
  )
}
