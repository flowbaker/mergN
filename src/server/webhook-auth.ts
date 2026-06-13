import { createHmac, timingSafeEqual } from "node:crypto";
import type { DocStore } from "../store/docstore";
import type { Vault } from "../store/vault";

// Inbound webhook authentication. A workflow's webhook can require the caller to
// prove itself; we verify BEFORE running the workflow. Config is kept separate
// from the workflow doc (so a normal save can't wipe it) and the secret lives in
// the Vault (encrypted at rest), referenced by `ref`.

export type WebhookAuthType = "none" | "hmac" | "basic" | "bearer" | "jwt";

// Signature headers tried (in order) when the user doesn't name one — covers
// the common providers (GitHub, Stripe, generic).
const COMMON_SIG_HEADERS = [
  "x-signature",
  "x-hub-signature-256",
  "x-hub-signature",
  "stripe-signature",
  "x-webhook-signature",
  "x-signature-256",
  "signature",
];

export interface WebhookAuthConfig {
  type: WebhookAuthType;
  header?: string; // signature header (hmac) or token header (jwt/bearer)
  ref?: string; // vault ref to the secret
}

const COLLECTION = "webhook_auth";

function tEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function hmacHex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

// --- pure verification (exported for the self-test) ---

function verifyConfig(
  type: WebhookAuthType,
  header: string | undefined,
  secret: string,
  headers: Record<string, string>,
  rawBody: string,
): boolean {
  const h = (name: string) => headers[name.toLowerCase()] ?? "";
  switch (type) {
    case "none":
      return true;
    case "hmac": {
      // Generic HMAC-SHA256. Auto-handles the common provider shapes without a
      // per-provider preset: a plain hex/base64 signature, a `sha256=…` prefix
      // (GitHub), or a compound `t=…,v1=…` header (Stripe). Tries signing both
      // the raw body and `timestamp.body`, in hex and base64. Any match passes.
      // Try the named header first, then the common ones — so a wrong/guessed
      // header (e.g. "x-signature" for a Stripe webhook that actually sends
      // "stripe-signature") still verifies. Trying more headers can't help a
      // forger; they still need the secret.
      const names = header
        ? [header, ...COMMON_SIG_HEADERS.filter((n) => n !== header)]
        : COMMON_SIG_HEADERS;
      for (const name of names) {
        const raw = h(name);
        if (!raw) continue;
        let sig = raw;
        let ts: string | undefined;
        if (raw.includes(",")) {
          const parts: Record<string, string> = {};
          for (const kv of raw.split(",")) {
            const i = kv.indexOf("=");
            if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
          }
          ts = parts["t"] ?? parts["timestamp"];
          sig = parts["v1"] ?? parts["v0"] ?? parts["s"] ?? parts["sha256"] ?? sig;
        } else if (/^[a-z0-9]+=/i.test(raw)) {
          sig = raw.replace(/^[a-z0-9]+=/i, ""); // strip "sha256=" / "sha1="
        }
        const payloads = ts ? [`${ts}.${rawBody}`, rawBody] : [rawBody];
        for (const p of payloads) {
          const hex = createHmac("sha256", secret).update(p).digest("hex");
          const b64 = createHmac("sha256", secret).update(p).digest("base64");
          if (tEq(sig, hex) || tEq(sig, b64)) {
            if (ts) {
              let t = Number(ts);
              if (t > 1e12) t = Math.floor(t / 1000); // ms → s
              if (
                Number.isFinite(t) &&
                Math.abs(Math.floor(Date.now() / 1000) - t) > 900
              )
                continue; // 15-minute replay window when a timestamp is signed
            }
            return true;
          }
        }
      }
      return false;
    }
    case "basic": {
      const auth = h("authorization");
      const m = /^Basic\s+(.+)$/i.exec(auth);
      if (!m) return false;
      const decoded = Buffer.from(m[1], "base64").toString("utf8");
      return tEq(decoded, secret); // secret = "user:pass"
    }
    case "bearer": {
      const auth = h(header || "authorization");
      const m = /^Bearer\s+(.+)$/i.exec(auth);
      if (!m) return false;
      return tEq(m[1].trim(), secret);
    }
    case "jwt": {
      const auth = h(header || "authorization");
      const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1] ?? auth;
      const parts = token.split(".");
      if (parts.length !== 3) return false;
      const expected = createHmac("sha256", secret)
        .update(`${parts[0]}.${parts[1]}`)
        .digest("base64url");
      if (!tEq(parts[2], expected)) return false;
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf8"),
        );
        if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp)
          return false;
      } catch {
        return false;
      }
      return true;
    }
    default:
      return false;
  }
}

