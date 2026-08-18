import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import StructuredArtifactStudio from "../src/components/artifacts/StructuredArtifactStudio";
import { db } from "../src/lib/persistence";

const { analyzeArtifact, sliceOntology } = vi.hoisted(() => ({ analyzeArtifact: vi.fn(), sliceOntology: vi.fn() }));

vi.mock("../src/compiler/client", () => ({ compiler: { analyzeArtifact, sliceOntology } }));

describe("structured artifact studio", () => {
  beforeEach(() => {
    analyzeArtifact.mockReset();
    analyzeArtifact.mockImplementation(async (source: string) => ({
      ok: true,
      sourceHash: "artifact-hash",
      diagnostics: [],
      normalized: parse(source),
    }));
    sliceOntology.mockReset();
    sliceOntology.mockResolvedValue({
      ok: true,
      sourceHash: "artifact-hash",
      selectionHash: "selection-hash",
      includedTypeIds: ["part_material"],
      includedPropertyRefs: ["part_material.part_number"],
      includedRelationshipIds: ["supplied_by"],
      inclusionReasons: { part_material: ["selected type"] },
      diagnostics: [],
    });
  });

  afterEach(async () => {
    cleanup();
    await db.projects.clear();
    await db.revisions.clear();
  });

  it("explores the imported Lattice ontology without importing Lattice runtime concerns", async () => {
    render(<StructuredArtifactStudio artifactKind="ontology" initialTemplateId="manufacturing" onBack={() => undefined} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Manufacturing Ontology" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Ontology relationship canvas" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ontology selection inspector")).toHaveTextContent("Part or Material");
    expect(screen.getByLabelText("Search ontology canvas")).toBeInTheDocument();
    expect(screen.getByText("lattice source")).toBeInTheDocument();
    expect((screen.getByLabelText("Ontology YAML source") as HTMLTextAreaElement).value).toContain("kind: Ontology");
    await waitFor(() => expect(screen.getByText("Valid ontology")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Preview sliver" }));
    await waitFor(() => expect(sliceOntology).toHaveBeenCalledWith(expect.any(String), { typeIds: ["part_material"] }));
    expect(screen.getByText("part_material: selected type")).toBeInTheDocument();

    const source = screen.getByLabelText("Ontology YAML source") as HTMLTextAreaElement;
    fireEvent.change(source, { target: { value: source.value.replace("part_material.part_number", "part_material.part_number_v2") } });
    expect(await screen.findByText("Breaking ontology change")).toBeInTheDocument();
    expect(screen.getByText(/Removed property part_material\.part_number/)).toBeInTheDocument();
  });

  it("edits and saves a DocuBricks document contract independently", async () => {
    render(
      <StructuredArtifactStudio
        artifactKind="document"
        initialTemplateId="docubricks-manufacturing-certificate-of-analysis"
        onBack={() => undefined}
      />,
    );

    const source = await screen.findByLabelText("Document YAML source");
    expect(screen.getByRole("heading", { level: 1, name: "Certificate Of Analysis" })).toBeInTheDocument();
    fireEvent.change(source, {
      target: { value: String((source as HTMLTextAreaElement).value).replace("Certificate Of Analysis", "Reviewed Certificate") },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save document" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Save document" }));

    await waitFor(async () => expect(await db.projects.count()).toBe(1));
    expect((await db.projects.toArray())[0]).toMatchObject({ artifactKind: "document", name: "Reviewed Certificate" });
  });
});
