import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import StandaloneFormStudio from "../src/components/form/StandaloneFormStudio";
import { db } from "../src/lib/persistence";

const { analyzeArtifact } = vi.hoisted(() => ({ analyzeArtifact: vi.fn() }));

vi.mock("../src/compiler/client", () => ({ compiler: { analyzeArtifact } }));

describe("standalone form studio", () => {
  beforeEach(() => {
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
    await db.projects.clear();
    await db.revisions.clear();
  });

  it("opens a catalog form with its industry ontology and saves it independently", async () => {
    render(<StandaloneFormStudio initialTemplateId="docubricks-manufacturing-quality-inspection-report" onBack={() => undefined} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Quality Inspection Report" })).toBeInTheDocument();
    await waitFor(() => expect(analyzeArtifact).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Standalone form project")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));

    await waitFor(async () => expect(await db.projects.count()).toBe(1));
    expect((await db.projects.toArray())[0]).toMatchObject({
      artifactKind: "form",
      name: "Quality Inspection Report",
    });
    expect(await screen.findByText(/Standalone form · saved/)).toBeInTheDocument();
  });

  it("imports a JSON Schema into the form builder", async () => {
    render(<StandaloneFormStudio initialTemplateId="docubricks-manufacturing-quality-inspection-report" onBack={() => undefined} />);
    await screen.findByRole("heading", { level: 1, name: "Quality Inspection Report" });

    const input = screen.getByRole("button", { name: "Import JSON" }).parentElement?.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    const file = {
      name: "incident.schema.json",
      size: 120,
      text: vi.fn(async () => JSON.stringify({ title: "Incident intake", type: "object", properties: { summary: { type: "string" } } })),
    } as unknown as File;
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    expect(await screen.findByText("Imported 1 field from incident.schema.json.")).toBeInTheDocument();
    expect((await screen.findAllByText("Incident intake", { selector: "strong" })).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Summary").length).toBeGreaterThan(0);
  });
});
