import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { format } from "prettier/standalone";
import babel from "prettier/plugins/babel";
import estree from "prettier/plugins/estree";

export function CodeBlock({ source, name }: { source: string; name: string }) {
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
    <div className="max-w-full overflow-hidden rounded-md border">
      <CodeMirror
        value={code}
        theme={oneDark}
        extensions={[javascript(), EditorView.lineWrapping]}
        editable={false}
        width="100%"
        maxHeight="360px"
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
