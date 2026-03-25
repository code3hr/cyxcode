import { TextAttributes } from "@opentui/core"
import { For } from "solid-js"
import { useTheme } from "@tui/context/theme"

const LOGO_LEFT = [
  ` ██████╗██╗   ██╗██╗  ██╗`,
  `██╔════╝╚██╗ ██╔╝╚██╗██╔╝`,
  `██║      ╚████╔╝  ╚███╔╝ `,
  `██║       ╚██╔╝   ██╔██╗ `,
  `╚██████╗   ██║   ██╔╝ ██╗`,
  ` ╚═════╝   ╚═╝   ╚═╝  ╚═╝`,
]

const LOGO_RIGHT = [
  ` ██████╗ ██████╗ ██████╗ ███████╗`,
  `██╔════╝██╔═══██╗██╔══██╗██╔════╝`,
  `██║     ██║   ██║██║  ██║█████╗  `,
  `██║     ██║   ██║██║  ██║██╔══╝  `,
  `╚██████╗╚██████╔╝██████╔╝███████╗`,
  ` ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝`,
]

export function Logo() {
  const { theme } = useTheme()

  const renderLine = (line: string, fg: RGBA, bold: boolean): JSX.Element[] => {
    const shadow = tint(theme.background, fg, 0.25)
    const attrs = bold ? TextAttributes.BOLD : undefined
    const elements: JSX.Element[] = []
    let i = 0

    while (i < line.length) {
      const rest = line.slice(i)
      const markerIndex = rest.search(SHADOW_MARKER)

      if (markerIndex === -1) {
        elements.push(
          <text fg={fg} attributes={attrs} selectable={false}>
            {rest}
          </text>,
        )
        break
      }

      if (markerIndex > 0) {
        elements.push(
          <text fg={fg} attributes={attrs} selectable={false}>
            {rest.slice(0, markerIndex)}
          </text>,
        )
      }

      const marker = rest[markerIndex]
      switch (marker) {
        case "_":
          elements.push(
            <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
              {" "}
            </text>,
          )
          break
        case "^":
          elements.push(
            <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
              ▀
            </text>,
          )
          break
        case "~":
          elements.push(
            <text fg={shadow} attributes={attrs} selectable={false}>
              ▀
            </text>,
          )
          break
      }

      i += markerIndex + 1
    }

    return elements
  }

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
