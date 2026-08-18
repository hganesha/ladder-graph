import { Search } from "lucide-react";
import { useState } from "react";
import type { Ontology } from "../../types";
import { OntologyCanvas } from "../artifacts/OntologyCanvas";

export function BundleOntologyPreview({ ontology, title }: { ontology: Ontology; title: string }) {
  const [query, setQuery] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(ontology.spec.types[0]?.id ?? null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const selectedType = ontology.spec.types.find((type) => type.id === selectedTypeId);
  const selectedRelationship = ontology.spec.relationships.find((relationship) => relationship.id === selectedRelationshipId);

  return (
    <section className="ontology-preview bundle-ontology-preview" aria-label="Bundled ontology inspection">
      <header>
        <span className="eyebrow">Deterministic closure</span>
        <h2>{title}</h2>
        <p>Only explicit field and relationship references participate. Prompt text is never used to infer ontology scope.</p>
      </header>
      <div className="ontology-visual-workspace">
        <section className="ontology-canvas-panel">
          <header>
            <div>
              <strong>Semantic relationship graph</strong>
              <small>
                {ontology.spec.types.length} types · {ontology.spec.relationships.length} relationships
              </small>
            </div>
            <label className="form-search">
              <Search size={13} />
              <input
                aria-label="Search bundled ontology canvas"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a type"
                type="search"
                value={query}
              />
            </label>
          </header>
          <OntologyCanvas
            ontology={ontology}
            onSelectRelationship={(id) => {
              setSelectedRelationshipId(id);
              setSelectedTypeId(null);
            }}
            onSelectType={(id) => {
              setSelectedTypeId(id);
              setSelectedRelationshipId(null);
            }}
            query={query}
            selectedRelationshipId={selectedRelationshipId}
            selectedTypeId={selectedTypeId}
          />
        </section>
        <aside className="artifact-detail-card ontology-selection-inspector" aria-label="Bundled ontology inspector">
          {selectedRelationship ? (
            <>
              <header>
                <span>Relationship</span>
                <code>{selectedRelationship.id}</code>
              </header>
              <h2>{selectedRelationship.label}</h2>
              <p>{selectedRelationship.description ?? "No relationship description."}</p>
              <dl className="ontology-relationship-details">
                <div>
                  <dt>Source</dt>
                  <dd>{selectedRelationship.sourceTypeId}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{selectedRelationship.targetTypeId}</dd>
                </div>
                <div>
                  <dt>Cardinality</dt>
                  <dd>{selectedRelationship.cardinality ?? "Unspecified"}</dd>
                </div>
              </dl>
            </>
          ) : selectedType ? (
            <>
              <header>
                <span>Entity type</span>
                <code>{selectedType.id}</code>
              </header>
              <h2>{selectedType.label}</h2>
              <p>{selectedType.description ?? "No type description."}</p>
              <p>{selectedType.properties.length} included properties</p>
              <div className="artifact-property-grid">
                {selectedType.properties.map((property) => (
                  <section key={property.id}>
                    <div>
                      <strong>{property.label}</strong>
                      <code>{property.dataType}</code>
                    </div>
                    <p>{property.description ?? property.id}</p>
                    <small>
                      {property.required ? "Required" : "Optional"}
                      {property.identifier ? " · Identifier" : ""}
                    </small>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <p>Select an ontology type or relationship to inspect its compiled semantic contract.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
