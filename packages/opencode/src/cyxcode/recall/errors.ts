export type RecallErrorCode =
  | "embedder-disabled"
  | "model-load-failed"
  | "db-corrupt"
  | "db-open-failed"
  | "reconcile-failed"

export class RecallError extends Error {
  readonly code: RecallErrorCode

  constructor(code: RecallErrorCode, opts?: { cause?: unknown; message?: string }) {
    super(opts?.message ?? code, opts?.cause ? { cause: opts.cause } : undefined)
    this.code = code
    this.name = "RecallError"
  }
}

export function isRecallError(e: unknown): e is RecallError {
  return e instanceof RecallError
}
