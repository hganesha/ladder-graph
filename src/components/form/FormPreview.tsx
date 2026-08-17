import { type ReactNode, useId } from "react";
import type { FormField, LadderForm } from "../../types";

function InputForField({ field }: { field: FormField }) {
  const id = useId();
  const common = {
    id,
    name: field.name,
    required: field.required,
    "aria-label": field.accessibilityLabel,
    "aria-describedby": field.helpText ? `${id}-help` : undefined,
  };
  let control: ReactNode;
  if (field.widget === "textarea" || field.dataType === "array" || field.dataType === "object") {
    control = <textarea {...common} minLength={field.minLength} maxLength={field.maxLength} rows={field.span === 2 ? 4 : 3} />;
  } else if (field.widget === "select" || field.widget === "radio") {
    control = (
      <select {...common} defaultValue="">
        <option value="" disabled>
          Select…
        </option>
        {field.allowedValues?.map((value) => (
          <option key={String(value)} value={String(value)}>
            {String(value).replaceAll("-", " ")}
          </option>
        ))}
      </select>
    );
  } else if (field.widget === "checkbox" || field.dataType === "boolean") {
    control = <input {...common} type="checkbox" />;
  } else {
    const type =
      field.widget === "file"
        ? "file"
        : field.dataType === "date"
          ? "date"
          : field.dataType === "datetime"
            ? "datetime-local"
            : field.dataType === "number" || field.dataType === "integer"
              ? "number"
              : "text";
    control = (
      <input {...common} type={type} min={field.minimum} max={field.maximum} minLength={field.minLength} maxLength={field.maxLength} />
    );
  }
  return (
    <div className={`preview-field span-${field.span ?? 1}`}>
      <label htmlFor={id}>
        {field.label}
        {field.required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {control}
      {field.helpText ? <small id={`${id}-help`}>{field.helpText}</small> : null}
      {field.ontologyPropertyRef ? <code>{field.ontologyPropertyRef}</code> : null}
    </div>
  );
}

export function FormPreview({ form, compact = false }: { form: LadderForm; compact?: boolean }) {
  return (
    <form className={`form-preview${compact ? " compact" : ""}`} onSubmit={(event) => event.preventDefault()}>
      <div className="form-preview-heading">
        <span>{form.spec.role} form</span>
        <h2>{form.metadata.title}</h2>
        <p>{form.metadata.description}</p>
      </div>
      {form.spec.pages.map((page) => (
        <section key={page.id} aria-labelledby={`preview-page-${page.id}`}>
          <h3 id={`preview-page-${page.id}`}>{page.title}</h3>
          {page.description ? <p>{page.description}</p> : null}
          {page.sections.map((section) => (
            <fieldset key={section.id}>
              <legend>{section.title}</legend>
              {section.description ? <p>{section.description}</p> : null}
              <div className="preview-field-grid">
                {section.fields.map((field) => (
                  <InputForField field={field} key={field.id} />
                ))}
              </div>
            </fieldset>
          ))}
        </section>
      ))}
      <button className="compile-button" type="submit">
        Preview submission
      </button>
      <small>Preview only. Ladder compiles the contract; the host owns submission and storage.</small>
    </form>
  );
}
