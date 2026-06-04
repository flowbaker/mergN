import { useWorkflows, useDeleteWorkflow } from "./queries";
import { cn } from "@/lib/utils";

export function WorkflowsPanel({
  currentId,
  onLoad,
}: {
  currentId: string | null;
  onLoad: (id: string) => void;
}) {
  const { data: items = [], isLoading } = useWorkflows();
  const del = useDeleteWorkflow();

  return (
    <div className="flex h-full w-60 flex-col border-r bg-muted/30">
      <div className="border-b px-4 py-3 text-sm font-semibold">Workflows</div>
      <div className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
        {isLoading && (
          <div className="px-2 py-1 text-xs text-muted-foreground">loading…</div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="px-2 py-1 text-xs text-muted-foreground">
            No saved workflows yet.
          </div>
        )}
        {items.map((it) => (
          <div
            key={it.id}
            onClick={() => onLoad(it.id)}
            className={cn(
              "group cursor-pointer rounded-md border px-2.5 py-2 hover:bg-accent",
              it.id === currentId && "border-primary bg-accent/50",
            )}
          >
            <div className="truncate text-sm font-medium">{it.name}</div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {it.funcCount} funcs · {new Date(it.updatedAt).toLocaleDateString()}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  del.mutate(it.id);
                }}
                className="text-[11px] text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              >
                delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
