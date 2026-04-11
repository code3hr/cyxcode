export const RECALL_MODEL = "Xenova/all-MiniLM-L6-v2"
export const RECALL_DIM = 384

export type VectorSource = "memory" | "learned" | "pattern-learned"

export type Similar = {
  id: string
  source: VectorSource
  sourceId: string
  text: string
  score: number
  createdAt: number
  meta: Record<string, unknown>
}

export type Fact = {
  id: string
  subject: string
  predicate: string
  object: string
  validFrom: number
  validUntil: number | null
  sourceEvent: string | null
  meta: Record<string, unknown>
}

export type Triple = {
  subject: string
  predicate: string
  object: string
}

export type RecordFactOpts = {
  validFrom?: number
  validUntil?: number
  sourceEvent?: string
  meta?: Record<string, unknown>
}

export type SimilarOpts = {
  limit?: number
  minScore?: number
  sources?: VectorSource[]
  decay?: boolean
}

export type FactsAboutOpts = {
  predicate?: string
  at?: number
}

export type ReindexStats = {
  memoryIndexed: number
  learnedIndexed: number
  skipped: number
  errors: number
}

export type RecallStats = {
  vectors: number
  facts: number
  disabled: boolean
}

export type VectorRow = {
  id: string
  source: VectorSource
  sourceId: string
  text: string
  embedding: Float32Array
  dim: number
  model: string
  createdAt: number
  accessedAt: number
  accessCount: number
  meta: Record<string, unknown>
}
