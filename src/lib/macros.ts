import type { LgirEdge, LgirNode, NodeKind, Workflow } from "../types";
import { groupMemberPosition } from "./layout";
import { defaultNode } from "./nodeMeta";

export type MacroKind = "parallel" | "pipeline" | "reduce" | "verify" | "debate" | "brainstorm";

export interface MaterializedMacro {
  nodes: LgirNode[];
  edges: LgirEdge[];
}

function placeGroupMembers(group: LgirNode, members: LgirNode[]) {
  const position = group.position ?? { x: 0, y: 0 };
  members.forEach((member, index) => {
    const relative = groupMemberPosition(group, index);
    member.position = { x: position.x + relative.x, y: position.y + relative.y };
  });
}

export function materializeMacro(workflow: Workflow, macro: MacroKind): MaterializedMacro {
  const offset = workflow.spec.nodes.length + 1;
  const nodes = [...workflow.spec.nodes];
  const edges = [...workflow.spec.edges];
  const added: LgirNode[] = [];
  const add = (kind: NodeKind) => {
    const node = defaultNode(kind, offset + added.length);
    nodes.push(node);
    added.push(node);
    return node;
  };
  const connect = (suffix: string, from: LgirNode, to: LgirNode, kind: LgirEdge["kind"], condition?: string) => {
    edges.push({ id: `macro-${macro}-${offset}-${suffix}`, from: from.id, to: to.id, kind, ...(condition ? { condition } : {}) });
  };

  if (macro === "parallel") {
    const left = add("agent");
    left.name = "Parallel branch A";
    const right = add("agent");
    right.name = "Parallel branch B";
    const join = add("join");
    join.name = "Parallel join";
    connect("a", left, join, "dependency");
    connect("b", right, join, "dependency");
  } else if (macro === "pipeline") {
    const first = add("agent");
    first.name = "Pipeline step 1";
    const second = add("agent");
    second.name = "Pipeline step 2";
    edges.push({ id: `macro-pipeline-${offset}`, from: first.id, to: second.id, kind: "data", contract: "StepResult" });
  } else if (macro === "reduce") {
    const transform = add("transform");
    transform.name = "Deduplicate results";
    transform.config = { operation: "deduplicate", expression: "$.items by $.id" };
  } else if (macro === "verify") {
    const evaluator = add("evaluate");
    evaluator.name = "Independent verification";
  } else if (macro === "debate") {
    const advocate = add("agent");
    advocate.name = "Independent position A";
    advocate.role = "Evidence-grounded advocate";
    const challenger = add("agent");
    challenger.name = "Independent position B";
    challenger.role = "Independent challenger";
    const panel = add("group");
    panel.name = "Independent debate round";
    panel.summary = "Run both positions independently from the same round input, then release both results together.";
    panel.config = { members: [advocate.id, challenger.id], execution: "parallel", exit: "aggregate" };
    const moderator = add("evaluate");
    moderator.name = "Debate moderator";
    moderator.role = "Independent consensus moderator";
    moderator.prompt =
      "Compare both positions against the supplied evidence. Identify common ground, material disagreements, unsupported claims, and the strongest answer currently justified. Set consensusReached only when the remaining disagreement cannot change the answer. Never force agreement or reward verbosity.";
    moderator.outputSchema = {
      type: "object",
      required: ["consensusReached", "commonGround", "unresolved", "proposedAnswer", "confidence"],
      properties: {
        consensusReached: { type: "boolean" },
        commonGround: { type: "array", items: { type: "string" } },
        unresolved: { type: "array", items: { type: "string" } },
        proposedAnswer: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
    };
    const consensus = add("condition");
    consensus.name = "Consensus reached?";
    consensus.config = {
      expression: "moderator.consensusReached",
      branches: [
        { label: "Consensus", when: "consensus" },
        { label: "Continue debate", when: "continue" },
      ],
    };
    const loop = add("loop");
    loop.name = "Bounded debate rounds";
    loop.summary = "Repeat the independent positions and moderation with the prior round carried explicitly into the next round.";
    loop.config = {
      body: [panel.id, moderator.id, consensus.id],
      entry: panel.id,
      exitNode: consensus.id,
      exitCondition: "moderator.consensusReached == true",
      maxIterations: 3,
      onExhausted: "continue",
      carry: {
        moderator: `/results/${moderator.id}`,
        positions: `/results/${panel.id}`,
      },
    };
    const synthesis = add("agent");
    synthesis.name = "Debate synthesis";
    synthesis.role = "Decision-focused synthesizer";
    synthesis.prompt =
      "Return the strongest answer supported by the latest moderated round. Preserve unresolved disagreements and confidence limits instead of manufacturing consensus. Read carried context from the debate loop state when present.";
    advocate.prompt = `Develop the strongest evidence-grounded position for the requested outcome. Work independently in the first round. In later rounds, inspect /loopState/${loop.id}/moderator and /loopState/${loop.id}/positions, directly address the strongest unresolved objection, and state what evidence would change your conclusion.`;
    challenger.prompt = `Develop a genuinely independent alternative or challenge to the requested outcome. Work independently in the first round. In later rounds, inspect /loopState/${loop.id}/moderator and /loopState/${loop.id}/positions, test the strongest current claim, and concede points that the evidence resolves.`;
    placeGroupMembers(panel, [advocate, challenger]);
    connect("panel-moderator", panel, moderator, "data");
    connect("moderator-consensus", moderator, consensus, "data");
    connect("moderator-synthesis", moderator, synthesis, "data");
    connect("consensus-synthesis", consensus, synthesis, "control", "consensus");
    connect("continue-loop", consensus, loop, "control", "continue");
    connect("loop-exit", loop, synthesis, "control", "loop_exit");
    connect("loop-exhausted", loop, synthesis, "control", "loop_exhausted");
  } else {
    const explorer = add("agent");
    explorer.name = "Idea explorer A";
    explorer.role = "Divergent idea generator";
    explorer.prompt =
      "Generate distinct, feasible ideas without seeing another model's candidates. State the premise, expected benefit, and largest risk for each idea.";
    const reframer = add("agent");
    reframer.name = "Idea explorer B";
    reframer.role = "Independent problem reframer";
    reframer.prompt =
      "Reframe the problem independently and generate alternatives from different assumptions. State the premise, expected benefit, and largest risk for each idea.";
    const panel = add("group");
    panel.name = "Independent ideation";
    panel.summary = "Generate ideas independently before either model can anchor the other.";
    panel.config = { members: [explorer.id, reframer.id], execution: "parallel", exit: "serialize" };
    const deduplicate = add("transform");
    deduplicate.name = "Cluster distinct ideas";
    deduplicate.config = { operation: "deduplicate", expression: "$.items by normalized premise and expected outcome" };
    const rank = add("evaluate");
    rank.name = "Rank brainstorm candidates";
    rank.role = "Evidence-aware idea evaluator";
    rank.prompt =
      "Rank the distinct ideas against the stated objective, feasibility, expected value, reversibility, and risk. Preserve unconventional candidates when evidence is insufficient to eliminate them.";
    const refine = add("agent");
    refine.name = "Refine top ideas";
    refine.role = "Practical concept developer";
    refine.prompt =
      "Develop the strongest candidates into concise proposals with assumptions, first test, success signal, cost, and major risk. Keep meaningfully different options separate.";
    placeGroupMembers(panel, [explorer, reframer]);
    connect("panel-cluster", panel, deduplicate, "data");
    connect("cluster-rank", deduplicate, rank, "data");
    connect("rank-refine", rank, refine, "data");
  }

  return { nodes, edges };
}
