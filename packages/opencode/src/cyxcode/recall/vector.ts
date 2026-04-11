const MS_PER_DAY = 86_400_000

export function dot(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

export function decayFactor(now: number, createdAt: number, halfLifeDays = 30): number {
  const ageDays = Math.max(0, (now - createdAt) / MS_PER_DAY)
  return Math.exp(-Math.LN2 * (ageDays / halfLifeDays))
}

export type Scored<T> = { item: T; score: number }

export function topK<T>(scored: Scored<T>[], k: number, minScore = -Infinity): Scored<T>[] {
  return scored
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}
