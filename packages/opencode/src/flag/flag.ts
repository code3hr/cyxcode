import { Config } from "effect"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

export namespace Flag {
  export const CYXCODE_AUTO_SHARE = truthy("CYXCODE_AUTO_SHARE")
  export const CYXCODE_GIT_BASH_PATH = process.env["CYXCODE_GIT_BASH_PATH"]
  export const CYXCODE_CONFIG = process.env["CYXCODE_CONFIG"]
  export declare const CYXCODE_TUI_CONFIG: string | undefined
  export declare const CYXCODE_CONFIG_DIR: string | undefined
  export const CYXCODE_CONFIG_CONTENT = process.env["CYXCODE_CONFIG_CONTENT"]
  export const CYXCODE_DISABLE_AUTOUPDATE = truthy("CYXCODE_DISABLE_AUTOUPDATE")
  export const CYXCODE_ALWAYS_NOTIFY_UPDATE = truthy("CYXCODE_ALWAYS_NOTIFY_UPDATE")
  export const CYXCODE_DISABLE_PRUNE = truthy("CYXCODE_DISABLE_PRUNE")
  export const CYXCODE_DISABLE_TERMINAL_TITLE = truthy("CYXCODE_DISABLE_TERMINAL_TITLE")
  export const CYXCODE_PERMISSION = process.env["CYXCODE_PERMISSION"]
  export const CYXCODE_DISABLE_DEFAULT_PLUGINS = truthy("CYXCODE_DISABLE_DEFAULT_PLUGINS")
  export const CYXCODE_DISABLE_LSP_DOWNLOAD = truthy("CYXCODE_DISABLE_LSP_DOWNLOAD")
  export const CYXCODE_ENABLE_EXPERIMENTAL_MODELS = truthy("CYXCODE_ENABLE_EXPERIMENTAL_MODELS")
  export const CYXCODE_DISABLE_AUTOCOMPACT = truthy("CYXCODE_DISABLE_AUTOCOMPACT")
  export const CYXCODE_DISABLE_MODELS_FETCH = truthy("CYXCODE_DISABLE_MODELS_FETCH")
  export const CYXCODE_DISABLE_CLAUDE_CODE = truthy("CYXCODE_DISABLE_CLAUDE_CODE")
  export const CYXCODE_DISABLE_CLAUDE_CODE_PROMPT =
    CYXCODE_DISABLE_CLAUDE_CODE || truthy("CYXCODE_DISABLE_CLAUDE_CODE_PROMPT")
  export const CYXCODE_DISABLE_CLAUDE_CODE_SKILLS =
    CYXCODE_DISABLE_CLAUDE_CODE || truthy("CYXCODE_DISABLE_CLAUDE_CODE_SKILLS")
  export const CYXCODE_DISABLE_EXTERNAL_SKILLS =
    CYXCODE_DISABLE_CLAUDE_CODE_SKILLS || truthy("CYXCODE_DISABLE_EXTERNAL_SKILLS")
  export declare const CYXCODE_DISABLE_PROJECT_CONFIG: boolean
  export const CYXCODE_FAKE_VCS = process.env["CYXCODE_FAKE_VCS"]
  export declare const CYXCODE_CLIENT: string
  export const CYXCODE_SERVER_PASSWORD = process.env["CYXCODE_SERVER_PASSWORD"]
  export const CYXCODE_SERVER_USERNAME = process.env["CYXCODE_SERVER_USERNAME"]
  export const CYXCODE_ENABLE_QUESTION_TOOL = truthy("CYXCODE_ENABLE_QUESTION_TOOL")
  export const CYXCODE_DEBUG = truthy("CYXCODE_DEBUG")

  // Experimental
  export const CYXCODE_EXPERIMENTAL = truthy("CYXCODE_EXPERIMENTAL")
  export const CYXCODE_EXPERIMENTAL_FILEWATCHER = Config.boolean("CYXCODE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  )
  export const CYXCODE_EXPERIMENTAL_DISABLE_FILEWATCHER = Config.boolean(
    "CYXCODE_EXPERIMENTAL_DISABLE_FILEWATCHER",
  ).pipe(Config.withDefault(false))
  export const CYXCODE_EXPERIMENTAL_ICON_DISCOVERY =
    CYXCODE_EXPERIMENTAL || truthy("CYXCODE_EXPERIMENTAL_ICON_DISCOVERY")

  const copy = process.env["CYXCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
  export const CYXCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("CYXCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const CYXCODE_ENABLE_EXA =
    truthy("CYXCODE_ENABLE_EXA") || CYXCODE_EXPERIMENTAL || truthy("CYXCODE_EXPERIMENTAL_EXA")
  export const CYXCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("CYXCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const CYXCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("CYXCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const CYXCODE_EXPERIMENTAL_OXFMT = CYXCODE_EXPERIMENTAL || truthy("CYXCODE_EXPERIMENTAL_OXFMT")
  export const CYXCODE_EXPERIMENTAL_LSP_TY = truthy("CYXCODE_EXPERIMENTAL_LSP_TY")
  export const CYXCODE_EXPERIMENTAL_LSP_TOOL = CYXCODE_EXPERIMENTAL || truthy("CYXCODE_EXPERIMENTAL_LSP_TOOL")
  export const CYXCODE_DISABLE_FILETIME_CHECK = Config.boolean("CYXCODE_DISABLE_FILETIME_CHECK").pipe(
    Config.withDefault(false),
  )
  export const CYXCODE_EXPERIMENTAL_PLAN_MODE = CYXCODE_EXPERIMENTAL || truthy("CYXCODE_EXPERIMENTAL_PLAN_MODE")
  export const CYXCODE_EXPERIMENTAL_WORKSPACES = CYXCODE_EXPERIMENTAL || truthy("CYXCODE_EXPERIMENTAL_WORKSPACES")
  export const CYXCODE_EXPERIMENTAL_MARKDOWN = !falsy("CYXCODE_EXPERIMENTAL_MARKDOWN")
  export const CYXCODE_MODELS_URL = process.env["CYXCODE_MODELS_URL"]
  export const CYXCODE_MODELS_PATH = process.env["CYXCODE_MODELS_PATH"]
  export const CYXCODE_DB = process.env["CYXCODE_DB"]
  export const CYXCODE_DISABLE_CHANNEL_DB = truthy("CYXCODE_DISABLE_CHANNEL_DB")
  export const CYXCODE_SKIP_MIGRATIONS = truthy("CYXCODE_SKIP_MIGRATIONS")
  export const CYXCODE_STRICT_CONFIG_DEPS = truthy("CYXCODE_STRICT_CONFIG_DEPS")

  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for CYXCODE_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "CYXCODE_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("CYXCODE_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for CYXCODE_TUI_CONFIG
// This must be evaluated at access time, not module load time,
// because tests and external tooling may set this env var at runtime
Object.defineProperty(Flag, "CYXCODE_TUI_CONFIG", {
  get() {
    return process.env["CYXCODE_TUI_CONFIG"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for CYXCODE_CONFIG_DIR
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "CYXCODE_CONFIG_DIR", {
  get() {
    return process.env["CYXCODE_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for CYXCODE_CLIENT
// This must be evaluated at access time, not module load time,
// because some commands override the client at runtime
Object.defineProperty(Flag, "CYXCODE_CLIENT", {
  get() {
    return process.env["CYXCODE_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})
