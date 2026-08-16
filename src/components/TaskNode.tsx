import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDot,
  Combine,
  Database,
  GraduationCap,
  GitBranch,
  IterationCcw,
  LayoutPanelTop,
  LogIn,
  LogOut,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { memo } from "react";
import { NODE_META } from "../lib/nodeMeta";
import { inputContractLabel } from "../lib/inputContracts";
import type { LgirNode } from "../types";

type TaskFlowNode = Node<LgirNode, "task">;

const icons = {
  input: LogIn,
  output: LogOut,
  agent: Bot,
  tool: Wrench,
  transform: Database,
  condition: GitBranch,
  evaluate: ShieldCheck,
  teacher: GraduationCap,
  approval: CheckCircle2,
  join: Combine,
  aggregator: Combine,
  loop: IterationCcw,
  group: LayoutPanelTop,
  subgraph: CircleDot,
};

export const TaskNode = memo(function TaskNode({ data, selected }: NodeProps<TaskFlowNode>) {
  const meta = NODE_META[data.kind];
  const Icon = icons[data.kind];
  const incomplete =
    (data.kind === "agent" && !data.role) ||
    (data.kind === "teacher" && !data.config?.teacherModel) ||
    (data.kind === "loop" && !data.config?.maxIterations);
  const inputLabel = data.kind === "input" ? inputContractLabel(data.inputSchema) : null;
  const configLabel =
    inputLabel ??
    data.config?.teacherModel ??
    data.config?.aggregation ??
    data.config?.maxIterations ??
    data.config?.join ??
    data.config?.operation;
  return (
    <article
      className={`task-node ${selected ? "selected" : ""}`}
      style={{ "--node-color": meta.color } as React.CSSProperties}
      aria-label={`${meta.label}: ${data.name}`}
    >
      <Handle type="target" position={Position.Left} className="node-handle" />
      <header>
        <span className="node-icon">
          <Icon size={14} />
        </span>
        <span>{meta.label}</span>
        {incomplete && <AlertTriangle size={13} className="node-alert" aria-label="Incomplete configuration" />}
      </header>
      <h3>{data.name}</h3>
      <p>{data.summary || meta.hint}</p>
      <footer>
        {data.kind === "agent" || data.kind === "evaluate" ? (
          <span>{data.role || "Role needed"}</span>
        ) : (
          <span>{configLabel ? String(configLabel) : data.kind}</span>
        )}
        {(data.inputSchema || data.outputSchema) && <span className="contract-dot">contract</span>}
      </footer>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </article>
  );
});
