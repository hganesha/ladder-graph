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
import { KIND_META } from "../lib/model";
import type { NodeKind } from "../types";
import { NODE_KINDS } from "../types";

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

interface PaletteProps {
  onAdd: (kind: NodeKind) => void;
}

export function Palette({ onAdd }: PaletteProps) {
  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-white/6 bg-[#0c0d11]/80 backdrop-blur-xl">
      <div className="px-4 pb-2 pt-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7d786e]">Palette</div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#8c867b]">
          Drag a node onto the canvas, or click to drop it in view.
        </p>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-2.5 pb-4">
        {NODE_KINDS.map((kind) => {
          const meta = KIND_META[kind];
          const Icon = ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/codez", kind);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onAdd(kind)}
              className="flex w-full items-start gap-2.5 rounded-xl border border-transparent px-2 py-2 text-left transition hover:border-white/8 hover:bg-white/4"
            >
              <span
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${meta.color}18`, color: meta.color }}
              >
                <Icon size={14} />
              </span>
              <span>
                <span className="block text-[12.5px] font-medium text-[#ece7dc]">{meta.label}</span>
                <span className="mt-0.5 block text-[10.5px] leading-snug text-[#8a8478]">{meta.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-white/6 px-3.5 py-3">
        <p className="font-mono text-[10px] leading-relaxed text-[#6e6a61]">
          Edges are contracts.
          <br />
          Loops need a dry-round guard.
        </p>
      </div>
    </aside>
  );
}
