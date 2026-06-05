import { randomUUID } from "node:crypto";
import type { DocStore } from "./docstore";

export interface Vault {
  put(spaceId: string, value: string): Promise<string>;
  get(spaceId: string, ref: string): Promise<string | null>;
  remove(spaceId: string, ref: string): Promise<void>;
}

const COLLECTION = "secrets";

export class DocVault implements Vault {
  constructor(private store: DocStore) {}

  async put(spaceId: string, value: string): Promise<string> {
    const ref = randomUUID();
    await this.store.put(spaceId, COLLECTION, ref, { value });
    return ref;
  }

  async get(spaceId: string, ref: string): Promise<string | null> {
    const doc = await this.store.get(spaceId, COLLECTION, ref);
    return doc ? (doc.value as string) : null;
  }

  async remove(spaceId: string, ref: string): Promise<void> {
    await this.store.remove(spaceId, COLLECTION, ref);
  }
}
