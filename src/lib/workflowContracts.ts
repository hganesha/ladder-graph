import type { LgirNode, WorkflowContractRef } from "../types";

export type WorkflowContractKind = "form" | "document";

export function workflowContractKind(ref: string): WorkflowContractKind | null {
  if (/^ladder:\/\/forms\/.+/u.test(ref)) return "form";
  if (/^ladder:\/\/documents\/.+/u.test(ref)) return "document";
  return null;
}

export function nodeContractRefs(node: Pick<LgirNode, "contractRefs" | "formRefs">): WorkflowContractRef[] {
  const contracts = [...(node.contractRefs ?? [])];
  const attached = new Set(contracts.map((contract) => contract.ref));
  for (const ref of node.formRefs ?? []) {
    if (!attached.has(ref)) contracts.push({ ref, usage: "human-interaction" });
  }
  return contracts;
}
