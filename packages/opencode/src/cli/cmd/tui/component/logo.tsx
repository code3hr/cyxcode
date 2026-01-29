import { TextAttributes } from "@opentui/core"
import { For } from "solid-js"
import { useTheme } from "@tui/context/theme"

const LOGO_LEFT = [
  `  _____   ____  __  `,
  ` / __\\ \\ / /\\ \\/ /  `,
  `| (__ \\ V /  >  <   `,
  ` \\___| |_|  /_/\\_\\  `,
]

const LOGO_RIGHT = [
  `__      _____ ____`,
  `\\ \\    / /_ _|_  /`,
  ` \\ \\/\\/ / | | / / `,
  `  \\_/\\_/ |___/___|`,
]

export function Logo() {
  const { theme } = useTheme()

  return (
    <box>
      <For each={LOGO_LEFT}>
        {(line, index) => (
          <box flexDirection="row" gap={1}>
            <box flexDirection="row">
              <text fg={theme.textMuted} selectable={false}>
                {line}
              </text>
            </box>
            <box flexDirection="row">
              <text fg={theme.text} attributes={TextAttributes.BOLD} selectable={false}>
                {LOGO_RIGHT[index()]}
              </text>
            </box>
          </box>
        )}
      </For>
    </box>
  )
}
