import { randomUUID } from "node:crypto";
import { store } from "../store/docstore";
import { vault } from "../store/vault";

const COLLECTION = "connections";

export interface ConnectionDoc {
  id: string;
  provider: string;
  kind: "apiKey";
  account?: string;
  scopes: string[];
  vaultRef: string;
  createdAt: string;
}

export interface ConnectionMeta {
  id: string;
  provider: string;
  account?: string;
  createdAt: string;
}

function toMeta(c: ConnectionDoc): ConnectionMeta {
  return { id: c.id, provider: c.provider, account: c.account, createdAt: c.createdAt };
}

export async function listConnections(): Promise<ConnectionMeta[]> {
  const docs = (await store.list(COLLECTION)) as unknown as ConnectionDoc[];
  return docs
    .map(toMeta)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function createApiKeyConnection(
  provider: string,
  key: string,
  account?: string,
): Promise<ConnectionMeta> {
  const vaultRef = await vault.put(key);
  const doc: ConnectionDoc = {
    id: randomUUID(),
    provider,
    kind: "apiKey",
    account,
    scopes: [],
    vaultRef,
    createdAt: new Date().toISOString(),
  };
  await store.put(COLLECTION, doc.id, doc as unknown as Record<string, unknown>);
  return toMeta(doc);
}

export async function deleteConnection(id: string): Promise<void> {
  const doc = (await store.get(COLLECTION, id)) as unknown as ConnectionDoc | null;
  if (doc?.vaultRef) await vault.remove(doc.vaultRef);
  await store.remove(COLLECTION, id);
}

export async function firstConnectionFor(
  provider: string,
): Promise<ConnectionDoc | null> {
  const docs = (await store.list(COLLECTION)) as unknown as ConnectionDoc[];
  const matches = docs
    .filter((c) => c.provider === provider)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return matches[0] ?? null;
}

export async function resolveProviderSecret(
  provider: string,
): Promise<string | null> {
  const conn = await firstConnectionFor(provider);
  if (conn) return vault.get(conn.vaultRef);
  return null;
}
