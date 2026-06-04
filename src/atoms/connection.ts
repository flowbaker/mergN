export type ConnectionKind = 'oauth2' | 'apiKey' | 'basic'

export interface ConnectionRequirement {
  name: string
  provider: string
  scopes: string[]
}

export interface Connection {
  id: string
  provider: string
  kind: ConnectionKind
  account: string
  scopes: string[]
  vaultRef: string
  expiresAt?: string
}
