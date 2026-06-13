import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { assertSpace } from "./docstore";

// Raw file-bytes store (separate from the DocStore/Vault). Self-host writes to
// local disk; managed uses S3/Garage. Keys are opaque ids; the file metadata
// (name, mime, size) lives in the DocStore `files` collection alongside.
export interface BlobStore {
  put(spaceId: string, key: string, body: Buffer): Promise<void>;
  get(spaceId: string, key: string): Promise<Buffer | null>;
  remove(spaceId: string, key: string): Promise<void>;
}

const SAFE = /^[A-Za-z0-9_-]+$/;
function safeKey(key: string): string {
  if (!SAFE.test(key)) throw new Error("invalid blob key");
  return key;
}

class LocalBlobStore implements BlobStore {
  constructor(private root: string) {}
  private path(spaceId: string, key: string): string {
    return join(this.root, assertSpace(spaceId), safeKey(key));
  }
  async put(spaceId: string, key: string, body: Buffer): Promise<void> {
    const p = this.path(spaceId, key);
    await mkdir(join(this.root, assertSpace(spaceId)), { recursive: true });
    await writeFile(p, body);
  }
  async get(spaceId: string, key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.path(spaceId, key));
    } catch {
      return null;
    }
  }
  async remove(spaceId: string, key: string): Promise<void> {
    await rm(this.path(spaceId, key), { force: true });
  }
}

class S3BlobStore implements BlobStore {
  private client: S3Client;
  constructor(private bucket: string, config: S3ClientConfig) {
    this.client = new S3Client(config);
  }
  private key(spaceId: string, key: string): string {
    return `files/${assertSpace(spaceId)}/${safeKey(key)}`;
  }
  async put(spaceId: string, key: string, body: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: this.key(spaceId, key), Body: body }),
    );
  }
  async get(spaceId: string, key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.key(spaceId, key) }),
      );
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }
  async remove(spaceId: string, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(spaceId, key) }),
    );
  }
}

export function createBlobStore(): BlobStore {
  if (process.env.FILE_DRIVER === "s3") {
    const opts: S3ClientConfig = {};
    if (process.env.S3_REGION) opts.region = process.env.S3_REGION;
    if (process.env.S3_ENDPOINT) opts.endpoint = process.env.S3_ENDPOINT;
    if (process.env.S3_FORCE_PATH_STYLE === "true") opts.forcePathStyle = true;
    return new S3BlobStore(
      process.env.FILE_S3_BUCKET || process.env.S3_BUCKET || "mergn-files",
      opts,
    );
  }
  return new LocalBlobStore(join(process.cwd(), "data", "files"));
}
