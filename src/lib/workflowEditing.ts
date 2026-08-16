import type { Workflow } from "../types";

export function deleteWorkflowElements(workflow: Workflow, nodeIds: string[], edgeIds: string[]): Workflow {
  const removedNodes = new Set(nodeIds);
  const removedEdges = new Set(edgeIds);
  if (!removedNodes.size && !removedEdges.size) return workflow;

  const nodes = workflow.spec.nodes
    .filter((node) => !removedNodes.has(node.id))
    .map((node) => {
      const members = node.config?.members?.filter((id) => !removedNodes.has(id));
      const body = node.config?.body?.filter((id) => !removedNodes.has(id));
      if (members === node.config?.members && body === node.config?.body) return node;
      return {
        ...node,
        config: {
          ...node.config,
          ...(members ? { members } : {}),
          ...(body ? { body } : {}),
        },
      };
    });
  const edges = workflow.spec.edges.filter(
    (edge) => !removedEdges.has(edge.id) && !removedNodes.has(edge.from) && !removedNodes.has(edge.to),
  );

  return { ...workflow, spec: { ...workflow.spec, nodes, edges } };
}
