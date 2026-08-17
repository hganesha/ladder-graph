import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpDialog } from "../src/components/HelpDialog";

describe("intro and help dialog", () => {
  afterEach(cleanup);

  it("presents six help pages and supports sequential navigation", () => {
    render(<HelpDialog onClose={() => undefined} />);

    expect(screen.getByRole("dialog", { name: "Build your first workflow" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /workflow|canvas|issues|target|copy|about/i })).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("heading", { name: "Build on the canvas" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "Fix issues before compiling" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /keep a durable copy/i }));
    expect(screen.getByRole("heading", { name: "Keep a durable copy" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("heading", { name: "About Ladder Graph" })).toBeInTheDocument();
    expect(screen.getByText("Hari Venkataraman with Codex")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on github/i })).toHaveAttribute("href", "https://github.com/hganesha/ladder-graph");
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
  });

  it("closes with Escape", () => {
    const onClose = vi.fn();
    render(<HelpDialog onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
