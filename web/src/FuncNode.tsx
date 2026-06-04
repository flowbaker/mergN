import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ArrowLeftRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface FuncNodeData {
  title: string;
  summary: string;
  pure: boolean;
  status?: string;
}

export function FuncNode({ data, selected }: NodeProps) {
  const d = data as unknown as FuncNodeData;
  const statusRing =
    d.status === "done"
      ? "ring-2 ring-emerald-500/60"
      : d.status === "failed"
        ? "ring-2 ring-rose-500/60"
        : d.status === "pending"
          ? "ring-2 ring-amber-500/70 animate-pulse"
          : "";

  return (
    <div
      className={cn(
        "group relative w-72 rounded-3xl border p-1 ring-offset-background transition-all",
        selected
          ? "border-primary/30 ring-2 ring-primary/20 ring-offset-2"
          : "border-border",
        statusRing,
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !bg-background"
      />

      <div className="flex gap-2 rounded-[1.2rem] bg-background p-2 font-medium ring-1 ring-border">
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl p-2",
            d.pure
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-blue-500/15 text-blue-400",
          )}
        >
          {d.pure ? (
            <ArrowLeftRight className="h-4 w-4" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 px-2 py-1">
          <h3 className="w-full truncate text-base font-medium leading-none">
            {d.title}
          </h3>
          <p className="w-full truncate text-sm leading-none text-muted-foreground">
            {d.summary}
          </p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !bg-background"
      />
    </div>
  );
}
