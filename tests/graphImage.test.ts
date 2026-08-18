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

  it("inlines sprite symbols during export and restores the live graph afterward", async () => {
    const root = document.createElement("section");
    const viewport = document.createElement("div");
    viewport.className = "react-flow__viewport";
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.dataset.nodeIcon = "search";
    icon.innerHTML = '<use href="/icons/lucide-nodes.svg#lucide-search"></use>';
    viewport.append(icon);
    root.append(viewport);
    document.body.append(root);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            '<svg xmlns="http://www.w3.org/2000/svg"><defs><symbol id="lucide-search"><circle cx="11" cy="11" r="8"/></symbol></defs></svg>',
            { status: 200 },
          ),
      ),
    );
    toSvg.mockImplementation(async () => {
      expect(icon.querySelector("circle")).not.toBeNull();
      expect(icon.querySelector("use")).toBeNull();
      return "data:image/svg+xml;charset=utf-8,graph";
    });
    const instance = {
      getNodes: () => [{ id: "agent", hidden: false }],
      getNodesBounds: () => ({ x: 0, y: 0, width: 200, height: 100 }),
    };

    await exportGraphImage({ format: "svg", instance: instance as never, name: "icon-flow", root });

    expect(icon.querySelector("use")).not.toBeNull();
    expect(icon.querySelector("circle")).toBeNull();
  });
});
