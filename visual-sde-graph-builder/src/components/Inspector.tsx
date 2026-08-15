import type { ReactNode } from "react";
import { KIND_META, MODEL_TIERS, SCHEMA_PRESETS, type GraphEdge, type GraphNode } from "../lib/model";
import type { EdgeKind, ModelTier, TaskData, ValidationIssue, WorkflowMeta } from "../types";
import { estimateAgents } from "../lib/validate";
import { cn } from "../utils/cn";

interface InspectorProps {
  meta: WorkflowMeta;
  onMeta: (patch: Partial<WorkflowMeta>) => void;
  node: GraphNode | null;
  edge: GraphEdge | null;
  onChangeNode: (id: string, patch: Partial<TaskData>) => void;
  onChangeEdge: (id: string, patch: { kind?: EdgeKind; contract?: string; label?: string }) => void;
  issues: ValidationIssue[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  onFocusNode: (id: string) => void;
}

export function Inspector({
  meta,
  onMeta,
  node,
  edge,
  onChangeNode,
  onChangeEdge,
  issues,
  nodes,
  edges,
  onFocusNode,
}: InspectorProps) {
  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-white/6 bg-[#0c0d11]/80 backdrop-blur-xl">
      <div className="border-b border-white/6 px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7d786e]">
          {node ? "Node contract" : edge ? "Edge contract" : "Fleet"}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {node ? (
          <NodeForm node={node} onChange={(patch) => onChangeNode(node.id, patch)} />
        ) : edge ? (
          <EdgeForm edge={edge} nodes={nodes} onChange={(patch) => onChangeEdge(edge.id, patch)} />
        ) : (
          <Overview
            meta={meta}
            onMeta={onMeta}
            issues={issues}
            nodes={nodes}
            edges={edges}
            onFocusNode={onFocusNode}
          />
        )}
      </div>
    </aside>
  );
}

function Overview({
  meta,
  onMeta,
  issues,
  nodes,
  edges,
  onFocusNode,
}: {
  meta: WorkflowMeta;
  onMeta: (patch: Partial<WorkflowMeta>) => void;
  issues: ValidationIssue[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  onFocusNode: (id: string) => void;
}) {
  const agents = estimateAgents(nodes);
  return (
    <div className="space-y-5">
      <Field label="Workflow name">
        <input
          value={meta.name}
          onChange={(e) => onMeta({ name: e.target.value })}
          className={inputClass}
          spellCheck={false}
        />
      </Field>
      <Field label="Description">
        <textarea
          value={meta.description}
          onChange={(e) => onMeta({ description: e.target.value })}
          rows={3}
          className={inputClass}
        />
      </Field>
      <Field label="User objective">
        <textarea
          value={meta.objective}
          onChange={(e) => onMeta({ objective: e.target.value })}
          rows={4}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Stat k="nodes" v={nodes.length} />
        <Stat k="edges" v={edges.length} />
        <Stat k="~agents" v={agents} />
      </div>

      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#7d786e]">Diagnostics</div>
        {issues.length === 0 ? (
          <p className="text-[12px] text-[#8fdfb2]">Graph is compile-ready.</p>
        ) : (
          <ul className="space-y-1.5">
            {issues.map((iss, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => iss.nodeId && onFocusNode(iss.nodeId)}
                  className={cn(
                    "w-full rounded-lg border px-2.5 py-2 text-left text-[11.5px] leading-snug",
                    iss.level === "error" && "border-rose-500/20 bg-rose-500/8 text-rose-100/90",
                    iss.level === "warn" && "border-amber-400/20 bg-amber-400/8 text-amber-100/85",
                    iss.level === "info" && "border-cyan-400/15 bg-cyan-400/8 text-cyan-100/80",
                  )}
                >
                  {iss.message}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NodeForm({ node, onChange }: { node: GraphNode; onChange: (patch: Partial<TaskData>) => void }) {
  const d = node.data;
  const meta = KIND_META[d.kind];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-md font-mono text-[9px] uppercase"
          style={{ background: `${meta.color}22`, color: meta.color }}
        >
          {meta.label.slice(0, 2)}
        </span>
        <div>
          <div className="text-[13px] font-medium text-[#f0ebe1]">{meta.label}</div>
          <div className="text-[10px] text-[#8a8478]">{meta.hint}</div>
        </div>
      </div>

      <Field label="Title">
        <input className={inputClass} value={d.title} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>
      <Field label="Summary">
        <textarea className={inputClass} rows={2} value={d.summary} onChange={(e) => onChange({ summary: e.target.value })} />
      </Field>

      {(d.kind === "agent" || d.kind === "verify" || d.kind === "pipeline") && (
        <>
          <Field label="Prompt">
            <textarea className={inputClass} rows={6} value={d.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Label">
              <input className={inputClass} value={d.label} onChange={(e) => onChange({ label: e.target.value })} />
            </Field>
            <Field label="Phase">
              <input className={inputClass} value={d.phase} onChange={(e) => onChange({ phase: e.target.value })} />
            </Field>
          </div>
          <Field label="Model tier">
            <select
              className={inputClass}
              value={d.model}
              onChange={(e) => onChange({ model: e.target.value as ModelTier })}
            >
              {MODEL_TIERS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.note}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Schema preset">
            <select
              className={inputClass}
              value={d.schemaName}
              onChange={(e) => {
                const preset = SCHEMA_PRESETS.find((p) => p.name === e.target.value);
                onChange({ schemaName: e.target.value, schemaJson: preset?.json ?? d.schemaJson });
              }}
            >
              <option value="">None (free text)</option>
              {SCHEMA_PRESETS.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Schema JSON">
            <textarea
              className={cn(inputClass, "font-mono text-[11px]")}
              rows={7}
              value={d.schemaJson}
              onChange={(e) => onChange({ schemaJson: e.target.value })}
              spellCheck={false}
            />
          </Field>
          <Field label="agentType">
            <input className={inputClass} value={d.agentType} onChange={(e) => onChange({ agentType: e.target.value })} />
          </Field>
        </>
      )}

      {d.kind === "phase" && (
        <Field label="Phase title">
          <input className={inputClass} value={d.title} onChange={(e) => onChange({ title: e.target.value, phase: e.target.value })} />
        </Field>
      )}

      {d.kind === "reduce" && (
        <Field label="JavaScript reduce">
          <textarea
            className={cn(inputClass, "font-mono text-[11px]")}
            rows={6}
            value={d.reduceExpr}
            onChange={(e) => onChange({ reduceExpr: e.target.value })}
            spellCheck={false}
          />
        </Field>
      )}

      {d.kind === "verify" && (
        <>
          <Field label="Lenses (comma)">
            <input className={inputClass} value={d.lenses} onChange={(e) => onChange({ lenses: e.target.value })} />
          </Field>
          <Field label="Vote rule">
            <select className={inputClass} value={d.voteRule} onChange={(e) => onChange({ voteRule: e.target.value })}>
              <option value="majority">Majority must survive</option>
              <option value="all">Unanimous</option>
              <option value="any">Any lens agrees</option>
            </select>
          </Field>
        </>
      )}

      {d.kind === "loop" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dry rounds">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={d.dryRounds}
              onChange={(e) => onChange({ dryRounds: Number(e.target.value) })}
            />
          </Field>
          <Field label="Max iterations">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={d.maxIterations}
              onChange={(e) => onChange({ maxIterations: Number(e.target.value) })}
            />
          </Field>
        </div>
      )}

      {d.kind === "router" && (
        <>
          <Field label="Condition field">
            <input
              className={inputClass}
              value={d.conditionField}
              onChange={(e) => onChange({ conditionField: e.target.value })}
            />
          </Field>
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786e]">Branches</div>
            {d.branches.map((b, i) => (
              <div key={b.id} className="grid grid-cols-2 gap-1.5">
                <input
                  className={inputClass}
                  value={b.value}
                  placeholder="value"
                  onChange={(e) => {
                    const next = d.branches.map((x, j) => (j === i ? { ...x, value: e.target.value, id: e.target.value || x.id } : x));
                    onChange({ branches: next });
                  }}
                />
                <input
                  className={inputClass}
                  value={b.label}
                  placeholder="label"
                  onChange={(e) => {
                    const next = d.branches.map((x, j) => (j === i ? { ...x, label: e.target.value } : x));
                    onChange({ branches: next });
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="text-[11px] text-cyan-200/80 hover:text-cyan-100"
              onClick={() =>
                onChange({
                  branches: [...d.branches, { id: `b${d.branches.length + 1}`, value: "", label: "Branch" }],
                })
              }
            >
              + add branch
            </button>
          </div>
        </>
      )}

      <Field label="Notes">
        <textarea className={inputClass} rows={2} value={d.notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </Field>
    </div>
  );
}

function EdgeForm({
  edge,
  nodes,
  onChange,
}: {
  edge: GraphEdge;
  nodes: GraphNode[];
  onChange: (patch: { kind?: EdgeKind; contract?: string; label?: string }) => void;
}) {
  const a = nodes.find((n) => n.id === edge.source)?.data.title ?? edge.source;
  const b = nodes.find((n) => n.id === edge.target)?.data.title ?? edge.target;
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-[#d7d1c5]">
        <span className="text-[#f3eee4]">{a}</span>
        <span className="mx-2 text-[#7d786e]">→</span>
        <span className="text-[#f3eee4]">{b}</span>
      </p>
      <Field label="Relation kind">
        <select
          className={inputClass}
          value={edge.data?.kind ?? "data"}
          onChange={(e) => onChange({ kind: e.target.value as EdgeKind })}
        >
          <option value="data">Data — named payload crosses</option>
          <option value="control">Control — sequencing only</option>
          <option value="verify">Verify — gated findings</option>
          <option value="loop">Loop — converging back-edge</option>
        </select>
      </Field>
      <Field label="Contract (shape that crosses)">
        <input
          className={inputClass}
          value={edge.data?.contract ?? ""}
          onChange={(e) => onChange({ contract: e.target.value, label: e.target.value })}
          placeholder="angles, files, survivors…"
        />
      </Field>
      <Field label="Edge label">
        <input
          className={inputClass}
          value={edge.data?.label ?? ""}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <p className="text-[11px] leading-relaxed text-[#8a8478]">
        Name edges by the shape that crosses, not by step order. Flatten, dedupe, and filter in JavaScript — never spawn an
        agent just to combine arrays.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786e]">{label}</span>
      {children}
    </label>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/3 px-2.5 py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7d786e]">{k}</div>
      <div className="font-display text-xl text-[#f3eee4]">{v}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/8 bg-black/30 px-2.5 py-1.5 text-[12.5px] text-[#efeae0] outline-none ring-0 placeholder:text-[#6b665c] focus:border-cyan-400/40";
