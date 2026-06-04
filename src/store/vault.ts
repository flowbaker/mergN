import { randomUUID } from "node:crypto";
import { store } from "./docstore";

export interface Vault {
  put(value: string): Promise<string>;
  get(ref: string): Promise<string | null>;
  remove(ref: string): Promise<void>;
}

const COLLECTION = "secrets";

class DocVault implements Vault {
  async put(value: string): Promise<string> {
    const ref = randomUUID();
    await store.put(COLLECTION, ref, { value });
    return ref;
  }

  async get(ref: string): Promise<string | null> {
    const doc = await store.get(COLLECTION, ref);
    return doc ? (doc.value as string) : null;
  }

  async remove(ref: string): Promise<void> {
    await store.remove(COLLECTION, ref);
  }
}

export const vault: Vault = new DocVault();
