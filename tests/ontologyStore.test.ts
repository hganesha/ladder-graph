import { beforeEach, describe, expect, it } from "vitest";
import { useOntologyStore } from "../src/store/useOntologyStore";
import type { Ontology } from "../src/types";

const ontology: Ontology = {
  apiVersion: "ladder.dev/v1alpha1",
  kind: "Ontology",
  metadata: { name: "store-test", version: "1.0.0" },
  spec: { types: [{ id: "subject", label: "Subject", properties: [] }], relationships: [] },
};

describe("ontology workspace store", () => {
  beforeEach(() => useOntologyStore.getState().reset());

  it("reconciles selection and controls graph/tree state", () => {
    useOntologyStore.getState().reconcile(ontology);
    expect(useOntologyStore.getState().selectedTypeId).toBe("subject");
    useOntologyStore.getState().setView("tree");
    expect(useOntologyStore.getState().view).toBe("tree");
    useOntologyStore.getState().selectRelationship("rel");
    expect(useOntologyStore.getState()).toMatchObject({ selectedTypeId: null, selectedRelationshipId: "rel" });
  });
});
