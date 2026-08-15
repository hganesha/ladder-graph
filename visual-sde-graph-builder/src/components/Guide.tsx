import { X } from "lucide-react";

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "01", title: "Nodes and edges", body: "A node is one bounded agent() call. An edge exists only when output crosses into the next prompt." },
  { n: "02", title: "Linear is degenerate", body: "A→B→C→D is a graph with no width. If no variable crosses, cut the edge and fan out." },
  { n: "03", title: "Node contracts", body: "Bounded input, bounded output, one job. Pass a JSON schema so the tool layer retries on mismatch." },
  { n: "04", title: "Edges as data", body: "Name the shape that crosses. Flatten, dedupe, and filter in JavaScript — zero model tokens." },
  { n: "05", title: "Fan out", body: "parallel() spawns one subagent per thunk. Orchestration stays in code, off the context window." },
  { n: "06", title: "Fan-in barrier", body: "Gather the full upstream set only when a stage truly needs every result together." },
  { n: "07", title: "The diamond", body: "Split → parallel work → code reduce → one synthesis agent. The workhorse topology." },
  { n: "08", title: "Conditional routing", body: "A classifier returns a field; if/switch in JS picks the path. Same input, same branch." },
  { n: "09", title: "Verifiers", body: "Adversarial N-vote, perspective lenses, or a judge panel. Gate findings before synthesis." },
  { n: "10", title: "Failure isolation", body: "Throws in parallel() become null. Always .filter(Boolean). Writers get their own worktrees." },
  { n: "11", title: "Converging cycles", body: "Loop until K dry rounds. Dedupe against seen — not only confirmed — or rejects respawn forever." },
  { n: "12", title: "Model tiering", body: "Haiku on repetitive fan-out. Opus on synthesis. Spend flagship tokens where judgment lives." },
  { n: "13", title: "Pipeline vs parallel", body: "pipeline() streams with no global wait. parallel() waits for the slowest. Choose for wall-clock." },
  { n: "14", title: "Self-routing fleets", body: "Save the compiled script to .claude/workflows/ and invoke it by name. The artifact is the graph." },
];

export function Guide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#101217] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/6 px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7d786e]">Codez roadmap</div>
            <h2 className="font-display text-2xl text-[#f3eee4]">14 steps to a living graph</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-[#c8c2b4] hover:bg-white/5"
            aria-label="Close guide"
          >
            <X size={16} />
          </button>
        </header>
        <div className="max-h-[calc(88vh-88px)] overflow-y-auto px-6 py-5">
          <ol className="grid gap-2 md:grid-cols-2">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl border border-white/6 bg-white/[0.025] p-3.5">
                <div className="font-mono text-[10px] text-cyan-200/70">{s.n}</div>
                <div className="mt-1 text-[13.5px] font-medium text-[#efeae0]">{s.title}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-[#8c867b]">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
