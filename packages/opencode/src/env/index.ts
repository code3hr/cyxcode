export namespace Env {
  const state = { ...process.env } as Record<string, string | undefined>

  export function get(key: string) {
    return state[key]
  }

  export function all() {
    return state
  }

  export function set(key: string, value: string) {
    state[key] = value
  }

  export function remove(key: string) {
    delete state[key]
  }
}
