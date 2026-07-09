// Single source of truth for external links.
// Deep-dive docs always point to the remote repo docs location.
const base = import.meta.env.BASE_URL.replace(/\/$/, "")

export const docs = "https://github.com/code3hr/cyxcode/tree/dev/docs"
export const repo = "https://github.com/code3hr/cyxcode"
export const releases = "https://github.com/code3hr/cyxcode/releases"
export const sponsor = "https://github.com/sponsors/CYXWIZ-Lab"
export const opencode = "https://opencode.ai"
export const opencodeDocs = "https://opencode.ai/docs/"
export const doc = (path: string) => `${docs}/${path}`
export const route = (path = "/") => path === "/" ? `${base}/` : `${base}${path}`