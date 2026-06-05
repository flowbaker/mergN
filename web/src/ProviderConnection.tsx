import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useConnections,
  useCreateConnection,
  useDeleteConnection,
} from "./queries";

export function ProviderConnection({ provider }: { provider: string }) {
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
