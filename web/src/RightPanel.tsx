import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RightTab = "chat" | "node";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function RightPanel({
  active,
  onTab,
  chat,
  node,
}: {
  active: RightTab;
  onTab: (tab: RightTab) => void;
  chat: ReactNode;
  node: ReactNode;
}) {
  return (
    <div className="flex w-[420px] flex-col border-l bg-muted/30">
      <div className="flex">
        <TabButton active={active === "chat"} onClick={() => onTab("chat")}>
          Chat
        </TabButton>
        <TabButton active={active === "node"} onClick={() => onTab("node")}>
          Node
        </TabButton>
      </div>
      <div className={cn("min-h-0 flex-1", active === "chat" ? "flex" : "hidden")}>
        {chat}
      </div>
      <div className={cn("min-h-0 flex-1", active === "node" ? "block" : "hidden")}>
        {node}
      </div>
    </div>
  );
}
