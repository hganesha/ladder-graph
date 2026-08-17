import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { analyzeFallback } from "../src/compiler/fallback";
import { materializeMacro } from "../src/lib/macros";
import { BLANK_WORKFLOW } from "../src/lib/templates";
import type { Workflow } from "../src/types";

function withMacro(kind: "debate" | "brainstorm") {
  const workflow = parse(BLANK_WORKFLOW) as Workflow;
  const materialized = materializeMacro(workflow, kind);
  workflow.spec.nodes = materialized.nodes;
  workflow.spec.edges = materialized.edges;
  return workflow;
}

describe("compositional deliberation macros", () => {
  it("materializes bounded debate from canonical primitives with explicit round carry", async () => {
    const workflow = withMacro("debate");
    const loop = workflow.spec.nodes.find((node) => node.kind === "loop");
    const panel = workflow.spec.nodes.find((node) => node.kind === "group");
    const condition = workflow.spec.nodes.find((node) => node.kind === "condition");
    const analysis = await analyzeFallback(stringify(workflow));

    expect(analysis.ok).toBe(true);
    expect(new Set(workflow.spec.nodes.map((node) => node.kind))).not.toContain("debate");
    expect(panel?.config).toEqual(expect.objectContaining({ execution: "parallel", exit: "aggregate" }));
    expect(loop?.config).toEqual(
      expect.objectContaining({
        maxIterations: 3,
        onExhausted: "continue",
        carry: expect.objectContaining({
          moderator: expect.stringMatching(/^\/results\//),
          positions: expect.stringMatching(/^\/results\//),
        }),
      }),
    );
    expect(condition?.config?.branches?.map((branch) => branch.when)).toEqual(["consensus", "continue"]);
    expect(workflow.spec.edges.filter((edge) => edge.from === loop?.id).map((edge) => edge.condition)).toEqual([
      "loop_exit",
      "loop_exhausted",
    ]);
  });

  it("materializes brainstorming as independent ideation, clustering, ranking, and refinement", async () => {
    const workflow = withMacro("brainstorm");
    const analysis = await analyzeFallback(stringify(workflow));
    const names = workflow.spec.nodes.map((node) => node.name);
    const panel = workflow.spec.nodes.find((node) => node.name === "Independent ideation");

    expect(analysis.ok).toBe(true);
    expect(new Set(workflow.spec.nodes.map((node) => node.kind))).not.toContain("brainstorm");
    expect(panel?.config).toEqual(expect.objectContaining({ execution: "parallel", exit: "serialize" }));
    expect(names).toEqual(expect.arrayContaining(["Cluster distinct ideas", "Rank brainstorm candidates", "Refine top ideas"]));
  });
});
