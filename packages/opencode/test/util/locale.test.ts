import { describe, expect, test } from "bun:test"
import { Locale } from "../../src/util/locale"

describe("Locale.duration", () => {
  test("formats multi-day durations with remaining hours", () => {
    expect(Locale.duration(2 * 86400000 + 3 * 3600000)).toBe("2d 3h")
  })
})
