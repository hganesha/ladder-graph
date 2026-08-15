import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { generateBrief, generateJSON, generateMermaid, generateWorkflowJS } from "../lib/codegen";
import type { GraphEdge, GraphNode } from "../lib/model";
import type { WorkflowMeta } from "../types";
import { cn } from "../utils/cn";

type Tab = "js" | "mermaid" | "brief" | "json";

interface OutputPanelProps {
  open: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: WorkflowMeta;
}

export function OutputPanel({ open, nodes, edges, meta }: OutputPanelProps) {
  const [tab, setTab] = useState<Tab>("js");
  const [copied, setCopied] = useState(false);

  const docs = useMemo(
    () => ({
      js: generateWorkflowJS(nodes, edges, meta),
      mermaid: generateMermaid(nodes, edges, meta),
      brief: generateBrief(nodes, edges, meta),
      json: generateJSON(nodes, edges, meta),
    }),
    [nodes, edges, meta],
  );

  const text = docs[tab];
  const filename =
    tab === "js"
      ? `${meta.name || "fleet"}.js`
      : tab === "mermaid"
        ? `${meta.name || "fleet"}.mmd`
        : tab === "brief"
          ? `${meta.name || "fleet"}.md`
          : `${meta.name || "fleet"}.json`;

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <section className="flex h-[38vh] min-h-[240px] flex-col border-t border-white/6 bg-[#090a0d]/95 backdrop-blur-xl">
      <header className="flex items-center justify-between gap-3 border-b border-white/6 px-4 py-2">
        <div className="flex items-center gap-1">
          {(
            [
              ["js", "Workflow JS"],
              ["mermaid", "Mermaid"],
              ["brief", "Brief"],
              ["json", "Graph JSON"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] transition",
                tab === id ? "bg-white/10 text-[#f3eee4]" : "text-[#8a8478] hover:text-[#d7d1c5]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/8 px-2.5 py-1 text-[11px] text-[#d7d1c5] hover:bg-white/5"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/8 px-2.5 py-1 text-[11px] text-[#d7d1c5] hover:bg-white/5"
          >
            <Download size={12} />
            Save {filename}
          </button>
        </div>
      </header>
      <pre className="flex-1 overflow-auto px-5 py-3 font-mono text-[11.5px] leading-relaxed text-[#d4cfc2]">
        {text}
      </pre>
    </section>
  );
}
