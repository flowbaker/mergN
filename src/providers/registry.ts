import type { ProviderClient } from "../atoms/index";

export interface ProviderSpec {
  id: string;
  name: string;
  scopes: string[];
  keywords: string[];
  apiDoc: string;
  env?: string;
  createClient: (token: string | undefined) => ProviderClient;
}

export const providers: Record<string, ProviderSpec> = {
  slack: {
    id: "slack",
    name: "Slack",
    scopes: ["chat:write", "channels:read"],
    keywords: [
      "slack",
      "message",
      "notify",
      "notification",
      "chat",
      "channel",
      "alert",
    ],
    apiDoc:
      "give the func a 'channel' input and a 'text' input, then call: const ts = await ctx.connections.<name>.postMessage(input.channel, input.text); return { ts }. Connection: name 'slack', provider 'slack', scope 'chat:write'.",
    env: "SLACK_TOKEN",
    createClient: (token) => {
      const send = async (a: unknown, b?: unknown): Promise<string> => {
        const arg =
          typeof a === "object" && a !== null
            ? (a as Record<string, unknown>)
            : null;
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
  },

  http: {
    id: "http",
    name: "HTTP",
    scopes: [],
    keywords: [
      "http",
      "https",
      "api",
      "fetch",
      "request",
      "rest",
      "url",
      "webhook",
      "get",
      "post",
    ],
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
  },
};

export function getProvider(id: string): ProviderSpec | undefined {
  return providers[id];
}

export function searchProviders(query: string): ProviderSpec[] {
  const q = query.toLowerCase().trim();
  if (!q) return Object.values(providers);
  const terms = q.split(/\s+/);
  return Object.values(providers).filter((p) => {
    const hay = [p.id, p.name, p.apiDoc, ...p.keywords].join(" ").toLowerCase();
    return terms.some((t) => hay.includes(t));
  });
}

export function buildClient(providerId: string): ProviderClient | null {
  const spec = providers[providerId];
  if (!spec) return null;
  if (spec.env && !process.env[spec.env]) return null;
  return spec.createClient(spec.env ? process.env[spec.env] : undefined);
}
