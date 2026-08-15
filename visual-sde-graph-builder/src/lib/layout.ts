import dagre from "@dagrejs/dagre";
import type { GraphEdge, GraphNode } from "./model";

const NODE_W = 280;
const NODE_H = 132;

export function autoLayout(nodes: GraphNode[], edges: GraphEdge[], dir: "TB" | "LR" = "TB"): GraphNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: dir,
    nodesep: 56,
    ranksep: 88,
    marginx: 24,
    marginy: 24,
  });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges
    .filter((e) => e.data?.kind !== "loop")
    .forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
    };
  });
}
