import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IconControl } from "../src/components/IconControl";
import { resolveAgentIcon, resolveOntologyIcon } from "../src/lib/nodeIcons";

describe("node icon resolution", () => {
  it("prefers explicit icons and resolves aliases without persisting derived values", () => {
    expect(resolveOntologyIcon({ id: "person", label: "Person", icon: { set: "lucide", name: "building-2" } })).toMatchObject({
      name: "building",
      source: "explicit",
    });
    expect(resolveOntologyIcon({ id: "person", label: "Person" })).toMatchObject({ name: "user", source: "semantic" });
    expect(resolveOntologyIcon({ id: "unclassified", label: "Unclassified" })).toMatchObject({ name: "boxes", source: "fallback" });
  });

  it("derives agent icons from stable role semantics and safely falls back for unknown overrides", () => {
    expect(resolveAgentIcon({ name: "Research analyst", role: "Investigate source material" })).toMatchObject({
      name: "search",
      source: "semantic",
    });
    expect(
      resolveAgentIcon({ name: "Specialist", role: "Focused operator", icon: { set: "lucide", name: "not-in-the-catalog" } }),
    ).toMatchObject({ name: "bot", source: "fallback", invalidOverride: "not-in-the-catalog" });
  });
});

describe("icon control", () => {
  it("lazy-loads the searchable picker and commits a custom icon", async () => {
    const onChange = vi.fn();
    render(<IconControl automaticName="bot" label="Agent icon" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /automatic: bot/i }));
    expect(await screen.findByRole("dialog", { name: "Choose node icon" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search icons" }), { target: { value: "database" } });
    fireEvent.click(await screen.findByRole("button", { name: "Use Database icon" }));

    expect(onChange).toHaveBeenCalledWith({ set: "lucide", name: "database" });
  });

  it("returns to automatic by removing the explicit reference", async () => {
    const onChange = vi.fn();
    render(<IconControl automaticName="user" label="Entity icon" onChange={onChange} value={{ set: "lucide", name: "building" }} />);

    fireEvent.click(screen.getByRole("button", { name: /building/i }));
    const dialog = await screen.findByRole("dialog", { name: "Choose node icon" });
    fireEvent.click(within(dialog).getByRole("button", { name: /automatic/i }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
