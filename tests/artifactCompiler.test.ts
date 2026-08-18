import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import {
  analyzeArtifactFallback,
  compileBundleFallback,
  formatArtifactFallback,
  sliceOntologyFallback,
} from "../src/compiler/artifacts/fallback";
import { compileFallback } from "../src/compiler/fallback";
import { ARTIFACT_TEMPLATES } from "../src/generated/artifactCatalog";
import { WORKFLOW_TEMPLATES } from "../src/generated/catalog";
import type { LadderForm, Ontology, ResolvedBundleAsset, WorkflowBundle } from "../src/types";

const bundleTemplate = ARTIFACT_TEMPLATES.find((artifact) => artifact.id === "insurance-claim-review");
const ontologyTemplate = ARTIFACT_TEMPLATES.find((artifact) => artifact.id === "insurance");
const insuranceWorkflow = WORKFLOW_TEMPLATES.find((workflow) => workflow.id === "wf-insr-01");

function insuranceAssets(): ResolvedBundleAsset[] {
  if (!insuranceWorkflow) throw new Error("Insurance workflow fixture is required.");
  return [
    { ref: "ladder://workflows/builtin/wf-insr-01", source: insuranceWorkflow.yaml },
    ...ARTIFACT_TEMPLATES.filter((artifact) => artifact.kind !== "workflow-bundle").map((artifact) => ({
      ref: artifact.ref,
      source: artifact.yaml,
    })),
  ];
}

function assetsForBundle(bundle: WorkflowBundle): ResolvedBundleAsset[] {
  const workflowId = bundle.spec.workflowRef.split("/").at(-1);
  const workflow = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === workflowId);
  if (!workflow) throw new Error(`Workflow fixture ${workflowId} is required.`);
  return [
    { ref: bundle.spec.workflowRef, source: workflow.yaml },
    ...ARTIFACT_TEMPLATES.filter((artifact) => artifact.kind !== "workflow-bundle").map((artifact) => ({
      ref: artifact.ref,
      source: artifact.yaml,
    })),
  ];
}

describe("artifact fallback compiler", () => {
  it("analyzes every bundled ontology, form, document, and workflow bundle", async () => {
    for (const artifact of ARTIFACT_TEMPLATES) {
      const result = await analyzeArtifactFallback(artifact.yaml);
      expect(result.ok, `${artifact.id}: ${JSON.stringify(result.diagnostics)}`).toBe(true);
      expect(result.sourceHash).not.toBe("");
      expect(result.normalized?.metadata.name).toBe(artifact.id);
    }
  });

  it("builds a deterministic ontology sliver with explicit inclusion reasons", async () => {
    if (!ontologyTemplate) throw new Error("Insurance ontology fixture is required.");
    const selection = {
      propertyRefs: ["insurance_claim.claim_number", "loss_event.loss_date"],
      relationshipIds: ["arises_from"],
    };
    const [first, second] = await Promise.all([
      sliceOntologyFallback(ontologyTemplate.yaml, selection),
      sliceOntologyFallback(ontologyTemplate.yaml, selection),
    ]);

    expect(first.ok).toBe(true);
    expect(first).toEqual(second);
    expect(first.includedTypeIds).toEqual(["insurance_claim", "loss_event"]);
    expect(first.includedRelationshipIds).toEqual(["arises_from"]);
    expect(first.includedPropertyRefs).toContain("insurance_claim.claim_number");
    expect(first.ontology?.spec.types.some((type) => type.id === "insurance_organization")).toBe(false);
    expect(first.inclusionReasons.arises_from).toContain("Explicit relationship selection");
  });

  it("compiles the insurance bundle into workflow, form, document, ontology, and lock artifacts", async () => {
    if (!bundleTemplate || !insuranceWorkflow) throw new Error("Insurance bundle fixtures are required.");
    const result = await compileBundleFallback(bundleTemplate.yaml, insuranceAssets(), "codex");
    const workflowOnly = await compileFallback(insuranceWorkflow.yaml, "codex");

    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(result.artifacts.map((artifact) => artifact.path)).toEqual(
      expect.arrayContaining([
        "bundle.yaml",
        "ladder.lock.json",
        "workflow/wf-insr-01.codex.md",
        "forms/first-notice-of-loss.schema.json",
        "forms/claim-review-decision.ui.json",
        "documents/insurance-claim-file.schema.json",
        "ontology/insurance-sliver.yaml",
        "ontology/insurance-sliver.reasons.json",
      ]),
    );
    expect(result.artifacts.find((artifact) => artifact.path.startsWith("workflow/"))?.content).toBe(workflowOnly.content);
    const ontologyContent = result.artifacts.find((artifact) => artifact.path.endsWith("-sliver.yaml"))?.content;
    expect(ontologyContent).not.toContain("sourcePath:");
    expect(ontologyContent).not.toContain("sourceDigest:");
    expect(ontologyContent).not.toContain("selection sha256:");
    expect(result.lockfile?.assets).toHaveLength(5);
    expect(result.capabilityReport.unsupported).toEqual([]);
  });

  it("compiles every curated workflow bundle with all referenced assets resolved", async () => {
    for (const template of ARTIFACT_TEMPLATES.filter((artifact) => artifact.kind === "workflow-bundle")) {
      const bundle = parse(template.yaml) as WorkflowBundle;
      const result = await compileBundleFallback(template.yaml, assetsForBundle(bundle), "codex");
      expect(result.ok, `${template.id}: ${JSON.stringify(result.diagnostics)}`).toBe(true);
      expect(result.lockfile?.bundle).toBe(template.id);
      expect(result.artifacts).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "bundle.yaml" }), expect.objectContaining({ path: "ladder.lock.json" })]),
      );
    }
  });

  it("fails compilation for unresolved pointers and incompatible ontology bindings", async () => {
    if (!bundleTemplate || !ontologyTemplate) throw new Error("Insurance bundle fixtures are required.");
    const bundle = parse(bundleTemplate.yaml) as WorkflowBundle;
    bundle.spec.bindings![0].target.path = "/spec/nodes/999";
    const formAsset = ARTIFACT_TEMPLATES.find((artifact) => artifact.id === "first-notice-of-loss");
    if (!formAsset) throw new Error("FNOL fixture is required.");
    const form = parse(formAsset.yaml) as LadderForm;
    form.spec.pages[0].sections[2].fields[0].dataType = "boolean";
    const assets = insuranceAssets().map((asset) => (asset.ref === formAsset.ref ? { ...asset, source: stringify(form) } : asset));

    const result = await compileBundleFallback(stringify(bundle), assets, "typescript");

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "LB211" }), expect.objectContaining({ code: "LB213" })]),
    );
    expect(result.artifacts).toEqual([]);
  });

  it("formats valid artifacts and rejects executable YAML features", async () => {
    if (!ontologyTemplate) throw new Error("Insurance ontology fixture is required.");
    const formatted = await formatArtifactFallback(ontologyTemplate.yaml);
    const hostile = await analyzeArtifactFallback("kind: Ontology\nspec: &shared {}\ncopy: *shared\n");

    expect(formatted.ok).toBe(true);
    expect(formatted.content).toContain("kind: Ontology");
    expect(hostile.diagnostics[0].code).toBe("LA004");
  });

  it("reports unknown sliver seeds instead of silently dropping them", async () => {
    if (!ontologyTemplate) throw new Error("Insurance ontology fixture is required.");
    const ontology = parse(ontologyTemplate.yaml) as Ontology;
    const result = await sliceOntologyFallback(stringify(ontology), { propertyRefs: ["claim.unknown"] });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "LO202" }));
  });
});
