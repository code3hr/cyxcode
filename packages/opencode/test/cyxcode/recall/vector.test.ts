import { describe, test, expect } from "bun:test"
import { dot, decayFactor, topK } from "../../../src/cyxcode/recall/vector"
import { toBlob, fromBlob } from "../../../src/cyxcode/recall/db"

describe("recall/vector", () => {
  describe("dot", () => {
    test("identical unit vectors score 1", () => {
      const a = new Float32Array([1, 0, 0])
      const b = new Float32Array([1, 0, 0])
      expect(dot(a, b)).toBeCloseTo(1, 6)
    })

    test("orthogonal unit vectors score 0", () => {
      const a = new Float32Array([1, 0, 0])
      const b = new Float32Array([0, 1, 0])
      expect(dot(a, b)).toBeCloseTo(0, 6)
    })

    test("opposite unit vectors score -1", () => {
      const a = new Float32Array([1, 0, 0])
      const b = new Float32Array([-1, 0, 0])
      expect(dot(a, b)).toBeCloseTo(-1, 6)
    })

    test("mismatched lengths return 0", () => {
      const a = new Float32Array([1, 0, 0])
      const b = new Float32Array([1, 0])
      expect(dot(a, b)).toBe(0)
    })

    test("computes a typical dot product", () => {
      const a = new Float32Array([0.5, 0.5, 0.5, 0.5])
      const b = new Float32Array([0.1, 0.2, 0.3, 0.4])
      expect(dot(a, b)).toBeCloseTo(0.5, 6)
    })
  })

  describe("decayFactor", () => {
    test("same timestamp returns 1", () => {
      const now = 1_700_000_000_000
      expect(decayFactor(now, now)).toBeCloseTo(1, 6)
    })

    test("one half-life ago returns 0.5", () => {
      const now = 1_700_000_000_000
      const created = now - 30 * 86_400_000
      expect(decayFactor(now, created, 30)).toBeCloseTo(0.5, 4)
    })

    test("two half-lives ago returns 0.25", () => {
      const now = 1_700_000_000_000
      const created = now - 60 * 86_400_000
      expect(decayFactor(now, created, 30)).toBeCloseTo(0.25, 4)
    })

    test("future timestamps clamp to 1", () => {
      const now = 1_700_000_000_000
      const future = now + 1_000_000_000
      expect(decayFactor(now, future)).toBeCloseTo(1, 6)
    })
  })

  describe("topK", () => {
    test("returns top-k in descending order", () => {
      const scored = [
        { item: "a", score: 0.1 },
        { item: "b", score: 0.9 },
        { item: "c", score: 0.5 },
        { item: "d", score: 0.7 },
      ]
      const out = topK(scored, 2)
      expect(out.map((s) => s.item)).toEqual(["b", "d"])
    })

    test("filters by minScore", () => {
      const scored = [
        { item: "a", score: 0.2 },
        { item: "b", score: 0.9 },
        { item: "c", score: 0.4 },
      ]
      const out = topK(scored, 5, 0.5)
      expect(out.map((s) => s.item)).toEqual(["b"])
    })

    test("respects limit smaller than qualifying rows", () => {
      const scored = [
        { item: "a", score: 0.9 },
        { item: "b", score: 0.8 },
        { item: "c", score: 0.7 },
      ]
      expect(topK(scored, 2).length).toBe(2)
    })
  })

  describe("toBlob / fromBlob roundtrip", () => {
    test("preserves every Float32 bit across 384 values", () => {
      const original = new Float32Array(384)
      for (let i = 0; i < 384; i++) original[i] = Math.sin(i) * 0.5
      const blob = toBlob(original)
      const restored = fromBlob(new Uint8Array(blob), 384)
      for (let i = 0; i < 384; i++) {
        expect(restored[i]).toBe(original[i])
      }
    })

    test("preserves extreme values", () => {
      const original = new Float32Array([0, -0, 1, -1, 1e-30, 1e30, Number.EPSILON, -Number.EPSILON])
      const restored = fromBlob(new Uint8Array(toBlob(original)), original.length)
      for (let i = 0; i < original.length; i++) {
        expect(restored[i]).toBe(original[i])
      }
    })
  })
})
