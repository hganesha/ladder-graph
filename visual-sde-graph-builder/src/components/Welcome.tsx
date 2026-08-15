import type { ReactNode } from "react";
import mark from "../assets/mark.png";
import { TEMPLATES, blankFleet } from "../lib/templates";
import { ArrowRight, GitFork, ShieldCheck, Workflow } from "lucide-react";

interface WelcomeProps {
  onStart: (templateId: string) => void;
}

export function Welcome({ onStart }: WelcomeProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080b] text-[#efeae0]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-[520px] w-[520px] rounded-full bg-[#2ec4d6]/8 blur-[120px]" />
        <div className="absolute right-[-80px] top-24 h-[460px] w-[460px] rounded-full bg-[#e85d4c]/10 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-[380px] w-[380px] rounded-full bg-[#e8b84a]/8 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img src={mark} alt="" className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/10" />
          <div>
            <div className="font-display text-lg font-semibold tracking-[0.18em]">CODEZ</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8a8478]">Graph engineering</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onStart("blank")}
          className="hidden items-center gap-2 rounded-full border border-white/12 px-4 py-1.5 text-[12px] text-[#d7d1c5] hover:bg-white/5 sm:inline-flex"
        >
          Blank canvas
          <ArrowRight size={14} />
        </button>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">sDE agent fleets</p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Draw the shape of work.
          <span className="block text-[#9a9488]">Compile it to a workflow.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[#b7b1a4]">
          Nodes think. Edges carry validated data. JavaScript orchestrates at zero model tokens.
          Design DAGs and converging loops for Claude Code dynamic workflows — then take the script.
        </p>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          <Pillar
            icon={<Workflow size={16} />}
            title="Nodes & contracts"
            body="Every agent() is one job, one schema. Name the shape that crosses the edge — not the step order."
          />
          <Pillar
            icon={<GitFork size={16} />}
            title="DAG + loops"
            body="Fan out with parallel(), stream with pipeline(), or loop-until-dry with a seen-set and a cap."
          />
          <Pillar
            icon={<ShieldCheck size={16} />}
            title="Text you can run"
            body="Compile to a Claude Code script, a Mermaid map, a briefing, or portable JSON."
          />
        </div>

        <div className="mt-14 flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7d786e]">Six starter graphs</div>
            <h2 className="mt-1 font-display text-2xl">Open a topology</h2>
          </div>
          <button
            type="button"
            onClick={() => onStart(blankFleet().id)}
            className="text-[12px] text-[#9a9488] hover:text-[#efeae0]"
          >
            or start empty →
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onStart(t.id)}
              className="group rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-left transition hover:border-white/16 hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-3">
                <MiniTopo id={t.id} />
                <span className="rounded-full border border-white/8 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#9a9488]">
                  {t.tag}
                </span>
              </div>
              <div className="mt-4 font-display text-lg tracking-tight text-[#f3eee4]">{t.name}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200/60">{t.topology}</div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[#9a9488]">{t.blurb}</p>
              <div className="mt-4 flex items-center gap-1 text-[12px] text-[#d7d1c5] opacity-0 transition group-hover:opacity-100">
                Open in studio <ArrowRight size={13} />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-16 grid gap-3 border-t border-white/6 pt-10 md:grid-cols-4">
          {[
            ["agent()", "Spawn one bounded subagent with a schema."],
            ["parallel()", "Fan-out barrier. Failures become null."],
            ["pipeline()", "Stream a transform with no global wait."],
            ["phase()", "Label a stage in the /workflows UI."],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="font-mono text-[12px] text-[#2ec4d6]">{k}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8a8478]">{v}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.18em] text-[#5c5850]">
          Prompt · loop · harness · graph — design the shape first
        </p>
      </main>
    </div>
  );
}

function Pillar({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 p-4">
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-cyan-200">{icon}</div>
      <div className="font-medium text-[#efeae0]">{title}</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[#8c867b]">{body}</p>
    </div>
  );
}

function MiniTopo({ id }: { id: string }) {
  const paths: Record<string, string> = {
    research: "M20 8h40M40 8v16M16 40h16M40 40h16M56 40h16M24 40v16h32V40M40 56v16",
    "auth-audit": "M40 8v56",
    discovery: "M40 8v16M24 40h32M24 40v16h32V40M40 56v12M52 52c12 0 12-28 0-28",
    "diff-router": "M40 8v16L20 40v16M40 24l20 16v16M20 56h40",
    "module-port": "M40 8v16M24 40h32M24 40v16M56 40v16M40 56v8M56 48c10 0 10-24 0-24",
    ecosystem: "M40 8v16M16 40h16M40 40h16M56 40h16M24 40v16h32V40M40 56v12",
  };
  return (
    <svg viewBox="0 0 80 80" className="h-14 w-14 text-[#2ec4d6]/80">
      <rect x="1" y="1" width="78" height="78" rx="12" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
      <path d={paths[id] ?? "M20 40h40"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="40" cy="8" r="3" fill="#e85d4c" />
      <circle cx="40" cy="72" r="3" fill="#f0e6d0" />
    </svg>
  );
}
