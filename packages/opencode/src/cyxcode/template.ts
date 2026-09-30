export namespace Template {
  /** Expand numbered captures once, preserving missing captures and literal dollar signs. */
  export function render(template: string, captures: readonly (string | undefined)[]): string {
    return template.replace(/\$([1-9]\d*)/g, (match, index: string) => captures[Number(index) - 1] ?? match)
  }
}
