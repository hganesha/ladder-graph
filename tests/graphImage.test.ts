import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportGraphImage } from "../src/lib/graphImage";

const { toBlob, toSvg } = vi.hoisted(() => ({ toBlob: vi.fn(), toSvg: vi.fn() }));
let clickedLink: HTMLAnchorElement | null = null;

vi.mock("html-to-image", () => ({ toBlob, toSvg }));

describe("graph image export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clickedLink = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedLink = this;
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  it("fits the full graph into a downloadable SVG and omits connection handles", async () => {
    const root = document.createElement("section");
    const viewport = document.createElement("div");
    const handle = document.createElement("div");
    viewport.className = "react-flow__viewport";
    handle.className = "react-flow__handle";
    viewport.append(handle);
    root.append(viewport);
    document.body.append(root);
    toSvg.mockResolvedValue("data:image/svg+xml;charset=utf-8,graph");
    const instance = {
      getNodes: () => [{ id: "input", hidden: false }],
      getNodesBounds: () => ({ x: 100, y: 50, width: 600, height: 300 }),
    };

    await exportGraphImage({ format: "svg", instance: instance as never, name: "release-flow", root });

    expect(toSvg).toHaveBeenCalledWith(
      viewport,
      expect.objectContaining({
        height: 428,
        style: expect.objectContaining({ transform: "translate(-36px, 14px) scale(1)" }),
        width: 728,
      }),
    );
    const options = toSvg.mock.calls[0][1];
    expect(options.filter(handle)).toBe(false);
    expect(clickedLink?.download).toBe("release-flow.svg");
    expect(clickedLink?.href).toContain("data:image/svg+xml");
    expect(root).not.toHaveClass("graph-exporting");
  });
});
