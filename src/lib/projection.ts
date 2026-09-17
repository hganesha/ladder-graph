import type { LgirNode, Position } from "../types";
import { GRID_LAYOUT, groupDimensions } from "./layout";

/**
 * Canvas projections are a view preference only. YAML positions always stay in the
 * orthogonal (flat) coordinate space; the isometric view projects them on render and
 * inverts the projection when a drag is committed.
 */
export type Projection = "orthogonal" | "isometric";

const PROJECTION_KEY = "ladder-graph-canvas-projection";
const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);

/** Size of the DOM box that holds an isometric task tile, and where the tile's floor center sits in it. */
export const ISO_TILE = { width: 184, height: 168, anchorX: 92, anchorY: 84 } as const;

export function getInitialProjection(): Projection {
  try {
    return window.localStorage.getItem(PROJECTION_KEY) === "isometric" ? "isometric" : "orthogonal";
  } catch {
    return "orthogonal";
  }
}

export function saveProjection(projection: Projection) {
  try {
    window.localStorage.setItem(PROJECTION_KEY, projection);
  } catch {
    // The canvas still switches when storage is unavailable.
  }
}

export function isoProject({ x, y }: Position): Position {
  return { x: (x - y) * COS, y: (x + y) * SIN };
}

export function isoUnproject({ x, y }: Position): Position {
  const difference = x / COS;
  const sum = y / SIN;
  return { x: (sum + difference) / 2, y: (sum - difference) / 2 };
}

/** Flow position for a task whose flat top-left corner is `position`. */
export function isoTaskPosition(position: Position): Position {
  const center = isoProject({ x: position.x + GRID_LAYOUT.nodeWidth / 2, y: position.y + GRID_LAYOUT.nodeHeight / 2 });
  return { x: center.x - ISO_TILE.anchorX, y: center.y - ISO_TILE.anchorY };
}

/** Flat top-left corner for a task tile rendered at the absolute flow position `position`. */
export function flatTaskPosition(position: Position): Position {
  const center = isoUnproject({ x: position.x + ISO_TILE.anchorX, y: position.y + ISO_TILE.anchorY });
  return { x: center.x - GRID_LAYOUT.nodeWidth / 2, y: center.y - GRID_LAYOUT.nodeHeight / 2 };
}

/**
 * The projected bounding box of a group's flat rectangle. `transform` maps the flat
 * group card (width × height) onto the isometric floor plane inside that box.
 */
export function isoGroupFrame(group: LgirNode) {
  const { width, height } = groupDimensions(group);
  const position = group.position ?? { x: 0, y: 0 };
  return {
    position: { x: (position.x - position.y - height) * COS, y: (position.x + position.y) * SIN },
    width: (width + height) * COS,
    height: (width + height) * SIN,
    flat: { width, height },
    transform: `matrix(${COS}, ${SIN}, ${-COS}, ${SIN}, ${height * COS}, 0)`,
  };
}

/** Flat top-left corner for a group whose projected bounding box starts at `position`. */
export function flatGroupPosition(group: LgirNode, position: Position): Position {
  const { height } = groupDimensions(group);
  const difference = position.x / COS + height;
  const sum = position.y / SIN;
  return { x: (sum + difference) / 2, y: (sum - difference) / 2 };
}

/** Keeps a member inside its group, matching the orthogonal canvas's parent extent. */
export function clampToGroup(position: Position, group: LgirNode): Position {
  const origin = group.position ?? { x: 0, y: 0 };
  const { width, height } = groupDimensions(group);
  return {
    x: Math.min(Math.max(position.x, origin.x), origin.x + Math.max(0, width - GRID_LAYOUT.nodeWidth)),
    y: Math.min(Math.max(position.y, origin.y), origin.y + Math.max(0, height - GRID_LAYOUT.nodeHeight)),
  };
}

/** A step route that follows the two isometric axes instead of the screen axes. */
export function isoEdgePath(source: Position, target: Position) {
  const delta = isoUnproject({ x: target.x - source.x, y: target.y - source.y });
  const first = isoProject({ x: delta.x / 2, y: 0 });
  const second = isoProject({ x: delta.x / 2, y: delta.y });
  const points = [source, { x: source.x + first.x, y: source.y + first.y }, { x: source.x + second.x, y: source.y + second.y }, target];
  return {
    path: points.map((point, index) => `${index ? "L" : "M"}${round(point.x)} ${round(point.y)}`).join(" "),
    labelX: (source.x + target.x) / 2,
    labelY: (source.y + target.y) / 2,
  };
}

const round = (value: number) => Math.round(value * 100) / 100;
const roundPosition = ({ x, y }: Position): Position => ({ x: Math.round(x), y: Math.round(y) });

/**
 * Converts a finished drag into flat YAML positions. `flowPosition` is the dragged
 * node's position as reported by React Flow (relative to its parent when it has one).
 */
export function draggedPositions(
  nodes: LgirNode[],
  draggedId: string,
  flowPosition: Position,
  projection: Projection,
  parentFlowPosition?: Position,
): Record<string, Position> {
  const source = nodes.find((node) => node.id === draggedId);
  if (!source) return {};
  const isometric = projection === "isometric";
  if (source.kind === "group") {
    const next = isometric ? roundPosition(flatGroupPosition(source, flowPosition)) : flowPosition;
    const previous = source.position ?? { x: 0, y: 0 };
    const delta = { x: next.x - previous.x, y: next.y - previous.y };
    return Object.fromEntries(
      [source.id, ...(source.config?.members ?? [])].map((id) => {
        const member = nodes.find((candidate) => candidate.id === id);
        const position = member?.position ?? previous;
        return [id, id === source.id ? next : { x: position.x + delta.x, y: position.y + delta.y }];
      }),
    );
  }
  const parent = nodes.find((candidate) => candidate.kind === "group" && candidate.config?.members?.includes(draggedId));
  if (!isometric) {
    const parentPosition = parent?.position ?? { x: 0, y: 0 };
    return {
      [draggedId]: parent ? { x: parentPosition.x + flowPosition.x, y: parentPosition.y + flowPosition.y } : flowPosition,
    };
  }
  const offset = parent ? (parentFlowPosition ?? isoGroupFrame(parent).position) : { x: 0, y: 0 };
  const flat = roundPosition(flatTaskPosition({ x: offset.x + flowPosition.x, y: offset.y + flowPosition.y }));
  return { [draggedId]: parent ? clampToGroup(flat, parent) : flat };
}
