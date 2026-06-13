export type Schema =
  | { type: 'string'; enum?: string[] }
  | { type: 'number' }
  | { type: 'boolean' }
  | { type: 'object'; properties?: Record<string, Schema>; required?: string[] }
  | { type: 'array'; items?: Schema }
  | { type: 'file' }
  | { type: 'any' }

export interface UiHint {
  widget?: 'text' | 'textarea' | 'select' | 'slider' | 'secret'
  label?: string
}
