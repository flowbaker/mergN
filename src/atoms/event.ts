import type { Schema } from './schema'

export interface EventEnvelope {
  id: string
  schema: Schema
  payload: unknown
  producedBy: string
}
