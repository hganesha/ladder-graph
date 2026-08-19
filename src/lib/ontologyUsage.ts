import type { ArtifactUsageMetadata, Ontology } from "../types";

export interface OntologyUsageEntry {
  id: string;
  kind: "workflow" | "form" | "document" | "workflow-bundle";
  title: string;
  propertyRefs: string[];
  relationshipIds: string[];
}

export function ontologyUsage(ontology: Ontology, artifacts: ArtifactUsageMetadata[]): OntologyUsageEntry[] {
  const ontologyRef = `ladder://ontologies/builtin/${ontology.metadata.name}`;
  const entries: OntologyUsageEntry[] = [];
  for (const template of artifacts) {
    if (template.kind === "form" || template.kind === "document") {
      const refs = template.propertyRefs;
      if (refs.length > 0)
        entries.push({ id: template.id, kind: template.kind, title: template.title, propertyRefs: refs, relationshipIds: [] });
      continue;
    }
    if (template.kind !== "workflow-bundle") continue;
    if (template.ontologyRef !== ontologyRef) continue;
    entries.push({
      id: template.workflowRef?.split("/").at(-1) ?? template.id,
      kind: "workflow",
      title: `${template.title} workflow`,
      propertyRefs: template.propertyRefs,
      relationshipIds: template.relationshipIds,
    });
    entries.push({
      id: template.id,
      kind: "workflow-bundle",
      title: template.title,
      propertyRefs: template.propertyRefs,
      relationshipIds: template.relationshipIds,
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
