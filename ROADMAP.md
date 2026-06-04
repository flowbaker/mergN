# Workflow Builder — Roadmap

AI-native workflow automation. The AI authors func bodies + schemas on demand
(via tool calls); the engine runs them deterministically. No pre-built
integration nodes like n8n — the code is generated.

## Current state (built)

- **`src/atoms/`** — core model: Func (pure/effectful discriminated union),
  Connection, State (append-only run log), Event, Trigger. Ports with
  literal|ref bindings (no expression language).
- **`src/engine/`** — step-granular engine: Scheduler (reconciling, frontier
  derived from log), Worker (resolve → inject → idempotent execute → append),
  Queue, RunLog, in-memory impls.
- **`src/agent/`** — func-author agent (Vercel AI SDK + Gemini). Produces a
  validated FuncDefinition + human title/summary from an intent.
- **`src/server/`** — Hono server: chat agent (author_func + wire tools),
  workflow CRUD (file store under `data/`), `/api/run` (runs an authored
  workflow through the engine; real Slack via env, others stubbed).
- **`web/`** — Vite + React 19 + shadcn (dark) + React Flow. Chat builder,
  workflows side panel, run panel, custom node cards, FuncDetail modal
  (CodeMirror + Prettier), token usage, TanStack Query.

End to end: describe in chat → nodes appear → save → run → real Slack message.

## Next steps (open)

1. ~~**Provider registry**~~ — DONE. `src/providers/registry.ts` holds typed
   provider specs (id, scopes, apiDoc, env, createClient). `providerDocs()`
   feeds the func-author system prompt so the AI authors against known provider
   APIs and picks the right `provider`. `buildClient(providerId)` builds the
   real client per connection in the run (env creds, stub fallback). Providers:
   Slack (real, SLACK_TOKEN) + HTTP (real, get/post). Engine boundary stays
   provider-agnostic (`ProviderClient` opaque) by design; the registry is the
   typed layer. Add new providers by adding one entry. NEXT: SMTP, Stripe;
   credentials from a vault instead of env (ties to item 5).
   Discovery scales via a `search_providers` tool + AI SDK **dynamic tool
   loading** (`prepareStep` + `activeTools`): each provider is a `provider_<id>`
   tool that is inactive until a search surfaces it, so only the searched
   provider's schema reaches the model — not all of them. (Also migrated
   func-author off deprecated `generateObject` → `generateText` + `Output.object`.)
2. ~~**Streaming run**~~ — DONE. `/api/run` streams per-step records via SSE
   (Hono `streamSSE`); RunPanel reads the stream incrementally and nodes light
   up live (pending = amber pulse → done = green / failed = red). 180ms per-step
   delay so the run is watchable.
3. **Sandbox** — `EvalRuntime` uses `new Function` (runs AI code in-process,
   unsafe for prod). Swap behind the `Runtime` interface for isolated-vm /
   microVM, with a capability broker so the body has no raw tokens / no network
   (all effects via broker). Pure funcs: deny-all network + deterministic.
4. **Richer wiring** — wires currently become ref bindings only. Add `dependsOn`
   (ordering-only edges) and type-checking on connect (output schema vs input
   port); offer an AI-authored adapter when types do not match.
5. **Real connections / auth** — OAuth connect flow + vault for credentials
   (not env). Per-connection scopes, refresh, revocation.
6. **Idempotency + retry in run** — wire the write-ahead + provider-key protocol
   and per-`dangerClass` retry policy into the actual run path.

## Key decisions (so we do not relitigate)

- binding = pure pointer; transformation = an adapter func, not an expression.
- idempotency key = `runId + funcId` (action identity), not input hash.
- step-granular queue; log is truth, queue is the fast path.
- capability injection: body calls `ctx.connections.<name>`, never sees tokens.
- AI is authoring-time only; runtime is frozen + deterministic (enables
  resume/rewind/replay).
- canvas = projection of the model; conform to n8n interaction, diverge on
  architecture.
