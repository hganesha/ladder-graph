import { ArrowDown, ArrowUp, Copy, GripVertical, MousePointer2, Plus, Trash2 } from "lucide-react";
import { useFormStore } from "../../store/useFormStore";

export function FormCanvas() {
  const form = useFormStore((state) => state.form);
  const selection = useFormStore((state) => state.selection);
  const selectPage = useFormStore((state) => state.selectPage);
  const selectSection = useFormStore((state) => state.selectSection);
  const selectField = useFormStore((state) => state.selectField);
  const addSection = useFormStore((state) => state.addSection);
  const addField = useFormStore((state) => state.addField);
  const duplicateSelected = useFormStore((state) => state.duplicateSelected);
  const deleteSelected = useFormStore((state) => state.deleteSelected);
  const moveSelected = useFormStore((state) => state.moveSelected);

  if (!form) return <div className="form-canvas-empty">Fix the source diagnostics to resume structural editing.</div>;

  return (
    <div className="form-builder-canvas">
      <header>
        <span className="eyebrow">{form.spec.role} form</span>
        <h1>{form.metadata.title}</h1>
        <p>{form.metadata.description}</p>
      </header>
      <div className="form-selection-toolbar" aria-label="Selected element actions" role="toolbar">
        <button aria-label="Move selected element up" onClick={() => void moveSelected(-1)} type="button">
          <ArrowUp size={14} />
        </button>
        <button aria-label="Move selected element down" onClick={() => void moveSelected(1)} type="button">
          <ArrowDown size={14} />
        </button>
        <button aria-label="Duplicate selected field" disabled={!selection.fieldId} onClick={() => void duplicateSelected()} type="button">
          <Copy size={14} />
        </button>
        <button aria-label="Delete selected element" onClick={() => void deleteSelected()} type="button">
          <Trash2 size={14} />
        </button>
      </div>
      {form.spec.pages.map((page, pageIndex) => (
        <section
          className={selection.pageId === page.id && !selection.sectionId ? "form-canvas-page selected" : "form-canvas-page"}
          key={page.id}
        >
          <div className="form-canvas-page-heading">
            <button aria-label={`Select page ${page.title}`} onClick={() => selectPage(page.id)} type="button">
              {String(pageIndex + 1).padStart(2, "0")}
            </button>
            <div>
              <h2>{page.title}</h2>
              {page.description ? <p>{page.description}</p> : null}
            </div>
          </div>
          {page.sections.map((section) => (
            <section
              className={selection.sectionId === section.id && !selection.fieldId ? "form-canvas-section selected" : "form-canvas-section"}
              key={section.id}
            >
              <header>
                <div>
                  <h3>{section.title}</h3>
                  {section.description ? <p>{section.description}</p> : null}
                </div>
                <div className="form-section-actions">
                  <button
                    aria-label={`Select section ${section.title}`}
                    className="quiet-button"
                    onClick={() => selectSection(page.id, section.id)}
                    type="button"
                  >
                    <MousePointer2 size={13} /> Select
                  </button>
                  <button
                    aria-label={`Add field to ${section.title}`}
                    className="quiet-button"
                    onClick={() => {
                      selectSection(page.id, section.id);
                      void addField();
                    }}
                    type="button"
                  >
                    <Plus size={13} /> Field
                  </button>
                </div>
              </header>
              <div className="form-field-cards">
                {section.fields.map((field) => (
                  <button
                    className={`form-field-card span-${field.span ?? 1}${selection.fieldId === field.id ? " selected" : ""}`}
                    key={field.id}
                    onClick={() => selectField(page.id, section.id, field.id)}
                    type="button"
                  >
                    <GripVertical aria-hidden="true" size={14} />
                    <span>
                      <strong>
                        {field.label}
                        {field.required ? " *" : ""}
                      </strong>
                      <small>
                        {field.widget ?? field.dataType} · {field.name}
                      </small>
                      {field.ontologyPropertyRef ? <code>{field.ontologyPropertyRef}</code> : null}
                    </span>
                  </button>
                ))}
                {!section.fields.length ? (
                  <p className="form-drop-hint">Add a blank field or choose one from the ontology palette.</p>
                ) : null}
              </div>
            </section>
          ))}
          {!page.sections.length ? (
            <button
              className="form-add-section"
              onClick={() => {
                selectPage(page.id);
                void addSection();
              }}
              type="button"
            >
              <Plus size={14} /> Add the first section
            </button>
          ) : null}
        </section>
      ))}
    </div>
  );
}
