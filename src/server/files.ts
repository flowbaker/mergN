import { randomUUID } from "node:crypto";
import type { DocStore } from "../store/docstore";
import type { BlobStore } from "../store/blobs";

const COLLECTION = "files";

// Max bytes a single uploaded file may have. Files are injected into step input
// over stdin (egress-locked sandbox), so this is bounded by the payload size.
export const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES) || 25 * 1024 * 1024;

export type FileSource = "user" | "workflow";

export interface FileMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
  source: FileSource;
  createdAt: string;
}

export interface FileService {
  upload(
    spaceId: string,
    file: { name: string; mime: string; body: Buffer; source?: FileSource },
  ): Promise<FileMeta>;
  list(spaceId: string): Promise<FileMeta[]>;
  get(spaceId: string, id: string): Promise<FileMeta | null>;
  content(spaceId: string, id: string): Promise<Buffer | null>;
  remove(spaceId: string, id: string): Promise<void>;
}

export function createFileService(store: DocStore, blobs: BlobStore): FileService {
  return {
    async upload(spaceId, file) {
      const id = randomUUID();
      await blobs.put(spaceId, id, file.body);
      const meta: FileMeta = {
        id,
        name: file.name.slice(0, 200) || "file",
        mime: file.mime || "application/octet-stream",
        size: file.body.length,
        source: file.source ?? "user",
        createdAt: new Date().toISOString(),
      };
      await store.put(spaceId, COLLECTION, id, meta as unknown as Record<string, unknown>);
      return meta;
    },

    async list(spaceId) {
      const docs = (await store.list(spaceId, COLLECTION)) as unknown as FileMeta[];
      return docs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async get(spaceId, id) {
      return (await store.get(spaceId, COLLECTION, id)) as unknown as FileMeta | null;
    },

    async content(spaceId, id) {
      const meta = await this.get(spaceId, id);
      if (!meta) return null;
      return blobs.get(spaceId, id);
    },

    async remove(spaceId, id) {
      await blobs.remove(spaceId, id).catch(() => {});
      await store.remove(spaceId, COLLECTION, id);
    },
  };
}
