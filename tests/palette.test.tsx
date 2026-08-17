import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Palette } from "../src/components/Palette";
import { groupRoleTemplates } from "../src/lib/roleCategories";
import { ROLE_TEMPLATES } from "../src/lib/roleTemplates";
import { useStudioStore } from "../src/store/useStudioStore";

describe("agent template palette", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useStudioStore.setState({ analysis: null, selectedNodeId: null });
  });

  it("surfaces the expanded role count and researched specialists", () => {
    render(<Palette />);

    expect(ROLE_TEMPLATES).toHaveLength(307);
    expect(screen.getByText("307 agents")).toBeInTheDocument();
    const macros = screen.getByLabelText("Visual macros");
    const primitives = screen.getByLabelText("Primitives");
    const agents = screen.getByLabelText("Agent templates");
    expect(macros).toHaveAttribute("open");
    expect(primitives).not.toHaveAttribute("open");
    expect(agents).not.toHaveAttribute("open");
    expect(primitives.compareDocumentPosition(agents) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText("Core agent templates (8)")).toBeInTheDocument();
    expect(screen.getByLabelText("Core agent templates (8)")).not.toHaveAttribute("open");
    expect(screen.getByLabelText("SWE agent templates (26)")).toBeInTheDocument();
    expect(screen.getByLabelText("Security agent templates (20)")).toBeInTheDocument();
    expect(screen.getByLabelText("Multimodal agent templates (4)")).toBeInTheDocument();
    expect(screen.getByLabelText("Architecture & design agent templates (20)")).toBeInTheDocument();
    expect(screen.getByLabelText("Humanities agent templates (15)")).toBeInTheDocument();
    expect(screen.getByLabelText("Writing agent templates (5)")).toBeInTheDocument();
    expect(screen.getByLabelText("Personal development agent templates (5)")).toBeInTheDocument();
    expect(screen.getByLabelText("Mathematics agent templates (8)")).toBeInTheDocument();
    expect(screen.getByLabelText("Music agent templates (10)")).toBeInTheDocument();
    expect(screen.getByLabelText("Physics agent templates (8)")).toBeInTheDocument();
    expect(screen.getByLabelText("Business operations agent templates (36)")).toBeInTheDocument();
    expect(screen.getByLabelText("Industry & infrastructure agent templates (30)")).toBeInTheDocument();
    expect(screen.getByLabelText("Aviation agent templates (8)")).toBeInTheDocument();
    expect(screen.getByLabelText("Drilling & wells agent templates (8)")).toBeInTheDocument();
    expect(screen.getByLabelText("Applied science agent templates (30)")).toBeInTheDocument();
    expect(screen.getByLabelText("Creative & social agent templates (30)")).toBeInTheDocument();
    expect(screen.getByLabelText("Professional services agent templates (18)")).toBeInTheDocument();
    expect(screen.getByLabelText("Emerging agent templates (18)")).toBeInTheDocument();
    expect(screen.getByText("Requirements Analyst")).toBeInTheDocument();
    expect(screen.getByText("Penetration Tester / Red Team Operator")).toBeInTheDocument();
    expect(screen.getByText("Building Architect / Design Architect")).toBeInTheDocument();
    expect(screen.getByText("Socratic Dialogue Partner")).toBeInTheDocument();
    expect(screen.getByText("Developmental Editor")).toBeInTheDocument();
    expect(screen.getByText("Life Coach / Values-Based Goal Strategist")).toBeInTheDocument();
    expect(screen.getByText("Trigonometry Problem Solver & Tutor")).toBeInTheDocument();
    expect(screen.getByText("Melody & Harmonic Co-Composer")).toBeInTheDocument();
    expect(screen.getByText("Quantum Mechanics Tutor")).toBeInTheDocument();
  });

  it("finds a researched role through the visible library search", () => {
    render(<Palette />);

    fireEvent.change(screen.getByPlaceholderText("Search library"), { target: { value: "DFIR" } });

    expect(screen.getByText("DFIR Specialist")).toBeInTheDocument();
    expect(screen.queryByText("Requirements Analyst")).not.toBeInTheDocument();
    expect(screen.getByText("Agent templates · 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent templates")).toHaveAttribute("open");
    expect(screen.getByLabelText("Security agent templates (1)")).toBeInTheDocument();
    expect(screen.getByLabelText("Security agent templates (1)")).toHaveAttribute("open");
  });

  it("groups every role once and supports category-level search", () => {
    const groups = groupRoleTemplates(ROLE_TEMPLATES);

    expect(groups.map(({ label, roles }) => [label, roles.length])).toEqual([
      ["Core", 8],
      ["SWE", 26],
      ["Security", 20],
      ["Multimodal", 4],
      ["Architecture & design", 20],
      ["Humanities", 15],
      ["Writing", 5],
      ["Personal development", 5],
      ["Mathematics", 8],
      ["Music", 10],
      ["Physics", 8],
      ["Business operations", 36],
      ["Industry & infrastructure", 30],
      ["Aviation", 8],
      ["Drilling & wells", 8],
      ["Applied science", 30],
      ["Creative & social", 30],
      ["Professional services", 18],
      ["Emerging", 18],
    ]);
    expect(groups.flatMap((group) => group.roles)).toHaveLength(ROLE_TEMPLATES.length);
    expect(groupRoleTemplates(ROLE_TEMPLATES, "SWE").map(({ label, roles }) => [label, roles.length])).toEqual([["SWE", 26]]);
  });

  it("surfaces aggregator and teacher-model primitives", () => {
    render(<Palette />);

    expect(screen.getByText("Aggregator")).toBeInTheDocument();
    expect(screen.getByText("Teacher model")).toBeInTheDocument();
    expect(screen.getByText("Combine outputs from multiple nodes")).toBeInTheDocument();
    expect(screen.getByText("Get feedback from a teacher model")).toBeInTheDocument();
  });

  it("offers debate and brainstorm as visual macros rather than primitives", () => {
    render(<Palette />);

    expect(screen.getByRole("button", { name: "Debate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Brainstorm" })).toBeInTheDocument();
    expect(screen.getByLabelText("Visual macros")).toHaveTextContent("Debate");
    expect(screen.getByLabelText("Primitives")).not.toHaveTextContent("Debate");
  });
});
