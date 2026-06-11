import { useTranslation } from "react-i18next";
import { X, Plus, Trash2 } from "lucide-react";

export function ArrayEditorDialog({
  title,
  items,
  onChange,
  onClose,
}: {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const setItem = (i: number, v: string) =>
    onChange(items.map((it, idx) => (idx === i ? v : it)));
  const removeItem = (i: number) =>
    onChange(items.filter((_, idx) => idx !== i));
  const addItem = () => onChange([...items, ""]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border/60 bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="truncate text-sm font-medium">{title}</h3>
          <button
            onClick={onClose}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-auto">
          {items.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              {t("array.empty")}
            </p>
          )}
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground/50">
                {i + 1}
              </span>
              <input
                value={it}
                onChange={(e) => setItem(i, e.target.value)}
                autoFocus={i === items.length - 1}
                className="h-8 min-w-0 flex-1 rounded-lg border border-border/50 bg-background-subtle px-2.5 text-xs outline-none transition-colors focus:border-border"
              />
              <button
                onClick={() => removeItem(i)}
                className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={addItem}
            className="flex items-center gap-1 rounded-md border border-border/50 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("array.add")}
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
