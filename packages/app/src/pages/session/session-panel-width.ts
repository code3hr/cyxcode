// The review pane takes whatever the chat panel leaves behind. Reserve a fixed
// review minimum instead of capping chat width to a fraction of the window.
export const SESSION_PANEL_WIDTH_MIN = 450
export const REVIEW_PANE_WIDTH_MIN = 480
export const REVIEW_PANE_WIDTH_MIN_SPLIT = 800

export function sessionPanelWidthMax(input: { available: number; split: boolean }) {
  const pane = input.split ? REVIEW_PANE_WIDTH_MIN_SPLIT : REVIEW_PANE_WIDTH_MIN
  return Math.max(SESSION_PANEL_WIDTH_MIN, input.available - pane)
}

export function clampSessionPanelWidth(input: { width: number; available: number | undefined; split: boolean }) {
  if (input.available === undefined) return input.width
  return Math.min(input.width, sessionPanelWidthMax({ available: input.available, split: input.split }))
}