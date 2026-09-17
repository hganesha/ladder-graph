import { beforeEach, describe, expect, it } from "vitest";
import { toFlowEdges, toFlowNodes } from "../src/components/GraphCanvas";
import { groupDimensions } from "../src/lib/layout";
import {
  draggedPositions,
  flatGroupPosition,
  flatTaskPosition,
  getInitialProjection,
  isoEdgePath,
  isoGroupFrame,
  isoProject,
  isoTaskPosition,
  isoUnproject,
  saveProjection,
} from "../src/lib/projection";
import type { LgirEdge, LgirNode } from "../src/types";

const group: LgirNode = {
  id: "phase",
  kind: "group",
  name: "Phase",
  position: { x: 400, y: 100 },
  config: { execution: "sequential", members: ["draft", "review"] },
};
const nodes: LgirNode[] = [
  { id: "input", kind: "input", name: "Input", position: { x: 100, y: 150 } },
  group,
  { id: "draft", kind: "agent", name: "Draft", position: { x: 475, y: 200 } },
  { id: "review", kind: "agent", name: "Review", position: { x: 750, y: 200 } },
];
const edges: LgirEdge[] = [{ id: "e1", from: "input", to: "phase", kind: "dependency" }];

const close = (actual: { x: number; y: number }, expected: { x: number; y: number }, digits = 6) => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
};

describe("canvas projection", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to orthogonal and remembers the chosen projection", () => {
    expect(getInitialProjection()).toBe("orthogonal");
    saveProjection("isometric");
    expect(getInitialProjection()).toBe("isometric");
    window.localStorage.setItem("ladder-graph-canvas-projection", "perspective");
    expect(getInitialProjection()).toBe("orthogonal");
  });

  it("inverts the isometric projection for points, tiles, and group frames", () => {
    close(isoUnproject(isoProject({ x: 137, y: -42 })), { x: 137, y: -42 });
    close(flatTaskPosition(isoTaskPosition({ x: 820, y: 375 })), { x: 820, y: 375 });
    close(flatGroupPosition(group, isoGroupFrame(group).position), group.position ?? { x: 0, y: 0 });
  });

  it("sizes a group frame to the projected bounds of its flat rectangle", () => {
    const { width, height } = groupDimensions(group);
    const frame = isoGroupFrame(group);
    const corners = [
      { x: 400, y: 100 },
      { x: 400 + width, y: 100 },
      { x: 400 + width, y: 100 + height },
      { x: 400, y: 100 + height },
    ].map(isoProject);
    expect(Math.min(...corners.map((corner) => corner.x))).toBeCloseTo(frame.position.x, 6);
    expect(Math.min(...corners.map((corner) => corner.y))).toBeCloseTo(frame.position.y, 6);
    expect(Math.max(...corners.map((corner) => corner.x)) - frame.position.x).toBeCloseTo(frame.width, 6);
    expect(Math.max(...corners.map((corner) => corner.y)) - frame.position.y).toBeCloseTo(frame.height, 6);
  });

  it("routes isometric edges along the projected axes between both endpoints", () => {
    const source = isoProject({ x: 0, y: 0 });
    const target = isoProject({ x: 300, y: 200 });
    const { path, labelX, labelY } = isoEdgePath(source, target);
    const points = path
      .split(/[ML]/)
      .filter(Boolean)
      .map((pair) => pair.trim().split(" ").map(Number));
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual([0, 0]);
    // Path coordinates are rounded to hundredths of a pixel.
    close({ x: points[3][0], y: points[3][1] }, target, 1);
    close(isoUnproject({ x: points[1][0], y: points[1][1] }), { x: 150, y: 0 }, 1);
    close(isoUnproject({ x: points[2][0], y: points[2][1] }), { x: 150, y: 200 }, 1);
    expect(labelX).toBeCloseTo(target.x / 2, 6);
    expect(labelY).toBeCloseTo(target.y / 2, 6);
  });

  it("keeps orthogonal drags identical to the flat canvas", () => {
    expect(draggedPositions(nodes, "input", { x: 125, y: 175 }, "orthogonal")).toEqual({ input: { x: 125, y: 175 } });
    expect(draggedPositions(nodes, "draft", { x: 100, y: 125 }, "orthogonal")).toEqual({ draft: { x: 500, y: 225 } });
    expect(draggedPositions(nodes, "phase", { x: 450, y: 150 }, "orthogonal")).toEqual({
      phase: { x: 450, y: 150 },
      draft: { x: 525, y: 250 },
      review: { x: 800, y: 250 },
    });
  });

  it("stores isometric drags as flat YAML positions", () => {
    const dropped = isoTaskPosition({ x: 160, y: 90 });
    expect(draggedPositions(nodes, "input", dropped, "isometric")).toEqual({ input: { x: 160, y: 90 } });

    const frame = isoGroupFrame({ ...group, position: { x: 450, y: 125 } });
    expect(draggedPositions(nodes, "phase", frame.position, "isometric")).toEqual({
      phase: { x: 450, y: 125 },
      draft: { x: 525, y: 225 },
      review: { x: 800, y: 225 },
    });
  });

  it("resolves isometric member drags relative to their group and keeps them inside it", () => {
    const origin = isoGroupFrame(group).position;
    const inside = isoTaskPosition({ x: 500, y: 180 });
    expect(draggedPositions(nodes, "draft", { x: inside.x - origin.x, y: inside.y - origin.y }, "isometric", origin)).toEqual({
      draft: { x: 500, y: 180 },
    });

    const outside = isoTaskPosition({ x: 2000, y: -500 });
    const { width } = groupDimensions(group);
    expect(draggedPositions(nodes, "draft", { x: outside.x - origin.x, y: outside.y - origin.y }, "isometric", origin)).toEqual({
      draft: { x: 400 + width - 246, y: 100 },
    });
  });

  it("builds isometric flow nodes and edges without changing the orthogonal defaults", () => {
    expect(toFlowNodes(nodes).map((node) => node.type)).toEqual(["group", "task", "task", "task"]);
    expect(toFlowEdges(edges, nodes).every((edge) => edge.type === "smoothstep")).toBe(true);

    const flow = toFlowNodes(nodes, undefined, "isometric");
    const byId = new Map(flow.map((node) => [node.id, node]));
    expect(byId.get("phase")?.type).toBe("isoGroup");
    expect(byId.get("input")?.type).toBe("isoTask");
    expect(byId.get("draft")?.parentId).toBe("phase");
    expect(byId.get("input")?.parentId).toBeUndefined();

    const origin = byId.get("phase")?.position ?? { x: 0, y: 0 };
    const member = byId.get("draft")?.position ?? { x: 0, y: 0 };
    close({ x: origin.x + member.x, y: origin.y + member.y }, isoTaskPosition({ x: 475, y: 200 }));

    const flowEdges = toFlowEdges(edges, nodes, "isometric");
    expect(flowEdges.length).toBeGreaterThan(1);
    expect(flowEdges.every((edge) => edge.type === "iso")).toBe(true);
  });
});
