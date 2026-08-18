import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Code2, Sparkles, Workflow } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Welcome, WORKFLOW_AREAS } from "../src/components/Welcome";
import { ARTIFACT_INDEX } from "../src/generated/catalog";
import { deleteProject, listProjects, listUserTemplates } from "../src/lib/persistence";
import { ROLE_TEMPLATES, roleTemplatesForSubject } from "../src/lib/roleTemplates";
import { WORKFLOW_TEMPLATES } from "../src/lib/templates";
import { useStudioStore } from "../src/store/useStudioStore";

vi.mock("../src/lib/persistence", () => ({
  deleteProject: vi.fn(async () => undefined),
  listProjects: vi.fn(async () => []),
  listUserTemplates: vi.fn(async () => []),
  saveProject: vi.fn(async () => ({ id: "test-project", updatedAt: Date.now() })),
  requestPersistentStorage: vi.fn(async () => false),
}));

const selectArea = (area: string) => {
  fireEvent.change(screen.getByLabelText("Subject area"), { target: { value: area } });
};

const alphabetically = (values: string[]) => [...values].sort(new Intl.Collator("en", { numeric: true, sensitivity: "base" }).compare);

describe("welcome gallery", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(deleteProject).mockResolvedValue(undefined);
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(listUserTemplates).mockResolvedValue([]);
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    document.documentElement.dataset.theme = "light";
    useStudioStore.setState({ view: "gallery", analysis: null, projectId: null });
  });

  it("keeps the subject-specific icons in the generated catalog", () => {
    expect(WORKFLOW_AREAS.find((area) => area.name === "Core patterns")?.icon).toBe(Sparkles);
    expect(WORKFLOW_AREAS.find((area) => area.name === "Software engineering")?.icon).toBe(Code2);
    expect(WORKFLOW_AREAS.every((area) => area.icon !== Workflow)).toBe(true);
    expect(new Set(WORKFLOW_AREAS.map((area) => area.icon)).size).toBe(WORKFLOW_AREAS.length);
  });

  it("chooses a subject area, switches starting-point tabs, and opens a template", () => {
    const openTemplate = vi.fn(async () => undefined);
    const openAgentTemplate = vi.fn(async () => undefined);
    useStudioStore.setState({ openTemplate, openAgentTemplate });
    render(<Welcome onBlank={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Workflow library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open MCP companion" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Subject area")).getAllByRole("option")).toHaveLength(
      new Set(WORKFLOW_TEMPLATES.map((template) => template.area)).size + 1,
    );
    expect(screen.getByRole("option", { name: /All subject areas/ })).toHaveValue(":all");
    expect(screen.getByLabelText("Subject area")).toHaveValue("Core patterns");
    expect(screen.getAllByRole("tab")).toHaveLength(8);
    expect(screen.getByRole("tab", { name: "Starter workflows" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Recent projects" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Workflows" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Agents" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getAllByRole("button", { name: /open .* in studio/i })).toHaveLength(
      WORKFLOW_TEMPLATES.filter((template) => template.area === "Core patterns").length,
    );
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

  it("groups all catalog items by alphabetized subject areas and sorts each group", () => {
    render(<Welcome onBlank={() => undefined} />);

    const subjectValues = within(screen.getByLabelText("Subject area"))
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);
    expect(subjectValues).toEqual([":all", ...alphabetically(subjectValues.slice(1))]);

    selectArea(":all");
    const categories = [
      {
        tab: "Workflows",
        plural: "workflows",
        buttonName: /^Open .* in studio$/,
        itemName: (label: string) => label.replace(/^Open /, "").replace(/ in studio$/, ""),
      },
      { tab: "Bundles", plural: "bundles", buttonName: /^Open /, itemName: (label: string) => label.replace(/^Open /, "") },
      {
        tab: "Agents",
        plural: "agents",
        buttonName: /^Start workflow with /,
        itemName: (label: string) => label.replace(/^Start workflow with /, ""),
      },
      {
        tab: "Forms",
        plural: "forms",
        buttonName: /^Open .* form$/,
        itemName: (label: string) => label.replace(/^Open /, "").replace(/ form$/, ""),
      },
      {
        tab: "Documents",
        plural: "documents",
        buttonName: /^Open .* document$/,
        itemName: (label: string) => label.replace(/^Open /, "").replace(/ document$/, ""),
      },
      {
        tab: "Ontologies",
        plural: "ontologies",
        buttonName: /^Open .* ontology$/,
        itemName: (label: string) => label.replace(/^Open /, "").replace(/ ontology$/, ""),
      },
    ];

    for (const category of categories) {
      if (category.tab !== "Workflows") fireEvent.click(screen.getByRole("tab", { name: category.tab }));
      const panel = screen.getByRole("tabpanel", { name: category.tab });
      const groups = within(panel)
        .getAllByRole("region", { name: new RegExp(` ${category.plural}$`) })
        .filter((group) => group.classList.contains("catalog-subject-group"));
      const groupSubjects = groups.map((group) => group.getAttribute("aria-label")!.replace(new RegExp(` ${category.plural}$`), ""));
      expect(groupSubjects).toEqual(alphabetically(groupSubjects));

      for (const group of groups) {
        expect(group.querySelector("header svg")).toBeInTheDocument();
        const itemNames = within(group)
          .getAllByRole("button", { name: category.buttonName })
          .map((button) => category.itemName(button.getAttribute("aria-label")!));
        expect(itemNames).toEqual(alphabetically(itemNames));
      }
    }

    selectArea("Software engineering");
    expect(
      within(screen.getByRole("tabpanel", { name: "Ontologies" })).queryByRole("region", { name: / ontologies$/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps each card's subject icon when all subjects are selected", () => {
    render(<Welcome onBlank={() => undefined} />);
    selectArea(":all");

    const workflowGroup = screen.getByRole("region", { name: "Software engineering workflows" });
    expect(workflowGroup.querySelector(".topology-art svg")).toHaveClass("lucide-code-xml");

    fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
    const agentGroup = screen.getByRole("region", { name: "Software engineering agents" });
    expect(agentGroup.querySelector(".agent-card-icon svg")).toHaveClass("lucide-code-xml");
  });

  it("optionally includes reusable user workflows and agents", async () => {
    const openUserTemplate = vi.fn(async () => undefined);
    const openProject = vi.fn(async () => undefined);
    useStudioStore.setState({ openProject, openUserTemplate });
    vi.mocked(listProjects).mockResolvedValue([
      {
        id: "saved-workflow",
        name: "My saved workflow",
        artifactKind: "workflow",
        yaml: "kind: Workflow",
        lastValidYaml: `apiVersion: ladder.dev/v1alpha1
kind: Workflow
metadata:
  name: my-saved-workflow
  title: My saved workflow
spec:
  nodes: []
  edges: []`,
        target: "codex",
        createdAt: 1,
        updatedAt: 2,
      },
    ]);
    vi.mocked(listUserTemplates).mockResolvedValue([
      {
        id: "user-workflow",
        kind: "workflow",
        path: "research/software/custom",
        title: "My delivery workflow",
        yaml: `apiVersion: ladder.dev/v1alpha1
kind: Workflow
metadata:
  name: my-delivery-workflow
  title: My delivery workflow
  description: A personal delivery sequence.
spec:
  nodes:
    - id: request
      kind: input
      inputSchema:
        x-ladder-input-mode: text
  edges: []`,
        createdAt: 1,
        updatedAt: 2,
      },
      {
        id: "user-agent",
        kind: "agent-template",
        path: "research/legal/custom",
        title: "My contract reviewer",
        yaml: `apiVersion: ladder.dev/v1alpha1
kind: AgentTemplate
metadata:
  name: my-contract-reviewer
  title: My contract reviewer
spec:
  path: research/legal/custom
  areas: [Legal & contracts]
  modalities: [document]
  role: Reviews contracts against my checklist.
  prompt: Review the contract and return evidenced findings.
  capabilities:
    skills: [contract-review]
    tools: [read]`,
        createdAt: 1,
        updatedAt: 2,
      },
    ]);

    render(<Welcome onBlank={() => undefined} />);
    const includeUserAssets = screen.getByRole("checkbox", { name: "Include your assets" });
    await waitFor(() => expect(includeUserAssets).toBeEnabled());
    selectArea(":all");
    expect(screen.queryByRole("button", { name: "Open My delivery workflow in studio" })).not.toBeInTheDocument();

    fireEvent.click(includeUserAssets);
    const userWorkflow = screen.getByRole("button", { name: "Open My delivery workflow in studio" });
    expect(userWorkflow).toHaveAttribute("data-asset-origin", "user");
    expect(userWorkflow.querySelector(".topology-art svg")).toHaveClass("lucide-code-xml");
    fireEvent.click(userWorkflow);
    const savedWorkflow = screen.getByRole("button", { name: "Open My saved workflow in studio" });
    expect(savedWorkflow).toHaveAttribute("data-asset-origin", "user");
    fireEvent.click(savedWorkflow);

    fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
    const userAgent = screen.getByRole("button", { name: "Start workflow with My contract reviewer" });
    expect(userAgent).toHaveAttribute("data-asset-origin", "user");
    expect(userAgent.querySelector(".agent-card-icon svg")).toHaveClass("lucide-scale");
    fireEvent.click(userAgent);

    expect(openUserTemplate).toHaveBeenCalledTimes(2);
    expect(openProject).toHaveBeenCalledWith(expect.objectContaining({ id: "saved-workflow" }));
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

  it("groups curated bundles in a dedicated subject-filtered tab", () => {
    const onBundle = vi.fn();
    render(<Welcome onBlank={() => undefined} onBundle={onBundle} />);
    selectArea(":all");

    expect(screen.queryByRole("heading", { name: "Curated workflow bundles" })).not.toBeInTheDocument();
    selectArea("Manufacturing & industrial operations");
    fireEvent.click(screen.getByRole("tab", { name: "Bundles" }));

    expect(screen.getByRole("tab", { name: "Bundles" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Curated workflow bundles" })).toBeInTheDocument();
    const manufacturingBundleCount = ARTIFACT_INDEX.filter(
      (artifact) => artifact.kind === "workflow-bundle" && artifact.path.startsWith("manufacturing/"),
    ).length;
    expect(screen.getByText(`${manufacturingBundleCount} bundles`)).toBeInTheDocument();
    const manufacturing = screen.getByRole("button", { name: "Open Manufacturing line qualification bundle" });
    expect(screen.queryByRole("button", { name: "Open Regulatory obligations and submission bundle" })).not.toBeInTheDocument();
    fireEvent.click(manufacturing);

    expect(onBundle).toHaveBeenCalledWith(undefined, "manufacturing-line-qualification");

    selectArea("Legal & contracts");
    expect(screen.getByRole("button", { name: "Open Regulatory obligations and submission bundle" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Manufacturing line qualification bundle" })).not.toBeInTheDocument();
  });

  it("shows every related catalog category for the :all subject", () => {
    render(<Welcome onBlank={() => undefined} />);
    selectArea(":all");

    expect(screen.getByLabelText("Subject area")).toHaveValue(":all");
    expect(screen.getByRole("heading", { name: "All subject areas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Workflows" })).toHaveTextContent(`Workflows ${WORKFLOW_TEMPLATES.length}`);

    fireEvent.click(screen.getByRole("tab", { name: "Agents" }));
    expect(screen.getByRole("tab", { name: "Agents" })).toHaveTextContent(`Agents ${ROLE_TEMPLATES.length}`);

    for (const [tab, kind] of [
      ["Forms", "form"],
      ["Documents", "document"],
      ["Ontologies", "ontology"],
    ] as const) {
      fireEvent.click(screen.getByRole("tab", { name: tab }));
      expect(screen.getByRole("tab", { name: tab })).toHaveTextContent(
        `${tab} ${ARTIFACT_INDEX.filter((artifact) => artifact.kind === kind).length}`,
      );
    }
  });

  it("classifies every industry ontology under an existing subject area", () => {
    render(<Welcome onBlank={() => undefined} />);
    fireEvent.click(screen.getByRole("tab", { name: "Ontologies" }));

    for (const [ontologyId, area] of [
      ["airline", "Airline flight operations"],
      ["telco", "Transportation & mobility"],
      ["semiconductor-manufacturing", "Manufacturing & industrial operations"],
      ["consumer-goods", "Supply chain & logistics"],
      ["life-sciences", "Life sciences & GxP operations"],
    ] as const) {
      const ontology = ARTIFACT_INDEX.find((artifact) => artifact.id === ontologyId);
      expect(ontology).toBeDefined();
      selectArea(area);
      expect(screen.getByRole("button", { name: `Open ${ontology!.title} ontology` })).toBeInTheDocument();
    }

    selectArea(":all");
    expect(screen.queryByRole("region", { name: "Uncategorized ontologies" })).not.toBeInTheDocument();
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
    const savedBundle = await screen.findByRole("button", { name: "Open Insurance claim review bundle" });
    fireEvent.click(savedBundle);

    await waitFor(() => expect(onBundle).toHaveBeenCalledWith(expect.objectContaining({ id: "bundle-project" })));
    expect(openProject).not.toHaveBeenCalled();
  });

  it("deletes a recent project after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(listProjects).mockResolvedValue([
      {
        id: "saved-project",
        name: "Saved workflow",
        artifactKind: "workflow",
        yaml: "kind: Workflow",
        lastValidYaml: "kind: Workflow",
        target: "codex",
        createdAt: 1,
        updatedAt: 2,
      },
    ]);

    render(<Welcome onBlank={() => undefined} />);
    fireEvent.click(screen.getByRole("tab", { name: "Recent projects" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete Saved workflow" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("permanently removes"));
    await waitFor(() => expect(deleteProject).toHaveBeenCalledWith("saved-project"));
    expect(screen.queryByRole("button", { name: "Open Saved workflow" })).not.toBeInTheDocument();
    expect(screen.getByText("No saved projects yet")).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("opens the intro and help from the gallery", async () => {
    render(<Welcome onBlank={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Intro & help" }));
    expect(await screen.findByRole("dialog", { name: "What Ladder Graph makes" })).toBeInTheDocument();
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
