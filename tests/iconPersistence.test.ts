import { parse, stringify } from "yaml";
import { describe, expect, it } from "vitest";
import { analyzeArtifactFallback, sliceOntologyFallback } from "../src/compiler/artifacts/fallback";
import { analyzeFallback } from "../src/compiler/fallback";
import { createStudioStore } from "../src/store/useStudioStore";
import type { Ontology, Workflow } from "../src/types";
import { WORKFLOW_TEMPLATES } from "../src/lib/templates";

describe("icon persistence", () => {
  it("round-trips agent icons and rejects workflow icons outside exact agent nodes", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[0].yaml) as Workflow;
    const agent = workflow.spec.nodes.find((node) => node.kind === "agent");
    expect(agent).toBeDefined();
    agent!.icon = { set: "lucide", name: "search" };

    const valid = await analyzeFallback(stringify(workflow));
    expect(valid.normalized?.spec.nodes.find((node) => node.id === agent!.id)?.icon).toEqual({ set: "lucide", name: "search" });

    agent!.icon = { set: "lucide", name: "not-in-the-catalog" };
    const unknown = await analyzeFallback(stringify(workflow));
    expect(unknown.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG199", severity: "warning" })]));

    workflow.spec.nodes[0].icon = { set: "lucide", name: "database" };
    const invalid = await analyzeFallback(stringify(workflow));
    expect(invalid.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG198", severity: "error" })]));
  });

  it("removes an agent override from YAML when returning to automatic", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[0].yaml) as Workflow;
    const agent = workflow.spec.nodes.find((node) => node.kind === "agent")!;
    agent.icon = { set: "lucide", name: "search" };
    const store = createStudioStore({ initialSource: stringify(workflow), persist: false });
    store.setState({
      setSource: async (source) => {
        store.setState({ source });
      },
    });

    await store.getState().patchNode(agent.id, { icon: undefined });

    const updated = parse(store.getState().source) as Workflow;
    expect(updated.spec.nodes.find((node) => node.id === agent.id)?.icon).toBeUndefined();
  });

  it("retains ontology type icons through analysis and sliver generation", async () => {
    const ontology: Ontology = {
      apiVersion: "ladder.dev/v1alpha1",
      kind: "Ontology",
      metadata: { name: "icon-test", version: "1.0.0" },
      spec: {
        types: [{ id: "person", label: "Person", icon: { set: "lucide", name: "contact-round" }, properties: [] }],
        relationships: [],
      },
    };
    const source = stringify(ontology);

    const analysis = await analyzeArtifactFallback<Ontology>(source);
    const slice = await sliceOntologyFallback(source, { typeIds: ["person"] });

    expect(analysis.normalized?.spec.types[0].icon).toEqual({ set: "lucide", name: "contact-round" });
    expect(slice.ontology?.spec.types[0].icon).toEqual({ set: "lucide", name: "contact-round" });

    ontology.spec.types[0].icon = { set: "lucide", name: "not-in-the-catalog" };
    const unknown = await analyzeArtifactFallback<Ontology>(stringify(ontology));
    expect(unknown.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LO110", severity: "warning" })]));
  });
});
