export namespace Glob {
  export interface Options {
    cwd?: string
    absolute?: boolean
    include?: "file" | "all"
    dot?: boolean
    symlink?: boolean
  }

  function opts(options: Options) {
    return {
      cwd: options.cwd,
      absolute: options.absolute,
      dot: options.dot,
      followSymlinks: options.symlink ?? false,
      onlyFiles: options.include !== "all",
    }
  }

  export async function scan(pattern: string, options: Options = {}): Promise<string[]> {
    const glob = new Bun.Glob(pattern)
    const result = []
    for await (const item of glob.scan(opts(options))) {
      result.push(item)
    }
    return result
  }

  export function scanSync(pattern: string, options: Options = {}): string[] {
    return Array.from(new Bun.Glob(pattern).scanSync(opts(options)))
  }

  export function match(pattern: string, filepath: string): boolean {
    return new Bun.Glob(pattern).match(filepath)
  }
}
