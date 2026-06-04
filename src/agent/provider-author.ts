import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type { ProviderDraft } from "../providers/registry";

export const providerDraftZ = z.object({
  id: z.string().describe("lowercase short id, e.g. 'notion'"),
  name: z.string().describe("display name, e.g. 'Notion'"),
  keywords: z.array(z.string()).describe("search keywords for this provider"),
  authEnv: z
    .string()
    .describe(
      "env var name holding the API token/key, e.g. 'NOTION_TOKEN'. Empty string only if the API needs no auth.",
    ),
  egressDomain: z
    .string()
    .describe("the single API hostname this provider talks to, e.g. 'api.notion.com'"),
  apiDoc: z
    .string()
    .describe(
      "how a func should call this connection: the methods, their args, and what each returns. Reference ctx.connections.<name>.<method>(...).",
    ),
  clientSource: z
    .string()
    .describe(
      "JS function BODY that receives a `token` variable and returns an object of async methods that call the real API with fetch using the token. Ends with 'return { ... }'. No function/async wrapper.",
    ),
});

const SYSTEM = [
  "You author an external service 'provider' for a workflow automation system.",
  "A provider is a typed client over a real HTTP API. Funcs call it via ctx.connections.<name>.<method>(...).",
  "clientSource is a JavaScript function BODY that receives a `token` and returns an object of async methods. Each method calls the real API with fetch and the token (e.g. headers: { Authorization: `Bearer ${token}` }). It must end with 'return { ... }' and have NO function/async wrapper.",
  "Use only API-key / bearer style auth (a single token). authEnv is the env var name for that token; use empty string only if the API truly needs none.",
  "egressDomain is the single hostname the client talks to.",
  "Use your knowledge of the service's real REST API. Keep methods focused on the few most common actions. Each method must be async and return parsed JSON.",
].join("\n");

export async function authorProvider(
  service: string,
  docs?: string,
): Promise<ProviderDraft> {
  const { output } = await generateText({
    model: google(process.env.GEMINI_MODEL ?? "gemini-2.5-flash"),
    output: Output.object({ schema: providerDraftZ }),
    system: SYSTEM,
    prompt: [`Service: ${service}`, docs ? `API docs / notes: ${docs}` : ""].join(
      "\n",
    ),
  });
  return {
    ...output,
    id: output.id.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
  };
}
