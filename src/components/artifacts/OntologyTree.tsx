import { ChevronRight, Network } from "lucide-react";
import type { Ontology } from "../../types";

export function OntologyTree({
  ontology,
  selectedTypeId,
  onSelectType,
}: {
  ontology: Ontology;
  selectedTypeId: string | null;
  onSelectType: (id: string) => void;
}) {
  return (
    <ul aria-label="Ontology type and property tree" className="ontology-tree">
      {ontology.spec.types.map((type) => {
        const relationshipCount = ontology.spec.relationships.filter(
          (relationship) => relationship.sourceTypeId === type.id || relationship.targetTypeId === type.id,
        ).length;
        const selected = type.id === selectedTypeId;
        return (
          <li key={type.id}>
            <button
              aria-expanded={selected}
              className={selected ? "active" : undefined}
              onClick={() => onSelectType(type.id)}
              type="button"
            >
              <ChevronRight size={14} />
              <span>
                <strong>{type.label}</strong>
                <small>{type.id}</small>
              </span>
              <span className="ontology-tree-count">{type.properties.length}</span>
            </button>
            {selected ? (
              <ul className="ontology-tree-children">
                {type.properties.map((property) => (
                  <li key={property.id}>
                    <code>{property.dataType}</code>
                    <span>{property.label}</span>
                    {property.required ? <small>required</small> : null}
                  </li>
                ))}
                <li className="ontology-tree-relationships">
                  <Network size={12} /> {relationshipCount} connected relationships
                </li>
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
