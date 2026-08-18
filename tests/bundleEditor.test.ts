import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ARTIFACT_TEMPLATES } from "../src/generated/artifactCatalog";
import { WORKFLOW_TEMPLATES } from "../src/generated/catalog";
import {
  attachBundleArtifact,
  attachReferencedWorkflowContracts,
  bindingPathOptions,
  createBundleForWorkflow,
  detachBundleArtifact,
  nextBinding,
  replaceBundleWorkflow,
  resolveBundleAssets,
} from "../src/lib/bundleEditor";
import type { Workflow, WorkflowBundle } from "../src/types";

describe("general bundle editing", () => {
  it("creates a portable bundle around any catalog workflow", () => {
    const workflow = WORKFLOW_TEMPLATES.find((template) => template.id === "evidence-research");
    if (!workflow) throw new Error("Expected evidence research workflow.");

    const bundle = createBundleForWorkflow(workflow);
    const assets = resolveBundleAssets(bundle);

    expect(bundle.metadata.title).toBe("Evidence research bundle");
    expect(bundle.spec.workflowRef).toBe("ladder://workflows/builtin/evidence-research");
    expect(assets).toEqual([{ ref: bundle.spec.workflowRef, source: workflow.yaml }]);
  });

  it("attaches and detaches catalog assets while removing dangling bindings", () => {
    const starter = ARTIFACT_TEMPLATES.find((template) => template.id === "insurance-claim-review");
    const form = ARTIFACT_TEMPLATES.find((template) => template.id === "first-notice-of-loss");
    const workflow = WORKFLOW_TEMPLATES.find((template) => template.id === "evidence-research");
    if (!starter || !form || !workflow) throw new Error("Expected bundle fixtures.");
    const bundle = parse(starter.yaml) as WorkflowBundle;

    const changedWorkflow = replaceBundleWorkflow(bundle, workflow);
    expect(changedWorkflow.spec.bindings).toEqual([]);
    const withoutForm = detachBundleArtifact(changedWorkflow, form.ref);
    expect(withoutForm.spec.forms).toHaveLength(1);
    const restoredForm = attachBundleArtifact(withoutForm, form);
    expect(restoredForm.spec.forms?.map((asset) => asset.ref)).toContain(form.ref);
  });

  it("derives selectable binding points and creates a valid starter binding", () => {
    const workflow = WORKFLOW_TEMPLATES.find((template) => template.id === "evidence-research");
    const form = ARTIFACT_TEMPLATES.find((template) => template.id === "first-notice-of-loss");
    if (!workflow || !form) throw new Error("Expected binding fixtures.");
    const bundle = attachBundleArtifact(createBundleForWorkflow(workflow), form);
    const sources = Object.fromEntries(resolveBundleAssets(bundle).map((asset) => [asset.ref, asset.source]));

    expect(bindingPathOptions(workflow.yaml).some((option) => option.label.includes("Research question · input"))).toBe(true);
    expect(bindingPathOptions(form.yaml).some((option) => option.label.includes("Policy number"))).toBe(true);
    expect(nextBinding(bundle, sources)).toMatchObject({
      id: "binding-1",
      source: { ref: form.ref },
      target: { ref: bundle.spec.workflowRef },
      direction: "input",
    });
  });

  it("packages catalog contracts referenced by workflow nodes", () => {
    const workflowTemplate = WORKFLOW_TEMPLATES.find((template) => template.id === "evidence-research");
    const form = ARTIFACT_TEMPLATES.find((template) => template.id === "first-notice-of-loss");
    const document = ARTIFACT_TEMPLATES.find((template) => template.id === "fs-income-statement");
    if (!workflowTemplate || !form || !document) throw new Error("Expected contract fixtures.");
    const workflow = parse(workflowTemplate.yaml) as Workflow;
    workflow.spec.nodes[0].contractRefs = [
      { ref: form.ref, usage: "human-interaction" },
      { ref: document.ref, usage: "evidence" },
    ];

    const result = attachReferencedWorkflowContracts(createBundleForWorkflow(workflowTemplate), workflow, ARTIFACT_TEMPLATES);

    expect(result.attached.map((template) => template.ref)).toEqual([form.ref, document.ref]);
    expect(result.bundle.spec.forms?.map((asset) => asset.ref)).toContain(form.ref);
    expect(result.bundle.spec.documents?.map((asset) => asset.ref)).toContain(document.ref);
  });
});
