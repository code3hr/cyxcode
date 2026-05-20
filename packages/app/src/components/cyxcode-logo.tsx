const left = [
  " ██████╗██╗   ██╗██╗  ██╗",
  "██╔════╝╚██╗ ██╔╝╚██╗██╔╝",
  "██║      ╚████╔╝  ╚███╔╝ ",
  "██║       ╚██╔╝   ██╔██╗ ",
  "╚██████╗   ██║   ██╔╝ ██╗",
  " ╚═════╝   ╚═╝   ╚═╝  ╚═╝",
]

const right = [
  " ██████╗ ██████╗ ██████╗ ███████╗",
  "██╔════╝██╔═══██╗██╔══██╗██╔════╝",
  "██║     ██║   ██║██║  ██║█████╗  ",
  "██║     ██║   ██║██║  ██║██╔══╝  ",
  "╚██████╗╚██████╔╝██████╔╝███████╗",
  " ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝",
]

export function CyxcodeLogo(props: { class?: string }) {
  return (
    <svg
      class={`block w-full max-w-[40rem] ${props.class ?? ""}`}
      viewBox="0 0 860 126"
      role="img"
      aria-label="CyxCode"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
        font-size="18"
        font-weight="700"
      >
        {left.map((line, i) => (
          <text x="2" y={24 + i * 18 + 2} fill="var(--icon-weak-base)" opacity="0.55" style={{ "white-space": "pre" }}>
            {line}
          </text>
        ))}
        {right.map((line, i) => (
          <text x="356" y={24 + i * 18 + 2} fill="var(--icon-weak-base)" opacity="0.45" style={{ "white-space": "pre" }}>
            {line}
          </text>
        ))}
        {left.map((line, i) => (
          <text x="0" y={24 + i * 18} fill="var(--text-weak)" style={{ "white-space": "pre" }}>
            {line}
          </text>
        ))}
        {right.map((line, i) => (
          <text x="354" y={24 + i * 18} fill="var(--text-strong)" style={{ "white-space": "pre" }}>
            {line}
          </text>
        ))}
      </g>
    </svg>
  )
}
