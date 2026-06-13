import { useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  File as FileIcon,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFiles,
  uploadFile,
  deleteFile,
  downloadFile,
  type FileMeta,
} from "./queries";

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function FilesPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useFiles();
  const files = data ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["files"] });

  const upload = async (list: FileList | null) => {
    if (!list || !list.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(list)) await uploadFile(f);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void upload(e.dataTransfer.files);
  };

  const onDelete = async (id: string) => {
    await deleteFile(id).catch(() => {});
    refresh();
  };

  return (
    <div
      className="flex h-full w-full flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-3 py-2">
        <span className="text-xs font-medium text-foreground">
          {t("panel.files")}
        </span>
        <span className="text-[11px] text-muted-foreground">{files.length}</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted px-2.5 py-1 text-xs text-foreground/90 transition-colors hover:border-border disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {t("files.upload")}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="border-b border-border/30 px-3 py-1.5 text-[11px] text-rose-400">
          {error}
        </p>
      )}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          dragging && "ring-2 ring-inset ring-tone-amber/50",
        )}
      >
        {isLoading ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            {t("files.loading")}
          </p>
        ) : files.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
            <Upload className="size-5 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">{t("files.empty")}</p>
            <p className="text-[11px] text-muted-foreground/70">
              {t("files.emptyHint")}
            </p>
          </div>
        ) : (
          files.map((f: FileMeta) => (
            <div
              key={f.id}
              className="group flex items-center gap-2 border-b border-border/30 px-3 py-2"
            >
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-foreground/90">{f.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {fmtSize(f.size)} · {fmtDate(f.createdAt)}
                  {f.source === "workflow" ? ` · ${t("files.fromWorkflow")}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void downloadFile(f)}
                title={t("files.download")}
                className="rounded p-1 text-muted-foreground opacity-0 transition-colors hover:bg-secondary hover:text-foreground group-hover:opacity-100"
              >
                <Download className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void onDelete(f.id)}
                title={t("files.delete")}
                className="rounded p-1 text-muted-foreground opacity-0 transition-colors hover:bg-secondary hover:text-foreground group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
