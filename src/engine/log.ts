import type { StepRecord, RunLog } from '../atoms/index'

export interface RunLogStore {
  append(record: StepRecord): Promise<void>
  get(runId: string): Promise<RunLog>
  getStep(runId: string, nodeId: string): Promise<StepRecord | null>
}
