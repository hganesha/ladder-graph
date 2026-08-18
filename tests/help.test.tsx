import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpDialog } from "../src/components/HelpDialog";

describe("intro and help dialog", () => {
  afterEach(cleanup);

  it("presents eight task-oriented help topics and supports sequential navigation", () => {
    render(<HelpDialog onClose={() => undefined} />);

    expect(screen.getByRole("dialog", { name: "What Ladder Graph makes" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Help topics" }).querySelectorAll("button")).toHaveLength(8);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("heading", { name: "Choose a starting point" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "Design a workflow" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save, export and connect/i }));
    expect(screen.getByRole("heading", { name: "Save, export and connect" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on github/i })).toHaveAttribute("href", "https://github.com/hganesha/ladder-graph");
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
  });

  it("opens directly to the requested workspace topic", () => {
    render(<HelpDialog initialTopic="forms" onClose={() => undefined} />);

    expect(screen.getByRole("dialog", { name: "Forms and documents" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /forms and documents/i })).toHaveAttribute("aria-current", "page");
  });

  it("closes with Escape", () => {
    const onClose = vi.fn();
    render(<HelpDialog onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
