import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  Bell,
  Check,
  Clock,
  Copy,
  Play,
  RefreshCw,
  Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TriggerConfig, TriggerKind } from "./types";
import { getSpace } from "./space";

const KINDS: {
  kind: TriggerKind;
  icon: typeof Play;
  soon?: boolean;
}[] = [
  { kind: "manual", icon: Play },
  { kind: "webhook", icon: Webhook },
  { kind: "schedule", icon: Clock, soon: true },
  { kind: "poll", icon: RefreshCw, soon: true },
  { kind: "event", icon: Bell, soon: true },
];

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background-subtle px-2.5 py-1.5 text-left font-mono text-[11px] text-foreground/80 transition-colors hover:border-border"
    >
      <span className="min-w-0 flex-1 truncate">{value}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

export function TriggerDialog({
  trigger,
  onChange,
  workflowId,
  dirty,
  onClose,
}: {
  trigger: TriggerConfig;
  onChange: (t: TriggerConfig) => void;
  workflowId: string | null;
  dirty: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const webhookUrl = workflowId
    ? `${window.location.origin}/api/hooks/${getSpace()}/${workflowId}`
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-semibold">{t("trigger.title")}</span>
          <span className="text-xs text-muted-foreground">
            {t("trigger.subtitle")}
          </span>
          <button
            onClick={onClose}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1.5">
          {KINDS.map((k) => {
            const active = trigger.kind === k.kind;
            const Icon = k.icon;
            return (
              <button
                key={k.kind}
                disabled={k.soon}
                onClick={() => onChange({ kind: k.kind })}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border/50 hover:border-border hover:bg-secondary",
                  k.soon && "cursor-not-allowed opacity-50 hover:bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    active
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {t(`trigger.kind.${k.kind}`)}
                    {k.soon && (
                      <span className="rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                        {t("common.soon")}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t(`trigger.desc.${k.kind}`)}
                  </span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-amber-400" />}
              </button>
            );
          })}
        </div>

        {trigger.kind === "webhook" && (
          <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {t("trigger.endpoint")}
            </div>
            {webhookUrl ? (
              <>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("trigger.webhookInfo")}
                </p>
                <CopyChip value={webhookUrl} />
                <CopyChip value={`curl -X POST ${webhookUrl} -d '{}'`} />
              </>
            ) : (
              <p className="text-xs leading-relaxed text-amber-300/90">
                {t("trigger.saveFirst")}
              </p>
            )}
          </div>
        )}

        {dirty && trigger.kind !== "manual" && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {t("trigger.applyHint")}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
