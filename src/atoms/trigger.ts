import type { Schema } from './schema'

export type TriggerKind = 'webhook' | 'schedule' | 'poll' | 'manual' | 'internal'

export interface Trigger {
  id: string
  kind: TriggerKind
  outputSchema: Schema
  connection?: string
}
