import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  streamText,
  convertToModelMessages,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { authorFunc } from "../agent/func-author";
import {
  listWorkflows,
  getWorkflow,
  saveWorkflow,
  deleteWorkflow,
} from "./store";
import { runWorkflow } from "./run";
import {
  searchProviders,
  registerProviderFromDraft,
  persistProvider,
  loadPersistedProviders,
} from "../providers/registry";
import { authorProvider } from "../agent/provider-author";
import {
  listConnections,
  createApiKeyConnection,
  deleteConnection,
} from "./connections";
import type { FuncDefinition } from "../atoms/index";

const SYSTEM = [
  "You are a workflow builder assistant for an AI-native automation product.",
  "The user describes automations in natural language; you help them design the workflow.",
  "A workflow is made of typed 'funcs' (steps) wired together.",
  "For a PURE data transform (no external service), call author_func.",
  "For a step that uses an external service: FIRST call search_providers. If a provider matches, call author_func with that provider id. If NONE matches, call create_provider with the service name to generate one, then call author_func with the new provider id.",
  "For a multi-step workflow: author every step first, then connect them with the wire tool (an upstream output field into a downstream input, using the exact ids and names you created).",
  "Keep replies short. After building, briefly summarize the steps and how they connect.",
].join("\n");

function funcToWire(func: FuncDefinition, title: string, summary: string) {
  return {
    id: func.id,
    title,
    summary,
    version: func.version,
    kind: func.kind,
    pure: func.pure,
    inputs: func.inputs.map((p) => ({
      name: p.name,
      role: p.role,
      type: p.schema.type,
      required: p.required,
    })),
    outputSchema: func.outputSchema,
    bodySource: func.body.source,
    requires: func.pure ? [] : func.requires,
    dangerClass: func.pure ? null : func.effect.dangerClass,
    idempotency: func.pure ? null : func.effect.idempotency,
  };
}

const tools = {
  search_providers: tool({
    description:
      "Search available external providers by keyword. Returns matches with their connection API. If nothing matches, use create_provider.",
    inputSchema: z.object({
      query: z.string().describe("keywords, e.g. 'slack message' or 'notion page'"),
    }),
    execute: async ({ query }) =>
      searchProviders(query).map((p) => ({
        id: p.id,
        name: p.name,
        scopes: p.scopes,
        apiDoc: p.apiDoc,
      })),
  }),
  create_provider: tool({
    description:
      "Generate a NEW external provider when search_providers returns nothing for the service you need. Then call author_func with the returned provider id.",
    inputSchema: z.object({
      service: z.string().describe("the service name, e.g. 'Notion'"),
      docsUrl: z
        .string()
        .optional()
        .describe("optional API docs URL or notes to ground the client"),
    }),
    execute: async ({ service, docsUrl }) => {
      const draft = await authorProvider(service, docsUrl);
      registerProviderFromDraft(draft);
      await persistProvider(draft);
      return {
        id: draft.id,
        name: draft.name,
        apiDoc: draft.apiDoc,
        authEnv: draft.authEnv,
        egressDomain: draft.egressDomain,
      };
    },
  }),
  author_func: tool({
    description:
      "Author a step from an intent. For a pure transform, omit provider. For an external-service step, pass the provider id (from search_providers or create_provider).",
    inputSchema: z.object({
      intent: z
        .string()
        .describe("what the step should do, in one sentence"),
      provider: z
        .string()
        .optional()
        .describe("provider id, if this step calls an external service"),
    }),
    execute: async ({ intent, provider }) => {
      const r = await authorFunc({ intent, provider });
      return funcToWire(r.def, r.title, r.summary);
    },
  }),
  wire: tool({
    description:
      "Connect two funcs by feeding the upstream func's output into the downstream func's input. Call after the funcs are authored.",
    inputSchema: z.object({
      sourceFunc: z.string().describe("upstream func id (the step data comes from)"),
      targetFunc: z.string().describe("downstream func id (the step data goes to)"),
      outputField: z
        .string()
        .optional()
        .describe("output field name of the source func"),
      inputName: z
        .string()
        .optional()
        .describe("input name of the target func"),
    }),
    execute: async ({ sourceFunc, targetFunc, outputField, inputName }) => ({
      from: sourceFunc,
      to: targetFunc,
      fromOutput: outputField ?? "",
      toInput: inputName ?? "",
    }),
  }),
};

const app = new Hono();

app.post("/api/chat", async (c) => {
  const { messages } = await c.req.json<{ messages: UIMessage[] }>();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google(process.env.GEMINI_MODEL ?? "gemini-2.5-flash"),
    system: SYSTEM,
    messages: modelMessages,
    stopWhen: stepCountIs(20),
    tools,
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === "finish") {
        return { totalUsage: part.totalUsage };
      }
      return undefined;
    },
    onError: (error) => {
      console.error("STREAM ERROR:", error);
      return error instanceof Error ? error.message : String(error);
    },
  });
});

app.get("/api/workflows", async (c) => {
  return c.json(await listWorkflows());
});

app.get("/api/workflows/:id", async (c) => {
  const wf = await getWorkflow(c.req.param("id"));
  return wf ? c.json(wf) : c.json({ error: "not found" }, 404);
});

app.put("/api/workflows/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return c.json({ error: "bad id" }, 400);
  const body = await c.req.json<{
    name?: string;
    funcs?: unknown[];
    wires?: unknown[];
    positions?: Record<string, { x: number; y: number }>;
    config?: Record<string, Record<string, string>>;
  }>();
  const wf = await saveWorkflow({
    id,
    name: body.name ?? "untitled",
    funcs: body.funcs ?? [],
    wires: body.wires ?? [],
    positions: body.positions ?? {},
    config: body.config ?? {},
  });
  return c.json(wf);
});

app.delete("/api/workflows/:id", async (c) => {
  await deleteWorkflow(c.req.param("id"));
  return c.json({ ok: true });
});

app.post("/api/run", async (c) => {
  const body = await c.req.json<{
    funcs?: Parameters<typeof runWorkflow>[0];
    wires?: Parameters<typeof runWorkflow>[1];
    input?: Record<string, unknown>;
    config?: Record<string, Record<string, string>>;
  }>();
  return streamSSE(c, async (stream) => {
    await runWorkflow(
      body.funcs ?? [],
      body.wires ?? [],
      body.input ?? {},
      body.config ?? {},
      async (record) => {
        await stream.writeSSE({ data: JSON.stringify(record) });
      },
    );
    await stream.writeSSE({ data: "[DONE]" });
  });
});

app.get("/api/connections", async (c) => {
  return c.json(await listConnections());
});

app.post("/api/connections", async (c) => {
  const body = await c.req.json<{
    provider?: string;
    key?: string;
    account?: string;
  }>();
  if (!body.provider || !body.key) {
    return c.json({ error: "provider and key required" }, 400);
  }
  return c.json(
    await createApiKeyConnection(body.provider, body.key, body.account),
  );
});

app.delete("/api/connections/:id", async (c) => {
  await deleteConnection(c.req.param("id"));
  return c.json({ ok: true });
});

await loadPersistedProviders();

serve({ fetch: app.fetch, port: 8787 }, (info) => {
  console.log(`chat server on http://localhost:${info.port}`);
});
