import { expect, test } from "bun:test"
import { Template } from "../../src/cyxcode/template"
import { BaseSkill } from "../../src/cyxcode/base-skill"
import type { Fix, Pattern } from "../../src/cyxcode/types"

test("capture indices are exact and replacement text is not reinterpreted", () => {
  expect(Template.render("$10 $1 $2 $1", ["one", "two", "3", "4", "5", "6", "7", "8", "9", "ten"])).toBe(
    "ten one two one",
  )
  expect(Template.render("$1 $2", ["$2 $& $$ $` $'", "second"])).toBe("$2 $& $$ $` $' second")
  expect(Template.render("$1/$2/$3/$0/$01/$10", ["", undefined])).toBe("/$2/$3/$0/$01/$10")
})

class Skill extends BaseSkill {
  name = "capture-test"
  description = "Capture integration fixture"
  version = "1"
  triggers = ["missing"]
  patterns: Pattern[] = [
    {
      id: "missing",
      regex: /missing (.+)/,
      category: "test",
      description: "Missing item",
      fixes: [{ id: "fix", description: "Display item", command: "echo $1", priority: 1 }],
    },
  ]
}

test("approval, execution and result share the resolved command without mutating the pattern", async () => {
  const skill = new Skill()
  const approved: Fix[] = []
  const commands: string[] = []
  for (const value of ["first", "$& second"]) {
    const output = `missing ${value}`
    const match = skill.match(output)!
    const result = await skill.execute(
      {
        cwd: ".",
        errorOutput: output,
        env: {},
        approve: async (fix) => {
          approved.push(fix)
          return true
        },
        execute: async (command) => {
          commands.push(command)
          return { success: true, exitCode: 0, stdout: "", stderr: "" }
        },
      },
      match,
    )
    expect(result.success).toBe(true)
    expect(result.fixApplied?.command).toBe(`echo ${value}`)
  }
  expect(approved.map((fix) => fix.command)).toEqual(commands)
  expect(commands).toEqual(["echo first", "echo $& second"])
  expect(skill.patterns[0].fixes[0].command).toBe("echo $1")
})

test("declining a resolved command prevents execution", async () => {
  const skill = new Skill()
  const commands: string[] = []
  const result = await skill.execute(
    {
      cwd: ".",
      errorOutput: "missing item",
      env: {},
      approve: async (fix) => {
        expect(fix.command).toBe("echo item")
        return false
      },
      execute: async (command) => {
        commands.push(command)
        return { success: true, exitCode: 0, stdout: "", stderr: "" }
      },
    },
    skill.match("missing item")!,
  )
  expect(result.success).toBe(false)
  expect(commands).toEqual([])
})
