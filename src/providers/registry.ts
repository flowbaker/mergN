import { store } from "../store/docstore";
import type { ProviderClient } from "../atoms/index";

const COLLECTION = "providers";

export interface ProviderSpec {
  id: string;
  name: string;
  scopes: string[];
  keywords: string[];
  apiDoc: string;
  env?: string;
  egressDomain?: string;
  aiWritten?: boolean;
  createClient: (token: string | undefined) => ProviderClient;
}

export interface ProviderDraft {
  id: string;
  name: string;
  keywords: string[];
  authEnv: string;
  egressDomain: string;
  apiDoc: string;
  clientSource: string;
}

const registry = new Map<string, ProviderSpec>();

registry.set("slack", {
  id: "slack",
  name: "Slack",
  scopes: ["chat:write", "channels:read"],
  keywords: ["slack", "message", "notify", "notification", "chat", "channel", "alert"],
  egressDomain: "slack.com",
  apiDoc:
    "give the func a 'channel' input and a 'text' input, then call: const ts = await ctx.connections.<name>.postMessage(input.channel, input.text); return { ts }. Connection: name 'slack', provider 'slack', scope 'chat:write'.",
  env: "SLACK_TOKEN",
  createClient: (token) => {
    const send = async (a: unknown, b?: unknown): Promise<string> => {
      const arg =
        typeof a === "object" && a !== null ? (a as Record<string, unknown>) : null;
      const channel = arg ? arg.channel : a;
      const text = arg ? arg.text : b;
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ channel, text }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        ts?: string;
        error?: string;
      };
      if (!data.ok) throw new Error(`slack error: ${data.error}`);
      return data.ts ?? "";
    };
    return new Proxy({}, { get: () => send });
  },
});

registry.set("http", {
  id: "http",
  name: "HTTP",
  scopes: [],
  keywords: ["http", "https", "api", "fetch", "request", "rest", "url", "webhook", "get", "post"],
  apiDoc:
    "call: const data = await ctx.connections.<name>.get(url); (returns parsed JSON) or .post(url, jsonBody). Connection: name 'http', provider 'http', no scopes.",
  createClient: () => ({
    get: async (url: unknown) => {
      const res = await fetch(String(url));
      return res.json();
    },
    post: async (url: unknown, body: unknown) => {
      const res = await fetch(String(url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    },
  }),
});

function guardedFetch(domain: string) {
  return async (input: unknown, init?: unknown): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : String(input);
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      throw new Error("egress blocked: invalid url");
    }
    const allowed = host === domain || host.endsWith(`.${domain}`);
    if (!allowed) {
      throw new Error(`egress blocked: ${host} (allowed: ${domain})`);
    }
    return fetch(url, init as RequestInit | undefined);
  };
}

function specFromDraft(d: ProviderDraft): ProviderSpec {
  return {
    id: d.id,
    name: d.name,
    scopes: [],
    keywords: d.keywords,
    apiDoc: d.apiDoc,
    env: d.authEnv || undefined,
    egressDomain: d.egressDomain,
    aiWritten: true,
    createClient: (token) => {
      const scopedFetch = d.egressDomain ? guardedFetch(d.egressDomain) : fetch;
      const factory = new Function("token", "fetch", d.clientSource);
      return factory(token, scopedFetch) as ProviderClient;
    },
  };
}

export function registerProviderFromDraft(draft: ProviderDraft): ProviderSpec {
  const spec = specFromDraft(draft);
  registry.set(spec.id, spec);
  return spec;
}

export async function persistProvider(draft: ProviderDraft): Promise<void> {
  await store.put(COLLECTION, draft.id, draft as unknown as Record<string, unknown>);
}

export async function loadPersistedProviders(): Promise<void> {
  const docs = (await store.list(COLLECTION)) as unknown as ProviderDraft[];
  for (const draft of docs) {
    try {
      registerProviderFromDraft(draft);
    } catch {
      continue;
    }
  }
}

export function getProvider(id: string): ProviderSpec | undefined {
  return registry.get(id);
}

export function searchProviders(query: string): ProviderSpec[] {
  const q = query.toLowerCase().trim();
  const all = [...registry.values()];
  if (!q) return all;
  const terms = q.split(/\s+/);
  return all.filter((p) => {
    const hay = [p.id, p.name, p.apiDoc, ...p.keywords].join(" ").toLowerCase();
    return terms.some((t) => hay.includes(t));
  });
}

export function needsAuth(providerId: string): boolean {
  const spec = registry.get(providerId);
  return !!spec?.env;
}

export function buildClientWithSecret(
  providerId: string,
  secret: string | undefined,
): ProviderClient | null {
  const spec = registry.get(providerId);
  if (!spec) return null;
  if (spec.env && !secret) return null;
  return spec.createClient(secret);
}
