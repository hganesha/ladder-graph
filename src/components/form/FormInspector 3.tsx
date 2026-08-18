import { Link2, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { getSelectedFormParts, useFormStore } from "../../store/useFormStore";
import type { FormFieldType, FormWidget } from "../../types";

function InspectorInput({
  label,
  value,
  onCommit,
  multiline = false,
  placeholder,
}: {
  label: string;
  value?: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <label>
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          value={draft}
          placeholder={placeholder}
          onBlur={() => {
            if (draft !== (value ?? "")) onCommit(draft);
          }}
          onChange={(event) => setDraft(event.target.value)}
        />
      ) : (
        <input
          value={draft}
          placeholder={placeholder}
          onBlur={() => {
            if (draft !== (value ?? "")) onCommit(draft);
          }}
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
    </label>
  );
}

const DATA_TYPES: FormFieldType[] = ["string", "integer", "number", "boolean", "date", "datetime", "array", "object"];
const WIDGETS: FormWidget[] = ["text", "textarea", "number", "date", "datetime", "select", "radio", "checkbox", "file"];

export function FormInspector() {
  const state = useFormStore();
  const { page, section, field } = getSelectedFormParts(state);

  return (
    <aside className="form-inspector" aria-label="Form element inspector">
      <header className="form-panel-heading">
        <div>
          <small>Inspector</small>
          <strong>{field ? "Field" : section ? "Section" : page ? "Page" : "Form"}</strong>
        </div>
        <SlidersHorizontal size={16} />
      </header>

      {field ? (
        <div className="form-inspector-fields" key={field.id}>
          <InspectorInput label="Label" value={field.label} onCommit={(label) => void state.patchField({ label })} />
          <InspectorInput label="Field name" value={field.name} onCommit={(name) => void state.patchField({ name })} />
          <label>
            <span>Data type</span>
            <select value={field.dataType} onChange={(event) => void state.patchField({ dataType: event.target.value as FormFieldType })}>
              {DATA_TYPES.map((dataType) => (
                <option key={dataType}>{dataType}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Widget</span>
            <select
              value={field.widget ?? "text"}
              onChange={(event) => void state.patchField({ widget: event.target.value as FormWidget })}
            >
              {WIDGETS.map((widget) => (
                <option key={widget}>{widget}</option>
              ))}
            </select>
          </label>
          <div className="inspector-inline-controls">
            <label className="checkbox-control">
              <input
                checked={Boolean(field.required)}
                onChange={(event) => void state.patchField({ required: event.target.checked })}
                type="checkbox"
              />
              <span>Required</span>
            </label>
            <label>
              <span>Width</span>
              <select value={field.span ?? 1} onChange={(event) => void state.patchField({ span: Number(event.target.value) as 1 | 2 })}>
                <option value={1}>Half</option>
                <option value={2}>Full</option>
              </select>
            </label>
          </div>
          <InspectorInput label="Help text" multiline value={field.helpText} onCommit={(helpText) => void state.patchField({ helpText })} />
          <InspectorInput
            label="Accessibility label"
            value={field.accessibilityLabel}
            onCommit={(accessibilityLabel) => void state.patchField({ accessibilityLabel })}
          />
          <InspectorInput
            label="Error message"
            value={field.errorMessage}
            onCommit={(errorMessage) => void state.patchField({ errorMessage })}
          />
          <InspectorInput
            label="Allowed values"
            placeholder="open, pending, closed"
            value={field.allowedValues?.join(", ")}
            onCommit={(value) =>
              void state.patchField({
                allowedValues: value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
          <div className="inspector-group-heading">
            <Link2 size={14} /> Bindings
          </div>
          <InspectorInput
            label="Ontology property"
            value={field.ontologyPropertyRef}
            onCommit={(ontologyPropertyRef) => void state.patchField({ ontologyPropertyRef })}
          />
          <InspectorInput
            label="Workflow path"
            placeholder="/spec/nodes/0/inputSchema/..."
            value={field.workflowPath}
            onCommit={(workflowPath) => void state.patchField({ workflowPath })}
          />
        </div>
      ) : section ? (
        <div className="form-inspector-fields" key={section.id}>
          <InspectorInput label="Section title" value={section.title} onCommit={(title) => void state.patchSection({ title })} />
          <InspectorInput
            label="Description"
            multiline
            value={section.description}
            onCommit={(description) => void state.patchSection({ description })}
          />
          <p className="inspector-note">{section.fields.length} fields use a responsive two-column grid.</p>
        </div>
      ) : page ? (
        <div className="form-inspector-fields" key={page.id}>
          <InspectorInput label="Page title" value={page.title} onCommit={(title) => void state.patchPage({ title })} />
          <InspectorInput
            label="Description"
            multiline
            value={page.description}
            onCommit={(description) => void state.patchPage({ description })}
          />
          <p className="inspector-note">{page.sections.length} sections in this page.</p>
        </div>
      ) : state.form ? (
        <div className="form-inspector-fields">
          <InspectorInput label="Form title" value={state.form.metadata.title} onCommit={(title) => void state.patchMetadata({ title })} />
          <InspectorInput
            label="Description"
            multiline
            value={state.form.metadata.description}
            onCommit={(description) => void state.patchMetadata({ description })}
          />
        </div>
      ) : null}
    </aside>
  );
}
