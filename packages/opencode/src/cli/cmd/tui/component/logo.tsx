import { TextAttributes } from "@opentui/core"
import { For } from "solid-js"
import { logo } from "@/cli/logo"
import { useTheme } from "@tui/context/theme"

export function Logo() {
  const { theme } = useTheme()

  return (
    <box>
      <For each={logo.left}>
        {(line, index) => (
          <box flexDirection="row" gap={1}>
            <box flexDirection="row">
              <text fg={theme.textMuted} selectable={false}>
                {line}
              </text>
            </box>
            <box flexDirection="row">
              <text fg={theme.text} attributes={TextAttributes.BOLD} selectable={false}>
                {logo.right[index()]}
              </text>
            </box>
          </box>
        )}
      </For>
    </box>
  )
}
