import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "../src/components/Welcome";
import { listProjects } from "../src/lib/persistence";
import { roleTemplatesForSubject } from "../src/lib/roleTemplates";
import { WORKFLOW_TEMPLATES } from "../src/lib/templates";
import { useStudioStore } from "../src/store/useStudioStore";

vi.mock("../src/lib/persistence", () => ({
  listProjects: vi.fn(async () => []),
  saveProject: vi.fn(async () => ({ id: "test-project", updatedAt: Date.now() })),
  requestPersistentStorage: vi.fn(async () => false),
}));

const selectArea = (area: string) => {
  fireEvent.change(screen.getByLabelText("Subject area"), { target: { value: area } });
};

describe("welcome gallery", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(listProjects).mockResolvedValue([]);
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    document.documentElement.dataset.theme = "light";
    useStudioStore.setState({ view: "gallery", analysis: null, projectId: null });
  });

  it("chooses a subject area, switches starting-point tabs, and opens a template", () => {
    const openTemplate = vi.fn(async () => undefined);
    const openAgentTemplate = vi.fn(async () => undefined);
    useStudioStore.setState({ openTemplate, openAgentTemplate });
    render(<Welcome onBlank={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Workflow library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open MCP companion" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Subject area")).getAllByRole("option")).toHaveLength(
      new Set(WORKFLOW_TEMPLATES.map((template) => template.area)).size,
    );
    expect(screen.getByLabelText("Subject area")).toHaveValue("Core patterns");
    expect(screen.getAllByRole("tab")).toHaveLength(7);
    expect(screen.getByRole("tab", { name: "Starter workflows" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Recent projects" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Workflows" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Agents" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getAllByRole("button", { name: /open .* in studio/i })).toHaveLength(1);
    selectArea("Software engineering");
    expect(screen.getByLabelText("Subject area")).toHaveValue("Software engineering");
    const templateButtons = screen.getAllByRole("button", { name: /open .* in studio/i });
    expect(templateButtons).toHaveLength(WORKFLOW_TEMPLATES.filter((template) => template.area === "Software engineering").length);
    fireEvent.click(templateButtons[0]);
    expect(openTemplate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
    expect(screen.getByRole("tab", { name: "Agents" })).toHaveAttribute("aria-selected", "true");
    const agentButtons = screen.getAllByRole("button", { name: /start workflow with/i });
    expect(agentButtons).toHaveLength(roleTemplatesForSubject("Software engineering").length);
    fireEvent.click(agentButtons[0]);
    expect(openAgentTemplate).toHaveBeenCalledTimes(1);
  });

  it("searches the full catalog from a partial word and browses a subject result", () => {
    render(<Welcome onBlank={() => undefined} />);

    const search = screen.getByRole("combobox", { name: "Search the Ladder catalog" });
    fireEvent.change(search, { target: { value: "underw" } });

    expect(screen.getByRole("option", { name: /Insurance & underwriting, Subject areas, Browse subject/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Workflows/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Agents/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Forms/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Documents/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /Insurance & underwriting, Subject areas, Browse subject/i }));
    expect(search).toHaveValue("");
    expect(screen.getByLabelText("Subject area")).toHaveValue("Insurance & underwriting");
  });

  it("launches every curated bundle as a first-class starter", () => {
    const onBundle = vi.fn();
    render(<Welcome onBlank={() => undefined} onBundle={onBundle} />);

    expect(screen.getByRole("heading", { name: "Curated workflow bundles" })).toBeInTheDocument();
    expect(screen.getByText("7 bundles")).toBeInTheDocument();
    const manufacturing = screen.getByRole("button", { name: "Open Manufacturing line qualification bundle" });
    expect(screen.getByRole("button", { name: "Open Regulatory obligations and submission bundle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Commercial credit underwriting bundle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Energy field operations permit bundle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Healthcare clinical claim audit bundle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Real estate valuation and diligence bundle" })).toBeInTheDocument();
    fireEvent.click(manufacturing);

    expect(onBundle).toHaveBeenCalledWith(undefined, "manufacturing-line-qualification");
  });

  it("offers first-class creation entry points for bundles and ontologies", () => {
    const onBlank = vi.fn();
    const onBundle = vi.fn();
    const onOntology = vi.fn();
    render(<Welcome onBlank={onBlank} onBundle={onBundle} onOntology={onOntology} />);

    fireEvent.click(screen.getByRole("button", { name: "New workflow" }));
    fireEvent.click(screen.getByRole("button", { name: "New bundle" }));
    fireEvent.click(screen.getByRole("button", { name: "New ontology" }));

    expect(onBlank).toHaveBeenCalledOnce();
    expect(onBundle).toHaveBeenCalledWith(undefined, "__new__");
    expect(onOntology).toHaveBeenCalledWith(undefined, "__new__");
  });

  it("opens industry forms as standalone projects", () => {
    const onForm = vi.fn();
    render(<Welcome onBlank={() => undefined} onForm={onForm} />);
    selectArea("Manufacturing & industrial operations");
    fireEvent.click(screen.getByRole("tab", { name: "Forms" }));

    expect(screen.getAllByRole("button", { name: /open .* form/i })).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Open Quality Inspection Report form" }));
    expect(onForm).toHaveBeenCalledWith(undefined, "docubricks-manufacturing-quality-inspection-report");
  });

  it("does not leak forms from unrelated industries into unmapped subject areas", () => {
    render(<Welcome onBlank={() => undefined} />);
    fireEvent.click(screen.getByRole("tab", { name: "Forms" }));

    expect(screen.getByRole("tab", { name: "Forms" })).toHaveTextContent("Forms 0");
    expect(screen.getByText("No forms for this subject area.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open .* form/i })).not.toBeInTheDocument();

    selectArea("Manufacturing & industrial operations");
    expect(screen.getAllByRole("button", { name: /open .* form/i })).toHaveLength(5);

    selectArea("Software engineering");
    expect(screen.getByText("No forms for this subject area.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open .* form/i })).not.toBeInTheDocument();
  });

  it("opens industry documents and ontologies as standalone projects", () => {
    const onDocument = vi.fn();
    const onOntology = vi.fn();
    render(<Welcome onBlank={() => undefined} onDocument={onDocument} onOntology={onOntology} />);
    selectArea("Manufacturing & industrial operations");

    fireEvent.click(screen.getByRole("tab", { name: "Documents" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Certificate Of Analysis document" }));
    expect(onDocument).toHaveBeenCalledWith(undefined, "docubricks-manufacturing-certificate-of-analysis");

    fireEvent.click(screen.getByRole("tab", { name: "Ontologies" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Manufacturing ontology ontology" }));
    expect(onOntology).toHaveBeenCalledWith(undefined, "manufacturing");
  });

  it("states the no-account, no-runtime promise", () => {
    render(<Welcome onBlank={() => undefined} />);
    expect(screen.getByText(/no account/i)).toBeInTheDocument();
    expect(screen.getByText(/never runs agents/i)).toBeInTheDocument();
  });

  it("switches between starter workflows and recent projects", () => {
    render(<Welcome onBlank={() => undefined} />);

    fireEvent.click(screen.getByRole("tab", { name: "Recent projects" }));
    expect(screen.getByText("No saved projects yet")).toBeInTheDocument();
    expect(screen.queryByLabelText("Subject area")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Browse starter workflows" }));
    expect(screen.getByLabelText("Subject area")).toBeInTheDocument();
  });

  it("reopens saved workflow bundles in the bundle workspace", async () => {
    const onBundle = vi.fn();
    const openProject = vi.fn(async () => undefined);
    useStudioStore.setState({ openProject });
    vi.mocked(listProjects).mockResolvedValue([
      {
        id: "bundle-project",
        name: "Insurance claim review bundle",
        artifactKind: "workflow-bundle",
        yaml: "kind: WorkflowBundle",
        lastValidYaml: "kind: WorkflowBundle",
        target: "codex",
        createdAt: 1,
        updatedAt: 2,
      },
    ]);

    render(<Welcome onBlank={() => undefined} onBundle={onBundle} />);
    fireEvent.click(screen.getByRole("tab", { name: "Recent projects" }));
    const savedBundle = await screen.findByRole("button", { name: /Insurance claim review bundle/i });
    fireEvent.click(savedBundle);

    await waitFor(() => expect(onBundle).toHaveBeenCalledWith(expect.objectContaining({ id: "bundle-project" })));
    expect(openProject).not.toHaveBeenCalled();
  });

  it("opens the intro and help from the gallery", async () => {
    render(<Welcome onBlank={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Intro & help" }));
    expect(await screen.findByRole("dialog", { name: "Build your first workflow" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close help" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exposes the new multimodal and architecture workflow areas", () => {
    render(<Welcome onBlank={() => undefined} />);

    selectArea("Multimodal");
    expect(screen.getByRole("button", { name: /open multimodal asset production in studio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open image → structured text in studio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open reference image → new image in studio/i })).toBeInTheDocument();

    selectArea("Architecture & design");
    expect(screen.getByRole("button", { name: /open coordinated building design in studio/i })).toBeInTheDocument();
  });

  it("filters workflows and agents by input modality", () => {
    render(<Welcome onBlank={() => undefined} />);

    selectArea("Multimodal");
    fireEvent.change(screen.getByLabelText("Filter by modality"), { target: { value: "image" } });
    expect(screen.getAllByRole("button", { name: /open .* in studio/i })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /open multimodal asset production in studio/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
    expect(screen.getAllByRole("button", { name: /start workflow with/i }).length).toBeGreaterThan(0);
  });

  it("exposes humanities, writing, and personal-development workflows", () => {
    render(<Welcome onBlank={() => undefined} />);

    selectArea("Humanities");
    expect(screen.getByRole("button", { name: /open humanities inquiry \+ seminar in studio/i })).toBeInTheDocument();

    selectArea("Writing");
    expect(screen.getByRole("button", { name: /open manuscript development \+ editorial gate in studio/i })).toBeInTheDocument();

    selectArea("Personal development");
    expect(screen.getByRole("button", { name: /open values → sustainable action system in studio/i })).toBeInTheDocument();
  });

  it("exposes mathematics, music, and physics workflows", () => {
    render(<Welcome onBlank={() => undefined} />);

    selectArea("Mathematics");
    expect(screen.getByRole("button", { name: /open optimization problem solving pipeline in studio/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /open .* in studio/i })).toHaveLength(3);

    selectArea("Music");
    expect(screen.getByRole("button", { name: /open audio-to-analysis pipeline in studio/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /open .* in studio/i })).toHaveLength(3);

    selectArea("Physics");
    expect(screen.getByRole("button", { name: /open physics problem solving & verification pipeline in studio/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /open .* in studio/i })).toHaveLength(2);
  });

  it("exposes the added domain workflow areas", () => {
    render(<Welcome onBlank={() => undefined} />);

    selectArea("Supply chain & logistics");
    expect(screen.getByRole("button", { name: /open demand forecast \+ independent tie-out in studio/i })).toBeInTheDocument();

    selectArea("Robotics & embodied AI");
    expect(screen.getByRole("button", { name: /open manipulation plan \+ hardware tie-out in studio/i })).toBeInTheDocument();

    selectArea("Crisis & emergency management");
    expect(screen.getByRole("button", { name: /open incident intake → dispatch with coverage gate in studio/i })).toBeInTheDocument();

    selectArea("Airline flight operations");
    expect(screen.getByRole("button", { name: /open dispatch release \+ barrier verification in studio/i })).toBeInTheDocument();

    selectArea("Oil & gas drilling & well operations");
    expect(screen.getByRole("button", { name: /open well control barrier verification in studio/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
    expect(screen.getAllByRole("button", { name: /start workflow with/i })).toHaveLength(8);
  });

  it("switches themes and remembers the choice", () => {
    render(<Welcome onBlank={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("ladder-graph-theme")).toBe("dark");
  });
});