// Build a correctly-authed sample request (used by the self-test).
function sampleRequest(
  type: WebhookAuthType,
  header: string | undefined,
  secret: string,
): { headers: Record<string, string>; rawBody: string } {
  const rawBody = JSON.stringify({ test: true });
  switch (type) {
    case "hmac":
      return {
        rawBody,
        headers: { [(header || "x-signature").toLowerCase()]: hmacHex(secret, rawBody) },
      };
    case "basic":
      return {
        rawBody,
        headers: {
          authorization: "Basic " + Buffer.from(secret).toString("base64"),
        },
      };
    case "bearer":
      return {
        rawBody,
        headers: { [(header || "authorization").toLowerCase()]: "Bearer " + secret },
      };
    case "jwt": {
      const head = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({ test: true, iat: Math.floor(Date.now() / 1000) }),
      ).toString("base64url");
      const sig = createHmac("sha256", secret)
        .update(`${head}.${payload}`)
        .digest("base64url");
      return {
        rawBody,
        headers: {
          [(header || "authorization").toLowerCase()]: `Bearer ${head}.${payload}.${sig}`,
        },
      };
    }
    default:
      return { rawBody, headers: {} };
  }
}

export interface WebhookAuthStore {
  // verify an incoming request; true = allowed
  verify(
    spaceId: string,
    workflowId: string,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<boolean>;
  set(
    spaceId: string,
    workflowId: string,
    input: { type: WebhookAuthType; header?: string; secret?: string },
  ): Promise<void>;
  getPublic(
    spaceId: string,
    workflowId: string,
  ): Promise<{ type: WebhookAuthType; header?: string }>;
  selfTest(spaceId: string, workflowId: string): Promise<boolean>;
}

export function createWebhookAuthStore(
  store: DocStore,
  vault: Vault,
): WebhookAuthStore {
  async function read(
    spaceId: string,
    workflowId: string,
  ): Promise<WebhookAuthConfig | null> {
    return (await store.get(
      spaceId,
      COLLECTION,
      workflowId,
    )) as unknown as WebhookAuthConfig | null;
  }

  return {
    async verify(spaceId, workflowId, headers, rawBody) {
      const cfg = await read(spaceId, workflowId);
      if (!cfg || cfg.type === "none") return true; // no auth configured
      if (!cfg.ref) return false;
      const secret = await vault.get(spaceId, cfg.ref);
      if (secret == null) return false;
      return verifyConfig(cfg.type, cfg.header, secret, headers, rawBody);
    },

    async set(spaceId, workflowId, input) {
      const prev = await read(spaceId, workflowId);
      if (input.type === "none") {
        if (prev?.ref) await vault.remove(spaceId, prev.ref).catch(() => {});
        await store.remove(spaceId, COLLECTION, workflowId);
        return;
      }
      // No new secret: keep the existing one if the method is unchanged (lets a
      // user tweak the header without re-entering the secret). Otherwise nothing
      // to store yet.
      if (!input.secret) {
        if (prev?.ref && prev.type === input.type) {
          await store.put(spaceId, COLLECTION, workflowId, {
            type: input.type,
            header: input.header,
            ref: prev.ref,
          } as unknown as Record<string, unknown>);
        }
        return;
      }
      if (prev?.ref) await vault.remove(spaceId, prev.ref).catch(() => {});
      const ref = await vault.put(spaceId, input.secret);
      await store.put(spaceId, COLLECTION, workflowId, {
        type: input.type,
        header: input.header,
        ref,
      } as unknown as Record<string, unknown>);
    },

    async getPublic(spaceId, workflowId) {
      const cfg = await read(spaceId, workflowId);
      if (!cfg) return { type: "none" };
      return { type: cfg.type, header: cfg.header };
    },

    async selfTest(spaceId, workflowId) {
      const cfg = await read(spaceId, workflowId);
      if (!cfg || cfg.type === "none" || !cfg.ref) return false;
      const secret = await vault.get(spaceId, cfg.ref);
      if (secret == null) return false;
      const sample = sampleRequest(cfg.type, cfg.header, secret);
      return verifyConfig(
        cfg.type,
        cfg.header,
        secret,
        sample.headers,
        sample.rawBody,
      );
    },
  };
}
