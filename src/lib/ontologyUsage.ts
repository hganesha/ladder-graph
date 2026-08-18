import { parse } from "yaml";
import type { ArtifactTemplateDefinition, Ontology, WorkflowBundle } from "../types";

export interface OntologyUsageEntry {
  id: string;
  kind: "workflow" | "form" | "document" | "workflow-bundle";
  title: string;
  propertyRefs: string[];
  relationshipIds: string[];
}

function propertyRefs(value: unknown, result = new Set<string>()) {
  if (Array.isArray(value)) for (const child of value) propertyRefs(child, result);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "ontologyPropertyRef" && typeof child === "string") result.add(child);
      propertyRefs(child, result);
    }
  }
  return [...result].sort();
}

export function ontologyUsage(ontology: Ontology, artifacts: ArtifactTemplateDefinition[]): OntologyUsageEntry[] {
  const ontologyRef = `ladder://ontologies/builtin/${ontology.metadata.name}`;
  const entries: OntologyUsageEntry[] = [];
  for (const template of artifacts) {
    const value = parse(template.yaml) as Ontology | WorkflowBundle | Record<string, unknown>;
    if (template.kind === "form" || template.kind === "document") {
      const refs = propertyRefs(value);
      if (refs.length > 0)
        entries.push({ id: template.id, kind: template.kind, title: template.title, propertyRefs: refs, relationshipIds: [] });
      continue;
    }
    if (template.kind !== "workflow-bundle") continue;
    const bundle = value as WorkflowBundle;
    if (bundle.spec.ontology?.ref !== ontologyRef) continue;
    const selection = bundle.spec.ontology.selection;
    entries.push({
      id: bundle.spec.workflowRef.split("/").at(-1) ?? template.id,
      kind: "workflow",
      title: `${template.title} workflow`,
      propertyRefs: [...(selection?.propertyRefs ?? [])].sort(),
      relationshipIds: [...(selection?.relationshipIds ?? [])].sort(),
    });
    entries.push({
      id: template.id,
      kind: "workflow-bundle",
      title: template.title,
      propertyRefs: [...new Set([...(selection?.propertyRefs ?? []), ...propertyRefs(bundle)])].sort(),
      relationshipIds: [...(selection?.relationshipIds ?? [])].sort(),
    });
  }
  return entries
    .filter(
      (entry) =>
        entry.propertyRefs.some((reference) => ontology.spec.types.some((type) => reference.startsWith(`${type.id}.`))) ||
        entry.relationshipIds.length > 0,
    )
    .sort((left, right) => `${left.kind}:${left.title}`.localeCompare(`${right.kind}:${right.title}`));
}

export function usageForType(entries: OntologyUsageEntry[], typeId: string) {
  return entries.filter((entry) => entry.propertyRefs.some((reference) => reference.startsWith(`${typeId}.`)));
}
