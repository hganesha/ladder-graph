import { memo, type ReactNode } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Bot,
  Combine,
  Flag,
  GitFork,
  Layers,
  Play,
  RefreshCw,
  ShieldCheck,
  Split,
  SquareArrowOutUpRight,
} from "lucide-react";
import { KIND_META, type GraphNode } from "../lib/model";
import { cn } from "../utils/cn";
import type { NodeKind } from "../types";

const ICONS: Record<NodeKind, typeof Bot> = {
  start: Play,
  phase: Flag,
  agent: Bot,
  parallel: GitFork,
  pipeline: Layers,
  reduce: Combine,
  router: Split,
  verify: ShieldCheck,
  loop: RefreshCw,
  output: SquareArrowOutUpRight,
};

function TaskNodeInner({ data, selected }: NodeProps<GraphNode>) {
  const meta = KIND_META[data.kind];
  const Icon = ICONS[data.kind];
  const showTarget = data.kind !== "start";
  const showSource = data.kind !== "output" && data.kind !== "router";
  const branches = data.kind === "router" ? data.branches : [];

  return (
    <div
      className={cn(
        "group relative w-[268px] rounded-[18px] border bg-[#12141adb] shadow-[0_12px_40px_-18px_rgba(0,0,0,0.85)] backdrop-blur-md transition-shadow",
        selected ? "border-white/25" : "border-white/8 hover:border-white/16",
      )}
      style={{
        boxShadow: selected
          ? `0 0 0 1px ${meta.color}55, 0 16px 50px -16px ${meta.glow}`
          : undefined,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-[18px] bg-gradient-to-b opacity-90"
        style={{
          backgroundImage: `linear-gradient(180deg, ${meta.color}22, transparent)`,
        }}
      />

      {showTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-[#0c0d11] !bg-[#d7d2c6]"
        />
      )}

      {data.kind === "loop" && (
        <Handle
          id="back"
          type="target"
          position={Position.Top}
          className="!-top-1.5 !h-2.5 !w-2.5 !border-2 !border-[#0c0d11] !bg-[#e879a9]"
          title="Loop back-edge"
        />
      )}

      <div className="relative px-3.5 pb-3 pt-3">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-md"
              style={{ background: `${meta.color}22`, color: meta.color }}
            >
              <Icon size={13} strokeWidth={2.2} />
            </span>
            <span
              className="font-mono text-[10px] font-medium uppercase tracking-[0.16em]"
              style={{ color: meta.color }}
            >
              {meta.label}
            </span>
          </div>
          {(data.kind === "agent" || data.kind === "verify" || data.kind === "pipeline") && (
            <span className="rounded-full border border-white/8 bg-white/4 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#b7b1a4]">
              {data.model}
            </span>
          )}
          {data.kind === "loop" && (
            <span className="rounded-full border border-pink-400/20 bg-pink-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-pink-200/80">
              dry &lt; {data.dryRounds}
            </span>
          )}
          {data.kind === "verify" && (
            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-violet-200/80">
              {data.voteRule}
            </span>
          )}
        </div>

        <div className="text-[13.5px] font-semibold leading-snug tracking-tight text-[#f3eee4]">
          {data.title}
        </div>
        {data.summary && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#9a9488]">{data.summary}</p>
        )}

        <div className="mt-2.5 flex flex-wrap gap-1">
          {data.schemaName && (
            <Chip>{data.schemaName}</Chip>
          )}
          {data.phase && data.kind !== "phase" && <Chip>{data.phase}</Chip>}
          {data.label && data.kind === "agent" && <Chip>{data.label}</Chip>}
          {data.kind === "reduce" && <Chip>0 tokens</Chip>}
        </div>
      </div>

      {showSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-[#0c0d11] !bg-[#d7d2c6]"
        />
      )}

      {branches.map((b, i) => {
        const top = 36 + i * 28;
        return (
          <Handle
            key={b.id}
            id={b.id}
            type="source"
            position={Position.Right}
            style={{ top }}
            className="!h-2.5 !w-2.5 !border-2 !border-[#0c0d11] !bg-[#f0a05a]"
            title={b.label}
          />
        );
      })}

      {data.kind === "router" && (
        <div className="absolute -right-1 top-7 flex flex-col gap-3 pr-2 text-right">
          {branches.map((b) => (
            <span key={b.id} className="font-mono text-[8px] uppercase tracking-wider text-orange-200/70">
              {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-white/6 bg-black/25 px-1.5 py-0.5 font-mono text-[9px] text-[#b7b1a4]">
      {children}
    </span>
  );
}

export const TaskNode = memo(TaskNodeInner);
