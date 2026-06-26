/**
 * CyxCode default skills.
 *
 * Copies bundled SKILL.md-based skills into .cyxcode/skills so the normal
 * skill loader can discover them without special cases.
 */

import fs from "fs/promises"
import path from "path"
import { Log } from "@/util/log"

const log = Log.create({ service: "cyxcode-default-skills" })
const root = path.join(import.meta.dir, "default-skills")
const names = ["lean-software-guardrails"]

async function copy(from: string, dest: string): Promise<number> {
  const stat = await fs.stat(from)
  if (!stat.isDirectory()) {
    try {
      await fs.access(dest)
      return 0
    } catch {}

    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.copyFile(from, dest)
    return 1
  }

  await fs.mkdir(dest, { recursive: true })
  const count = await Promise.all(
    (await fs.readdir(from)).map((item) => copy(path.join(from, item), path.join(dest, item))),
  )
  return count.reduce((sum, item) => sum + item, 0)
}

export namespace DefaultSkills {
  export async function seed(dir: string): Promise<number> {
    let count = 0
    for (const name of names) {
      try {
        count += await copy(path.join(root, name), path.join(dir, "skills", name))
      } catch (err) {
        log.warn("failed to seed default skill", { name, error: err })
      }
    }
    return count
  }
}
