import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { downloadText } from "../src/lib/download";
import { useStudioStore } from "../src/store/useStudioStore";

vi.mock("../src/lib/download", () => ({ downloadText: vi.fn() }));

function Crasher(): never {
  throw new Error("broken inspector value");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("error recovery boundary", () => {
  it("keeps the current YAML exportable after a render crash", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    useStudioStore.setState({ source: "kind: Workflow\n" });

    render(
      <ErrorBoundary scope="inspector">
        <Crasher />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("The inspector stopped unexpectedly");
    expect(screen.getByText("broken inspector value")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export current YAML" }));
    expect(downloadText).toHaveBeenCalledWith("ladder-graph-recovery.yaml", "kind: Workflow\n", "application/yaml;charset=utf-8");
  });
});
