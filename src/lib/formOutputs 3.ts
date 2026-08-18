import { stringify } from "yaml";
import type { FormField, LadderForm } from "../types";

export function allFormFields(form: LadderForm) {
  return form.spec.pages.flatMap((page) => page.sections.flatMap((section) => section.fields));
}

export function formSubmissionSchema(form: LadderForm) {
  if (form.spec.submissionSchema && Object.keys(form.spec.submissionSchema).length) return form.spec.submissionSchema;
  const fields = allFormFields(form);
  return {
    type: "object",
    additionalProperties: false,
    required: fields.filter((field) => field.required).map((field) => field.name),
    properties: Object.fromEntries(
      [...fields].sort((left, right) => left.name.localeCompare(right.name)).map((field) => [field.name, schemaForField(field)]),
    ),
  };
}

function schemaForField(field: FormField) {
  const type = field.dataType === "date" || field.dataType === "datetime" ? "string" : field.dataType;
  const schema: Record<string, unknown> = { type, title: field.label };
  if (field.description) schema.description = field.description;
  if (field.dataType === "date") schema.format = "date";
  if (field.dataType === "datetime") schema.format = "date-time";
  if (field.allowedValues?.length) schema.enum = field.allowedValues;
  if (field.minimum !== undefined) schema.minimum = field.minimum;
  if (field.maximum !== undefined) schema.maximum = field.maximum;
  if (field.minLength !== undefined) schema.minLength = field.minLength;
  if (field.maxLength !== undefined) schema.maxLength = field.maxLength;
  return schema;
}

export function formUiSchema(form: LadderForm) {
  return {
    role: form.spec.role,
    pages: form.spec.pages.map((page) => ({
      id: page.id,
      title: page.title,
      sections: page.sections.map((section) => ({
        id: section.id,
        title: section.title,
        fields: section.fields.map((field) => field.name),
      })),
    })),
  };
}

export function createFormOutputFiles(form: LadderForm) {
  return [
    {
      name: `${form.metadata.name}.yaml`,
      mimeType: "application/yaml",
      content: stringify(form, { lineWidth: 110 }),
    },
    {
      name: `${form.metadata.name}.schema.json`,
      mimeType: "application/schema+json",
      content: `${JSON.stringify(formSubmissionSchema(form), null, 2)}\n`,
    },
    {
      name: `${form.metadata.name}.ui.json`,
      mimeType: "application/json",
      content: `${JSON.stringify(formUiSchema(form), null, 2)}\n`,
    },
  ];
}
