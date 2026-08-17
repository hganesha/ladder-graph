import { ChevronRight, CirclePlus, FileInput, Layers3, Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useFormStore } from "../../store/useFormStore";

export function FormOutline() {
  const form = useFormStore((state) => state.form);
  const ontology = useFormStore((state) => state.ontology);
  const selection = useFormStore((state) => state.selection);
  const selectPage = useFormStore((state) => state.selectPage);
  const selectSection = useFormStore((state) => state.selectSection);
  const selectField = useFormStore((state) => state.selectField);
  const addPage = useFormStore((state) => state.addPage);
  const addSection = useFormStore((state) => state.addSection);
  const addField = useFormStore((state) => state.addField);
  const addOntologyField = useFormStore((state) => state.addOntologyField);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const properties = (ontology?.spec.types ?? []).flatMap((type) =>
    type.properties.map((property) => ({ property, typeLabel: type.label })),
  );
  const filteredProperties = deferredQuery
    ? properties.filter(
        ({ property, typeLabel }) =>
          property.label.toLowerCase().includes(deferredQuery) ||
          property.id.toLowerCase().includes(deferredQuery) ||
          typeLabel.toLowerCase().includes(deferredQuery),
      )
    : properties;

  return (
    <aside className="form-outline" aria-label="Form structure and domain fields">
      <section>
        <header className="form-panel-heading">
          <div>
            <small>Structure</small>
            <strong>Pages and fields</strong>
          </div>
          <button aria-label="Add page" className="icon-button" onClick={() => void addPage()} type="button">
            <CirclePlus size={16} />
          </button>
        </header>
        <div className="form-tree">
          {form?.spec.pages.map((page, pageIndex) => (
            <div className="form-tree-page" key={page.id}>
              <button
                className={selection.pageId === page.id && !selection.sectionId ? "active" : undefined}
                onClick={() => selectPage(page.id)}
                type="button"
              >
                <Layers3 size={14} />
                <span>
                  <small>Page {pageIndex + 1}</small>
                  <strong>{page.title}</strong>
                </span>
              </button>
              {page.sections.map((section) => (
                <div className="form-tree-section" key={section.id}>
                  <button
                    className={selection.sectionId === section.id && !selection.fieldId ? "active" : undefined}
                    onClick={() => selectSection(page.id, section.id)}
                    type="button"
                  >
                    <ChevronRight size={13} />
                    <strong>{section.title}</strong>
                    <small>{section.fields.length}</small>
                  </button>
                  {section.fields.map((field) => (
                    <button
                      className={selection.fieldId === field.id ? "active field" : "field"}
                      key={field.id}
                      onClick={() => selectField(page.id, section.id, field.id)}
                      type="button"
                    >
                      <FileInput size={12} />
                      <span>{field.label}</span>
                      {field.required ? (
                        <>
                          <b aria-hidden="true">*</b>
                          <span className="sr-only">Required</span>
                        </>
                      ) : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="form-outline-actions">
          <button disabled={!selection.pageId} onClick={() => void addSection()} type="button">
            <Plus size={13} /> Section
          </button>
          <button disabled={!selection.sectionId} onClick={() => void addField()} type="button">
            <Plus size={13} /> Field
          </button>
        </div>
      </section>

      <section className="domain-palette">
        <header className="form-panel-heading">
          <div>
            <small>Ontology palette</small>
            <strong>Insurance fields</strong>
          </div>
          <span>{properties.length}</span>
        </header>
        <label className="form-search">
          <Search size={14} />
          <span className="sr-only">Search ontology fields</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search domain fields" />
        </label>
        <div className="domain-property-list">
          {filteredProperties.map(({ property, typeLabel }) => (
            <button
              aria-label={`Add ${property.label} from ${typeLabel}`}
              disabled={!selection.sectionId}
              key={property.id}
              onClick={() => void addOntologyField(property)}
              title={selection.sectionId ? `Add ${property.label}` : "Select a section before adding a domain field"}
              type="button"
            >
              <span>
                <strong>{property.label}</strong>
                <small>{typeLabel}</small>
              </span>
              <code>{property.dataType}</code>
              <Plus size={13} />
            </button>
          ))}
          {!filteredProperties.length ? <p>No domain fields match “{query}”.</p> : null}
        </div>
      </section>
    </aside>
  );
}
