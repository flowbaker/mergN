import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronUp, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLlmSettings, saveLlmSettings, type LlmSettings } from "./queries";

const PROVIDERS = [
  { value: "google", label: "Google (Gemini)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "local", label: "Local (Ollama / LM Studio / vLLM)" },
];

const MODEL_PLACEHOLDER: Record<string, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-latest",
  local: "qwen2.5:14b",
};

function LlmForm({
  current,
  onSaved,
}: {
  current: LlmSettings;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState(current.provider || "google");
  const [model, setModel] = useState(current.model || "");
  const [baseURL, setBaseURL] = useState(current.baseURL || "");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLocal = provider === "local";
  const fieldCls =
    "w-full rounded-lg border border-border/60 bg-background-subtle px-2 py-1 text-xs outline-none focus:border-border";

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveLlmSettings({
        provider,
        model: model || undefined,
        baseURL: baseURL || undefined,
        apiKey: apiKey || undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Select value={provider} onValueChange={setProvider}>
        <SelectTrigger size="sm" className="w-full bg-background-subtle text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROVIDERS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <input
        className={fieldCls}
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder={MODEL_PLACEHOLDER[provider] ?? ""}
      />

      {isLocal ? (
        <input
          className={`${fieldCls} font-mono`}
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          placeholder="http://host.docker.internal:11434/v1"
        />
      ) : (
        <input
          type="password"
          className={`${fieldCls} font-mono`}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={current.hasApiKey ? t("llm.keyUnchanged") : "sk-…"}
        />
      )}

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-2 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving && <Loader2 className="size-3 animate-spin" />}
        {t("common.save")}
      </button>
    </div>
  );
}

const EMPTY: LlmSettings = {
  provider: "",
  model: "",
  baseURL: "",
  hasApiKey: false,
  configured: false,
  locked: false,
};

export function ModelPicker() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useLlmSettings();
  const [open, setOpen] = useState(false);
  const autoOpened = useRef(false);

  // close on Escape only — NOT on outside click (you may tab away to copy a key).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // first thing a new user must do: pick a model. Shove the form open once.
  useEffect(() => {
    if (data && !data.configured && !data.locked && !autoOpened.current) {
      autoOpened.current = true;
      setOpen(true);
    }
  }, [data]);

  if (data?.locked) return null;

  const configured = !!data?.configured;
  const current = data ?? EMPTY;

  return (
    <div className="relative px-3 pb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg text-xs transition-colors",
          configured
            ? "px-2 py-1 text-muted-foreground hover:bg-secondary"
            : cn(
                "w-full justify-center px-3 py-2 font-medium text-amber-300 ring-1 ring-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25",
                !open && "animate-pulse",
              ),
        )}
      >
        {configured ? (
          <>
            <span className="max-w-44 truncate font-mono">
              {data!.model || data!.provider}
            </span>
            <ChevronUp
              className={cn("size-3 transition-transform", open && "rotate-180")}
            />
          </>
        ) : (
          <>
            <Sparkles className="size-3.5 shrink-0" />
            <span>{t("llm.pickToStart")}</span>
            <ChevronUp
              className={cn("size-3 transition-transform", open && "rotate-180")}
            />
          </>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-3 right-3 z-50 mb-1 rounded-xl border border-border/60 bg-background p-3 shadow-xl">
          <div className="mb-2 flex items-center">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              {t("llm.selectModel")}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <LlmForm
            current={current}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["llm-settings"] });
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
