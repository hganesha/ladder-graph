import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse, stringify } from "yaml";
import BundleStudio from "../src/components/BundleStudio";
import { WORKFLOW_TEMPLATES } from "../src/generated/catalog";
import { db } from "../src/lib/persistence";
import type { BundleCompileResult } from "../src/types";

const compileResult: BundleCompileResult = {
  ok: true,
  artifacts: [
    {
      path: "ontology/insurance-sliver.yaml",
      mimeType: "application/yaml",
      sourceHash: "ontology-hash",
      content: `apiVersion: ladder.dev/v1alpha1
kind: Ontology
metadata:
  name: insurance-sliver
spec:
  types:
    - id: insurance_claim
      label: Insurance Claim
      properties:
        - id: insurance_claim.claim_number
          label: Claim Number
          dataType: string
  relationships: []
`,
    },
    {
      path: "ladder.lock.json",
      mimeType: "application/json",
      sourceHash: "lock-hash",
      content: "{}\n",
    },
  ],
  lockfile: {
    lockVersion: 1,
    bundle: "insurance-claim-review",
    target: "codex",
    sourceHash: "bundle-hash",
    assets: [
      { ref: "ladder://workflows/builtin/wf-insr-01", kind: "Workflow", name: "wf-insr-01", version: "1.0.0", sourceHash: "workflow-hash" },
    ],
  },
  diagnostics: [],
  capabilityReport: { target: "codex", native: [], instructional: [], unsupported: [] },
};

const { analyzeArtifact, compileBundle } = vi.hoisted(() => ({ analyzeArtifact: vi.fn(), compileBundle: vi.fn() }));

vi.mock("../src/compiler/client", () => ({ compiler: { analyzeArtifact, compileBundle } }));

