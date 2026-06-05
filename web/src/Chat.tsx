import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { AuthoredFunc, InputForm, Wire, WorkflowOp } from "./types";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import { spaceHeaders } from "./space";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ToolPart {
  type: string;
  state?: string;
  output?: unknown;
}

const EXAMPLES = [
  "When a Stripe payment succeeds, send a receipt to Slack",
  "Summarize new signups and email me a daily digest",
  "On a new GitHub issue, post a triage note to Discord",
];

interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

function usageOf(metadata: unknown): Usage | undefined {
  return (metadata as { totalUsage?: Usage } | undefined)?.totalUsage;
}

export function Chat({
  onOps,
  onBuilding,
  workflowState,
  onReady,
}: {
  onOps: (ops: WorkflowOp[]) => void;
  onBuilding?: (building: boolean) => void;
  workflowState?: string;
  onReady?: (send: (text: string) => void) => void;
}) {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const grow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 208) + "px";
  };

  const useExample = (text: string) => {
    setInput(text);
    requestAnimationFrame(() => {
      grow();
      taRef.current?.focus();
    });
  };

  const stateRef = useRef("");
  stateRef.current = workflowState ?? "";

  const send = useCallback(
    (text: string) =>
      sendMessage(
        { text },
        { headers: spaceHeaders(), body: { workflowState: stateRef.current } },
      ),
    [sendMessage],
  );

  useEffect(() => {
    onReady?.(send);
  }, [send, onReady]);

  const ops = useMemo(() => {
    const out: WorkflowOp[] = [];
    const isFunc = (o: unknown): o is AuthoredFunc =>
      !!o &&
      typeof (o as AuthoredFunc).id === "string" &&
      Array.isArray((o as AuthoredFunc).inputs);
    messages.forEach((m) => {
      (m.parts as ToolPart[]).forEach((part, i) => {
        if (part.state !== "output-available") return;
        const key = `${m.id}:${i}`;
        const o = part.output as Record<string, unknown> | undefined;
        if (!o) return;
        switch (part.type) {
          case "tool-design_workflow": {
            const dw = o as {
              name?: string;
              funcs?: AuthoredFunc[];
              wires?: Wire[];
              trigger?: { kind: "manual" | "webhook" };
              inputForm?: InputForm;
            };
            if (dw.name)
              out.push({ key: `${key}:n`, kind: "name", name: dw.name });
            if (dw.funcs?.length)
              out.push({ key: `${key}:f`, kind: "funcs", funcs: dw.funcs });
            if (dw.wires?.length)
              out.push({ key: `${key}:w`, kind: "wires", wires: dw.wires });
            if (dw.trigger)
              out.push({
                key: `${key}:t`,
                kind: "trigger",
                trigger: dw.trigger,
              });
            if (dw.inputForm)
              out.push({
                key: `${key}:if`,
                kind: "inputForm",
                inputForm: dw.inputForm,
              });
            break;
          }
          case "tool-author_func":
          case "tool-update_func":
            if (isFunc(o))
              out.push({ key, kind: "funcs", funcs: [o] });
            break;
          case "tool-wire":
            if (o.from && o.to)
              out.push({ key, kind: "wires", wires: [o as unknown as Wire] });
            break;
          case "tool-delete_func":
            if (typeof o.id === "string")
              out.push({ key, kind: "deleteFunc", id: o.id });
            break;
          case "tool-unwire":
            if (typeof o.to === "string")
              out.push({
                key,
                kind: "unwire",
                to: o.to,
                toInput:
                  typeof o.toInput === "string" ? o.toInput : undefined,
              });
            break;
        }
      });
    });
    return out;
  }, [messages]);

  const building = useMemo(() => {
    for (const m of messages) {
      for (const part of m.parts as ToolPart[]) {
        if (
          part.type === "tool-design_workflow" &&
          part.state &&
          !part.state.startsWith("output")
        ) {
          return true;
        }
      }
    }
    return false;
  }, [messages]);

  useEffect(() => {
    onOps(ops);
  }, [ops, onOps]);

  useEffect(() => {
    onBuilding?.(building);
  }, [building, onBuilding]);

  const totalTokens = useMemo(() => {
    let sum = 0;
    for (const m of messages) {
      const u = usageOf(m.metadata);
      if (u?.totalTokens) sum += u.totalTokens;
    }
    return sum;
  }, [messages]);

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    send(text);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center px-3 py-1.5">
        <span className="ml-auto rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/80">
          {totalTokens.toLocaleString()} tokens
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center px-4 pb-2 pt-10 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary ring-1 ring-border">
                <Sparkles className="h-5 w-5 text-foreground/80" />
              </div>
              <h2 className="mt-4 text-[15px] font-medium text-foreground">
                Build a workflow in plain language
              </h2>
              <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                Describe what should happen. I'll wire up the trigger and steps
                for you.
              </p>

              <div className="mt-6 flex w-full flex-col gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => useExample(ex)}
                    className="group flex items-center gap-2.5 rounded-xl border border-border/50 bg-background-subtle px-3 py-2.5 text-left text-[13px] text-foreground/80 transition-colors hover:border-border hover:bg-secondary hover:text-foreground"
                  >
                    <span className="flex-1 leading-snug">{ex}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground/70" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={cn(
                  "flex min-w-0 max-w-full flex-col gap-1.5",
                  isUser ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    isUser
                      ? "max-w-[85%] rounded-2xl rounded-br-md border border-border/60 bg-secondary px-3.5 py-2 text-[14px] leading-relaxed text-secondary-foreground shadow-sm wrap-anywhere"
                      : "w-full min-w-0 overflow-hidden text-foreground/90",
                  )}
                >
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return isUser ? (
                        <span key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </span>
                      ) : (
                        <Markdown key={i}>{part.text}</Markdown>
                      );
                    }
                    if (part.type.startsWith("tool-")) {
                      const p = part as ToolPart;
                      const o = p.output as
                        | { id?: string; from?: string; to?: string }
                        | undefined;
                      const label =
                        o?.id ?? (o?.from && o?.to ? `${o.from} → ${o.to}` : "");
                      const done = p.state === "output-available";
                      return (
                        <div
                          key={i}
                          className="my-1 flex w-fit max-w-full items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground"
                        >
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              done ? "bg-emerald-500" : "bg-amber-500 animate-pulse",
                            )}
                          />
                          <span className="shrink-0">
                            {part.type.replace("tool-", "")}
                          </span>
                          {label && (
                            <span className="truncate text-foreground/70">
                              {label}
                            </span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
                {!isUser && usageOf(m.metadata) && (
                  <div className="font-mono text-[10px] text-muted-foreground/60">
                    ↑{usageOf(m.metadata)?.inputTokens ?? 0} ↓
                    {usageOf(m.metadata)?.outputTokens ?? 0}
                  </div>
                )}
              </div>
            );
          })}
          {status === "streaming" && (
            <div className="text-xs text-muted-foreground">…</div>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={submit} className="p-2">
        <div className="flex items-end gap-2 rounded-2xl border border-border/40 bg-background-subtle p-2 transition-colors focus-within:border-foreground/20">
          <textarea
            ref={taRef}
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value);
              grow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            placeholder="Message the builder…"
            className="max-h-52 min-h-20 flex-1 resize-none self-stretch border-none bg-transparent px-1 py-1 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={status === "streaming" || status === "submitted"}
            className="h-8 w-8 shrink-0 rounded-xl"
          >
            ↑
          </Button>
        </div>
      </form>
    </div>
  );
}
