import type { Ontology } from "../types";

export function createBlankOntology(): Ontology {
  return {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Ontology",
    metadata: {
      name: "untitled-ontology",
      title: "Untitled Ontology",
      description: "Define shared entity types, properties, and relationships.",
      version: "1.0.0",
      source: { system: "ladder" },
    },
    spec: {
      types: [
        {
          id: "entity",
          label: "Entity",
          description: "Replace this starter type with the first governed concept.",
          properties: [],
        },
      ],
      relationships: [],
    },
  };
}