describe("bundle workspace", () => {
  beforeEach(() => {
    compileBundle.mockReset();
    compileBundle.mockResolvedValue(compileResult);
    analyzeArtifact.mockReset();
    analyzeArtifact.mockImplementation(async (source: string) => ({
      ok: true,
      sourceHash: "artifact-hash",
      diagnostics: [],
      normalized: parse(source),
    }));
  });
  afterEach(async () => {
    cleanup();
    await db.bundleAssets.clear();
    await db.revisions.clear();
    await db.projects.clear();
  });

  it("compiles the insurance starter and exposes workflow, form, and ontology graph previews", async () => {
    render(<BundleStudio onBack={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Insurance claim review bundle" })).toBeInTheDocument();
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Compiled output" }));
    expect(screen.getByRole("navigation", { name: "Agent-ready content" })).toBeInTheDocument();
    expect(screen.getAllByText("Insurance Sliver ontology context")).toHaveLength(2);
    expect(screen.queryByText("ontology/insurance-sliver.yaml")).not.toBeInTheDocument();
    expect(screen.queryByText("ladder.lock.json")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Workflow graph" }));
    expect(screen.getByRole("tabpanel")).toHaveClass("bundle-tab-panel-workflow");
    expect(screen.getByRole("region", { name: "Bundled workflow graph canvas" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bundled workflow inspector")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Form preview" }));
    expect(screen.getByLabelText("Insurance policy number")).toBeRequired();
    expect(screen.getByText("insurance_policy.policy_number")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Ontology sliver" }));
    expect(screen.getByRole("region", { name: "Ontology relationship canvas" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bundled ontology inspector")).toHaveTextContent("Insurance Claim");
    expect(screen.getByText("1 included properties")).toBeInTheDocument();
  });

  it("reveals compiled output after a manual compile and keeps validation in context", async () => {
    render(<BundleStudio onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Compile bundle" }));
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("tab", { name: "Compiled output" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("navigation", { name: "Agent-ready content" })).toBeInTheDocument();
    expect(screen.getByText("Bundle compiled: 2 deterministic files.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Bundle & bindings" }));
    fireEvent.change(screen.getByLabelText("Bundle title"), { target: { value: "Validated bundle" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate changes" }));
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("tab", { name: "Bundle & bindings" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Bundle validated: 2 deterministic files.")).toBeInTheDocument();
  });

  it("edits the attached workflow source and recompiles it as a bundle-owned asset", async () => {
    render(<BundleStudio onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Workflow graph" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit workflow YAML" }));
    const editor = screen.getByLabelText("Bundled workflow YAML source") as HTMLTextAreaElement;
    const workflow = parse(editor.value);
    workflow.metadata.title = "Editable bundled workflow";
    fireEvent.change(editor, { target: { value: stringify(workflow) } });
    fireEvent.click(screen.getByRole("button", { name: "Apply workflow changes" }));

    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(2));
    const editedAssets = compileBundle.mock.calls.at(-1)?.[1] as Array<{ ref: string; source: string }>;
    expect(editedAssets.find((asset) => asset.ref.endsWith("/wf-insr-01"))?.source).toContain("Editable bundled workflow");
    expect(screen.getByRole("heading", { name: "Editable bundled workflow" })).toBeInTheDocument();
  });

  it("edits the attached workflow visually and recompiles the bundle-owned asset", async () => {
    render(<BundleStudio onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Workflow graph" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit workflow visually" }));
    fireEvent.change(screen.getByLabelText("Selected workflow node name"), { target: { value: "Visually edited intake" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Agent" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply visual changes" }));

    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(2));
    const editedAssets = compileBundle.mock.calls.at(-1)?.[1] as Array<{ ref: string; source: string }>;
    const editedWorkflow = editedAssets.find((asset) => asset.ref.endsWith("/wf-insr-01"))?.source;
    expect(editedWorkflow).toContain("Visually edited intake");
    expect(editedWorkflow).toContain("name: Agent");
  });

  it("attaches, replaces, and removes the bundle ontology from the visual accordion", async () => {
    render(<BundleStudio initialTemplateId="__new__" onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Attach Insurance ontology" }));
    await waitFor(() => expect(compileBundle.mock.calls.at(-1)?.[0]).toContain("ladder://ontologies/builtin/insurance"));

    fireEvent.click(screen.getByRole("button", { name: "Attach Manufacturing ontology" }));
    await waitFor(() => expect(compileBundle.mock.calls.at(-1)?.[0]).toContain("ladder://ontologies/builtin/manufacturing"));

    fireEvent.click(screen.getByRole("button", { name: "Remove Manufacturing ontology" }));
    await waitFor(() => expect(compileBundle.mock.calls.at(-1)?.[0]).not.toContain("ontology:"));
  });

  it("opens a selected curated bundle instead of always falling back to insurance", async () => {
    render(<BundleStudio initialTemplateId="manufacturing-line-qualification" onBack={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Manufacturing line qualification bundle" })).toBeInTheDocument();
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));
    expect(compileBundle.mock.calls[0][0]).toContain("name: manufacturing-line-qualification");
    expect(screen.getByRole("button", { name: "Restore Manufacturing line qualification bundle" })).toBeInTheDocument();
  });

  it("creates a blank first-class bundle and edits its identity", async () => {
    render(<BundleStudio initialTemplateId="__new__" onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    expect(screen.getByRole("heading", { name: "Name and version" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Bundle title"), { target: { value: "My governed bundle" } });
    fireEvent.change(screen.getByLabelText("Bundle slug"), { target: { value: "my-governed-bundle" } });
    expect(screen.getByText("Changes pending validation")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Validate changes" }));
    await waitFor(() => expect(compileBundle.mock.calls.at(-1)?.[0]).toContain("title: My governed bundle"));
    expect(compileBundle.mock.calls.at(-1)?.[0]).toContain("name: my-governed-bundle");
  });

  it("assembles bundles from saved workflows and saved ontology projects", async () => {
    const now = Date.now();
    await db.projects.bulkPut([
      {
        id: "local-workflow",
        name: "My saved workflow",
        artifactKind: "workflow",
        yaml: WORKFLOW_TEMPLATES[0].yaml,
        lastValidYaml: WORKFLOW_TEMPLATES[0].yaml,
        target: "codex",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "local-ontology",
        name: "My OWL ontology",
        artifactKind: "ontology",
        yaml: `apiVersion: ladder.dev/v1alpha1
kind: Ontology
metadata:
  name: my-owl-ontology
  title: My OWL ontology
  version: 1.0.0
spec:
  types:
    - id: asset
      label: Asset
      properties: []
  relationships: []
`,
        lastValidYaml: "",
        target: "codex",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    render(<BundleStudio initialTemplateId="__new__" onBack={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("option", { name: "My library · Draft, critique, revise" })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Workflow"), { target: { value: "local-workflow" } });
    await waitFor(() => expect(compileBundle.mock.calls.at(-1)?.[0]).toContain("ladder://workflows/local/local-workflow"));
    expect(compileBundle.mock.calls.at(-1)?.[1]).toEqual(
      expect.arrayContaining([expect.objectContaining({ ref: "ladder://workflows/local/local-workflow" })]),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Attach My OWL ontology" }));
    await waitFor(() => expect(compileBundle.mock.calls.at(-1)?.[0]).toContain("ladder://ontologies/local/local-ontology"));
  });

  it("shows the asset library as a one-open-section accordion", async () => {
    render(<BundleStudio onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    const ontologies = screen.getByRole("button", { name: /^Ontologies,/ });
    const forms = screen.getByRole("button", { name: /^Forms,/ });
    const documents = screen.getByRole("button", { name: /^Documents,/ });
    expect(ontologies).toHaveAttribute("aria-expanded", "true");
    expect(forms).toHaveAttribute("aria-expanded", "false");
    expect(documents).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("region", { name: "Ontologies library" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Full ontology" })).toHaveLength(1);

    fireEvent.click(forms);
    expect(ontologies).toHaveAttribute("aria-expanded", "false");
    expect(forms).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Forms library" })).toBeInTheDocument();

    fireEvent.click(documents);
    expect(forms).toHaveAttribute("aria-expanded", "false");
    expect(documents).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("region", { name: /^(Ontologies|Forms|Documents) library$/ })).toHaveLength(1);
  });

  it("creates a blank bundle-owned form and opens it in the visual editor", async () => {
    render(<BundleStudio onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /^Forms,/ }));
    fireEvent.click(screen.getByRole("button", { name: "New form" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Untitled form" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add field to Section 1" }));
    expect((await screen.findAllByText("New field")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Apply to bundle" }));

    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(2));
    expect(compileBundle.mock.calls.at(-1)?.[0]).toContain("ladder://forms/local/insurance-claim-review-form");
    expect(compileBundle.mock.calls.at(-1)?.[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: "ladder://forms/local/insurance-claim-review-form",
          source: expect.stringContaining("label: New field"),
        }),
      ]),
    );
    expect(screen.getByRole("tab", { name: "Form preview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("New field")).toBeInTheDocument();
  });

  it("switches between deterministic sliver and full ontology compilation", async () => {
    render(<BundleStudio onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Full ontology" }));

    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(2));
    expect(compileBundle.mock.calls[1][0]).toContain("mode: full");
  });

  it("creates a bundle for another workflow and authors an explicit binding", async () => {
    render(<BundleStudio onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText("Workflow"), { target: { value: "evidence-research" } });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Evidence research bundle" })).toBeInTheDocument());
    expect(compileBundle.mock.calls.at(-1)?.[0]).toContain("ladder://workflows/builtin/evidence-research");

    fireEvent.click(screen.getByRole("button", { name: /^Forms,/ }));
    fireEvent.click(screen.getByRole("button", { name: "Attach First Notice of Loss" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add binding" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add binding" }));
    expect(screen.getByLabelText("Binding binding-1 source asset")).toHaveValue("ladder://forms/builtin/first-notice-of-loss");
    expect(screen.getByText("Changes pending validation")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Validate changes" }));
    await waitFor(() => expect(compileBundle.mock.calls.at(-1)?.[0]).toContain("id: binding-1"));
  });

  it("recommends a curated bundle when a generic workflow has a domain pack", async () => {
    render(<BundleStudio onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.change(screen.getByLabelText("Workflow"), { target: { value: "wf-mfg-02" } });
    expect(await screen.findByText("Curated match: Manufacturing line qualification bundle")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use curated bundle" }));

    expect(await screen.findByRole("heading", { name: "Manufacturing line qualification bundle" })).toBeInTheDocument();
    expect(compileBundle.mock.calls.at(-1)?.[0]).toContain("name: manufacturing-line-qualification");
  });

  it("authors an ontology-bound field and recompiles the edited form into the bundle", async () => {
    render(<BundleStudio onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Form preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit form" }));

    expect(await screen.findByRole("heading", { name: "First Notice of Loss" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add Claim Number/ }));

    const label = await screen.findByLabelText("Label");
    fireEvent.change(label, { target: { value: "Claim reference" } });
    fireEvent.blur(label);
    await waitFor(() => expect(screen.getAllByText("Claim reference").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("tab", { name: "preview" }));
    expect(screen.getByLabelText("Claim Number")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply to bundle" }));
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(2));
    const editedAssets = compileBundle.mock.calls[1][1] as Array<{ ref: string; source: string }>;
    expect(editedAssets.find((asset) => asset.ref.endsWith("/first-notice-of-loss"))?.source).toContain("Claim reference");
  });

  it("searches the DocuBricks library and saves complete bundle history", async () => {
    render(<BundleStudio onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    const search = screen.getByLabelText("Search bundle assets");
    expect(search).toHaveAttribute("placeholder", "Search schemas…");
    fireEvent.change(search, { target: { value: "mortgage application" } });
    expect(screen.getByText("Mortgage Application")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Attach Mortgage Application" }));
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(screen.getByText("Bundle saved with a complete portable revision.")).toBeInTheDocument());
    expect(await db.projects.count()).toBe(1);
    expect(await db.bundleAssets.count()).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: /^History$/ }));
    expect(await screen.findByText("Latest save")).toBeInTheDocument();
  });
});
