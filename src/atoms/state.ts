export type StepStatus = 'pending' | 'done' | 'failed' | 'skipped'

export interface StepRecord {
  runId: string
  nodeId: string
  funcId: string
  funcVersion: number
  attempt: number
  status: StepStatus
  idempotencyKey?: string
  resolvedInput: unknown
  output?: unknown
  error?: string
}

export interface RunLog {
  runId: string
  records: StepRecord[]
}
