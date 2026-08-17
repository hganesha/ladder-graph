import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "../src/components/Welcome";
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
    window.localStorage.clear();
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
    expect(screen.getAllByRole("tab")).toHaveLength(4);
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
