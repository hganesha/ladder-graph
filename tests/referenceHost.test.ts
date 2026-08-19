import { describe, expect, it } from "vitest";
import claim from "../fixtures/reference-host/insurance-claim.json";
import { compileBundleWasm as compileBundleFallback } from "./wasmCompiler";
import { ARTIFACT_TEMPLATES } from "../src/generated/artifactCatalog";
import { WORKFLOW_TEMPLATES } from "../src/generated/catalogTestFixtures";
import type { ResolvedBundleAsset } from "../src/types";

function insuranceAssets(): ResolvedBundleAsset[] {
  const workflow = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === "wf-insr-01");
  if (!workflow) throw new Error("Insurance workflow fixture is required.");
  return [
    { ref: "ladder://workflows/builtin/wf-insr-01", source: workflow.yaml },
    ...ARTIFACT_TEMPLATES.filter((artifact) => artifact.kind !== "workflow-bundle").map((artifact) => ({
      ref: artifact.ref,
      source: artifact.yaml,
    })),
  ];
}

function accepts(schema: Record<string, unknown>, value: Record<string, unknown>) {
  const required = (schema.required ?? []) as string[];
  const properties = schema.properties as Record<string, { type?: string; format?: string }>;
  if (required.some((name) => !(name in value))) return false;
  return Object.entries(value).every(([name, field]) => {
    const contract = properties[name];
    if (!contract) return false;
    if (contract.type === "number" && typeof field !== "number") return false;
    if (contract.type === "boolean" && typeof field !== "boolean") return false;
    return contract.type !== "string" || typeof field === "string";
  });
}

describe("insurance bundle reference host", () => {
  it("consumes compiled workflow and form contracts without rewriting schemas", async () => {
    const bundle = ARTIFACT_TEMPLATES.find((artifact) => artifact.id === "insurance-claim-review");
    if (!bundle) throw new Error("Insurance bundle fixture is required.");
    const result = await compileBundleFallback(bundle.yaml, insuranceAssets(), "typescript");
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);

    const form = result.artifacts.find((artifact) => artifact.path === "forms/first-notice-of-loss.schema.json");
    const workflow = result.artifacts.find((artifact) => artifact.path.startsWith("workflow/"));
    const lock = result.artifacts.find((artifact) => artifact.path === "ladder.lock.json");
    expect(form && workflow && lock).toBeTruthy();
    expect(accepts(JSON.parse(form!.content) as Record<string, unknown>, claim)).toBe(true);
    expect(workflow!.content).toContain("wf-insr-01");
    expect(JSON.parse(lock!.content).assets).toHaveLength(5);
  });
});
