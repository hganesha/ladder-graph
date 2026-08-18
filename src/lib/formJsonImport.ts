import { stringify } from "yaml";
import type { FormField, FormFieldType, FormWidget, LadderForm } from "../types";

interface JsonSchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  format?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

interface JsonSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface FormJsonImportResult {
  source: string;
  fieldCount: number;
  format: "ladder-form" | "json-schema";
}

function slug(value: string, fallback: string) {
  return (
    value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "") || fallback
  );
}

function title(value: string) {
  return value
    .split(/[_-]/gu)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function fieldType(property: JsonSchemaProperty): FormFieldType {
  const declared = Array.isArray(property.type) ? property.type.find((item) => item !== "null") : property.type;
  if (declared === "string" && property.format === "date") return "date";
  if (declared === "string" && property.format === "date-time") return "datetime";
  if (["string", "integer", "number", "boolean", "array", "object"].includes(declared ?? "")) return declared as FormFieldType;
  return "string";
}

function fieldWidget(dataType: FormFieldType, property: JsonSchemaProperty): FormWidget {
  if (property.enum?.length) return "select";
  if (dataType === "boolean") return "checkbox";
  if (dataType === "date") return "date";
  if (dataType === "datetime") return "datetime";
  if (dataType === "integer" || dataType === "number") return "number";
  if (dataType === "array" || dataType === "object") return "textarea";
  return "text";
}

function fieldCount(form: LadderForm) {
  if (!Array.isArray(form.spec?.pages)) return 0;
  return form.spec.pages.reduce(
    (pageTotal, page) =>
      pageTotal +
      (Array.isArray(page.sections)
        ? page.sections.reduce((sectionTotal, section) => sectionTotal + (Array.isArray(section.fields) ? section.fields.length : 0), 0)
        : 0),
    0,
  );
}

function containsReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsReference);
  if (!value || typeof value !== "object") return false;
  const object = value as Record<string, unknown>;
  return "$ref" in object || Object.values(object).some(containsReference);
}

function isLadderForm(value: unknown): value is LadderForm {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<LadderForm>;
  return candidate.apiVersion === "ladder.dev/v1alpha1" && candidate.kind === "Form";
}

export function importFormJson(source: string, filename = "imported-form.json"): FormJsonImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (isLadderForm(parsed)) {
    return {
      source: stringify(parsed, { lineWidth: 110 }),
      fieldCount: fieldCount(parsed),
      format: "ladder-form",
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Form JSON must contain one object.");
  }
  if (containsReference(parsed)) throw new Error("JSON Schema references are not supported during form import.");
  const schema = parsed as JsonSchema;
  const rootType = Array.isArray(schema.type) ? schema.type.find((item) => item !== "null") : schema.type;
  if (rootType && rootType !== "object") {
    throw new Error("JSON Schema forms must use an object at the root.");
  }
  if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
    throw new Error("Expected a Ladder Form artifact or an object JSON Schema with properties.");
  }
  if (Object.keys(schema.properties).length > 1_000) throw new Error("Form imports are limited to 1,000 fields.");

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const usedIds = new Set<string>();
  const fields: FormField[] = Object.entries(schema.properties).map(([name, property], index) => {
    if (!property || typeof property !== "object" || Array.isArray(property)) {
      throw new Error(`Property '${name}' must be a JSON Schema object.`);
    }
    const dataType = fieldType(property);
    const allowedValues = property.enum?.filter((value): value is string | number | boolean =>
      ["string", "number", "boolean"].includes(typeof value),
    );
    const baseId = slug(name, `field-${index + 1}`);
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    return {
      id,
      name: id.replaceAll("-", "_"),
      label: property.title?.trim() || title(name) || `Field ${index + 1}`,
      ...(property.description ? { description: property.description } : {}),
      dataType,
      widget: fieldWidget(dataType, property),
      ...(required.has(name) ? { required: true } : {}),
      ...(property.default !== undefined ? { defaultValue: property.default } : {}),
      ...(allowedValues?.length ? { allowedValues } : {}),
      ...(property.format ? { format: property.format } : {}),
      ...(typeof property.minimum === "number" ? { minimum: property.minimum } : {}),
      ...(typeof property.maximum === "number" ? { maximum: property.maximum } : {}),
      ...(typeof property.minLength === "number" ? { minLength: property.minLength } : {}),
      ...(typeof property.maxLength === "number" ? { maxLength: property.maxLength } : {}),
      accessibilityLabel: property.title?.trim() || title(name) || `Field ${index + 1}`,
    };
  });

  const filenameBase = filename.replace(/(?:\.schema)?\.json$/iu, "");
  const formTitle = schema.title?.trim() || title(filenameBase) || "Imported Form";
  const form: LadderForm = {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Form",
    metadata: {
      name: slug(formTitle, "imported-form"),
      title: formTitle,
      ...(schema.description ? { description: schema.description } : {}),
      version: "1.0.0",
      source: {
        system: "json-schema",
        sourceId: schema.$id || filename,
      },
    },
    spec: {
      role: "start",
      pages: [
        {
          id: "main",
          title: formTitle,
          sections: [{ id: "details", title: "Details", fields }],
        },
      ],
      submissionSchema: parsed as Record<string, unknown>,
    },
  };

  return { source: stringify(form, { lineWidth: 110 }), fieldCount: fields.length, format: "json-schema" };
}
