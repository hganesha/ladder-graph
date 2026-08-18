import { create } from "zustand";
import type { Ontology, OntologySliceResult } from "../types";

interface OntologyWorkspaceState {
  view: "graph" | "tree";
  selectedTypeId: string | null;
  selectedRelationshipId: string | null;
  slicePreview: { seedId: string; result: OntologySliceResult } | null;
  setView: (view: "graph" | "tree") => void;
  selectType: (id: string | null) => void;
  selectRelationship: (id: string | null) => void;
  setSlicePreview: (preview: { seedId: string; result: OntologySliceResult } | null) => void;
  reconcile: (ontology: Ontology) => void;
  reset: () => void;
}

const initial = {
  view: "graph" as const,
  selectedTypeId: null,
  selectedRelationshipId: null,
  slicePreview: null,
};

export const useOntologyStore = create<OntologyWorkspaceState>((set) => ({
  ...initial,
  setView: (view) => set({ view }),
  selectType: (selectedTypeId) => set({ selectedTypeId, selectedRelationshipId: null, slicePreview: null }),
  selectRelationship: (selectedRelationshipId) => set({ selectedRelationshipId, selectedTypeId: null, slicePreview: null }),
  setSlicePreview: (slicePreview) => set({ slicePreview }),
  reconcile: (ontology) =>
    set((state) => ({
      selectedTypeId:
        state.selectedTypeId && ontology.spec.types.some((type) => type.id === state.selectedTypeId)
          ? state.selectedTypeId
          : (ontology.spec.types[0]?.id ?? null),
      selectedRelationshipId:
        state.selectedRelationshipId && ontology.spec.relationships.some((relationship) => relationship.id === state.selectedRelationshipId)
          ? state.selectedRelationshipId
          : null,
    })),
  reset: () => set(initial),
}));
