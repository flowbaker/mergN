import { useState, type ReactNode } from "react";
import type { AuthoredFunc } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeBlock } from "./CodeBlock";
import {
  useConnections,
  useCreateConnection,
  useDeleteConnection,
} from "./queries";

function ProviderConnection({ provider }: { provider: string }) {
  const { data: conns = [] } = useConnections();
  const create = useCreateConnection();
  const del = useDeleteConnection();
  const [key, setKey] = useState("");
  const conn = conns.find((c) => c.provider === provider);

  if (conn) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono">{provider}</span>
        <Badge variant="secondary" className="gap-1">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          connected
        </Badge>
        <button
          onClick={() => del.mutate(conn.id)}
          className="ml-auto text-muted-foreground hover:text-destructive"
        >
          disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="font-mono text-xs">{provider}</div>
      <div className="flex gap-2">
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          type="password"
          placeholder="paste API key…"
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          disabled={!key.trim() || create.isPending}
          onClick={() => {
            create.mutate({ provider, key: key.trim() });
            setKey("");
          }}
        >
          Connect
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

export function NodePanel({
  func,
  config,
  onConfigChange,
}: {
  func: AuthoredFunc | null;
  config: Record<string, string>;
  onConfigChange: (port: string, value: string) => void;
}) {
  if (!func) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Select a node on the canvas to see its details and settings.
      </div>
    );
  }

  const outs = func.outputSchema?.properties
    ? Object.keys(func.outputSchema.properties)
    : [];
  const configPorts = func.inputs.filter((p) => p.role === "config");
  const dataPorts = func.inputs.filter((p) => p.role !== "config");

  return (
    <ScrollArea className="h-full w-full">
      <div className="w-full min-w-0 space-y-4 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{func.title || func.id}</span>
            <Badge variant={func.pure ? "secondary" : "default"}>
              {func.pure ? "pure · adapter" : "effectful"}
            </Badge>
          </div>
          {func.summary && (
            <div className="mt-1 text-xs text-muted-foreground">{func.summary}</div>
          )}
          <div className="mt-1 font-mono text-[11px] text-muted-foreground/70">
            {func.id} · v{func.version}
          </div>
        </div>

        <Section title="Settings (config)">
          {configPorts.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No configurable settings — this step takes all its data from inputs.
            </div>
          ) : (
            <div className="space-y-2">
              {configPorts.map((p) => (
                <div key={p.name} className="space-y-1">
                  <label className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{p.type}</span>
                    {!p.required && (
                      <span className="text-[10px] text-muted-foreground">optional</span>
                    )}
                  </label>
                  <Input
                    value={config[p.name] ?? ""}
                    onChange={(e) => onConfigChange(p.name, e.target.value)}
                    type={p.type === "number" ? "number" : "text"}
                    placeholder={`${p.name}…`}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Inputs">
          {dataPorts.length === 0 ? (
            <div className="text-xs text-muted-foreground">none</div>
          ) : (
            <div className="space-y-1">
              {dataPorts.map((p) => (
                <div key={p.name} className="flex items-center gap-2 font-mono text-xs">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">: {p.type}</span>
                  {!p.required && (
                    <span className="text-[10px] text-muted-foreground">optional</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Output">
          <div className="font-mono text-xs">{outs.length ? outs.join(", ") : "—"}</div>
        </Section>

        {!func.pure && (
          <>
            <Section title="Connections">
              {func.requires.length === 0 ? (
                <div className="text-xs text-muted-foreground">none</div>
              ) : (
                <div className="space-y-2">
                  {func.requires.map((r) => (
                    <ProviderConnection key={r.name} provider={r.provider} />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Safety">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">danger: {func.dangerClass}</Badge>
                <Badge variant="outline">
                  idempotency: {func.idempotency?.mechanism}
                </Badge>
              </div>
            </Section>
          </>
        )}

        <Section title="Body (generated code)">
          <CodeBlock source={func.bodySource} name={func.id} />
        </Section>
      </div>
    </ScrollArea>
  );
}
