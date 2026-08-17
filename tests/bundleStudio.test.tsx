import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import BundleStudio from "../src/components/BundleStudio";
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
  afterEach(cleanup);

  it("compiles the insurance starter and exposes form and ontology previews", async () => {
    render(<BundleStudio onBack={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Insurance claim review bundle" })).toBeInTheDocument();
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Form preview" }));
    expect(screen.getByLabelText("Insurance policy number")).toBeRequired();
    expect(screen.getByText("insurance_policy.policy_number")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Ontology sliver" }));
    expect(screen.getByText("Insurance Claim")).toBeInTheDocument();
    expect(screen.getByText("1 included properties")).toBeInTheDocument();
  });

  it("switches between deterministic sliver and full ontology compilation", async () => {
    render(<BundleStudio onBack={() => undefined} />);
    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Full ontology" }));

    await waitFor(() => expect(compileBundle).toHaveBeenCalledTimes(2));
    expect(compileBundle.mock.calls[1][0]).toContain("mode: full");
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
});
