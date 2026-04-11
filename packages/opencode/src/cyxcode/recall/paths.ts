import path from "path"
import { CyxPaths } from "../paths"

export function recallDbPath(): string {
  return path.join(CyxPaths.projectDir(), "recall.db")
}

export function cacheDir(): string {
  return path.join(CyxPaths.globalDir(), "models")
}
