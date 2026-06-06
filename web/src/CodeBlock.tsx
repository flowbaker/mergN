import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { cn } from "@/lib/utils";
import { format } from "prettier/standalone";
import babel from "prettier/plugins/babel";
import estree from "prettier/plugins/estree";

export function CodeBlock({
  source,
  name,
  theme = "dark",
  wrap = true,
  fill = false,
}: {
  source: string;
  name: string;
  theme?: "dark" | "light";
  wrap?: boolean;
  fill?: boolean;
}) {
  const [code, setCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    const wrapped = `async function ${name}(ctx, input) {\n${source}\n}`;
    format(wrapped, {
      parser: "babel",
      plugins: [babel, estree],
      semi: true,
      singleQuote: false,
    })
      .then((out) => {
        if (!cancelled) setCode(out.trim());
      })
      .catch(() => {
        if (!cancelled) setCode(wrapped);
      });
    return () => {
      cancelled = true;
    };
  }, [source, name]);

  return (
    <div
      className={cn(
        "max-w-full overflow-hidden rounded-2xl border",
        fill && "h-full",
      )}
    >
      <CodeMirror
        value={code}
        theme={theme === "dark" ? oneDark : "light"}
        extensions={[
          javascript(),
          ...(wrap ? [EditorView.lineWrapping] : []),
          EditorView.theme({
            "&": { fontSize: "12px" },
            ".cm-gutters": { fontSize: "11px" },
          }),
        ]}
        editable={false}
        width="100%"
        height={fill ? "100%" : undefined}
        maxHeight={fill ? undefined : "360px"}
        style={fill ? { height: "100%" } : undefined}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
      />
    </div>
  );
}
