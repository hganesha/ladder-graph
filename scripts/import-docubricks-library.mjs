import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { convertDocuBricksRule } from "../src/compiler/artifacts/docubricksRules.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const catalogRoot = resolve(projectRoot, "catalog");
const classificationPath = resolve(catalogRoot, "imports/docubricks-classification.yaml");
const reportPath = resolve(catalogRoot, "imports/docubricks-import-report.json");
const args = process.argv.slice(2);
const check = args.includes("--check");
const sourceIndex = args.indexOf("--source");
const sourceRoot = resolve(sourceIndex >= 0 ? args[sourceIndex + 1] : "");

if (sourceIndex < 0 || !args[sourceIndex + 1]) {
  throw new Error("Usage: node scripts/import-docubricks-library.mjs --source /path/to/DocuBricks [--check]");
}
await access(sourceRoot);

const classification = parse(await readFile(classificationPath, "utf8"));
const entries = classification.spec.entries;
const manifestPath = resolve(catalogRoot, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const verticalTitles = {
  energy: "Energy",
  fs: "Financial services",
  healthcare: "Healthcare",
  insurance: "Insurance",
  legal: "Legal",
  manufacturing: "Manufacturing",
  real_estate: "Real estate",
  risk_compliance: "Risk & compliance",
};
const curated = new Map([
  ["insurance/first_notice_of_loss", { kind: "form", id: "first-notice-of-loss" }],
  ["insurance/insurance_claim_file", { kind: "document", id: "insurance-claim-file" }],
]);

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}

function title(value) {
  return value
    .split(/[_-]/gu)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function dataType(field) {
  if (field.type.startsWith("array<")) return "array";
  return field.type;
}

function widget(field) {
  if (field.type === "boolean") return "checkbox";
  if (field.type === "date") return "date";
  if (field.type === "datetime") return "datetime";
  if (field.type === "number" || field.type === "integer") return "number";
  if (field.type.startsWith("array<") || (field.description?.length ?? 0) > 150) return "textarea";
  return "text";
}

function jsonSchema(field) {
  if (field.type === "array<string>") return { type: "array", items: { type: "string" }, description: field.description };
  if (field.type === "array<object>") {
    const properties = Object.fromEntries((field.item_schema ?? []).map((item) => [item.name, jsonSchema(item)]));
    return { type: "array", items: { type: "object", properties }, description: field.description };
  }
  const schema = { type: field.type, description: field.description };
  if (field.type === "date") schema.format = "date";
  if (field.type === "datetime") schema.format = "date-time";
  return schema;
}

function outputSchema(fields) {
  const required = fields.filter((field) => field.required).map((field) => field.name);
  return {
    type: "object",
    properties: Object.fromEntries(fields.map((field) => [field.name, jsonSchema(field)])),
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  };
}

function normalizedSections(schema) {
  if (schema.sections?.length) return schema.sections;
  return [...new Set(schema.fields.map((field) => field.section ?? "details"))].map((id) => ({
    id,
    title: title(id),
    description: `${title(id)} fields from the DocuBricks contract.`,
  }));
}

function formArtifact(schema, entry, digest, rules, reviewPolicy, modelRouting, identity = {}) {
  const sections = normalizedSections(schema);
  const schemaContract = outputSchema(schema.fields);
  schemaContract["x-ladder-docubricks"] = {
    completenessChecklist: schema.completeness_checklist ?? [],
  };
  return {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Form",
    metadata: metadata(schema, digest, identity),
    spec: {
      role: entry.role ?? "start",
      pages: [
        {
          id: "main",
          title: title(schema.document_type),
          sections: sections.map((section) => ({
            id: slug(section.id),
            title: section.title ?? title(section.id),
            ...(section.description ? { description: section.description } : {}),
            fields: schema.fields
              .filter((field) =>
                section.fields?.length ? section.fields.includes(field.name) : (field.section ?? "details") === section.id,
              )
              .map((field) => ({
                id: slug(field.name),
                name: field.name,
                label: title(field.name),
                ...(field.description ? { description: field.description } : {}),
                dataType: dataType(field),
                widget: widget(field),
                ...(field.required ? { required: true } : {}),
                ...(field.type.startsWith("array<") || (field.description?.length ?? 0) > 150 ? { span: 2 } : {}),
              })),
          })),
        },
      ],
      validationRules: rules,
      reviewPolicy,
      ...(modelRouting ? { modelRouting } : {}),
      submissionSchema: schemaContract,
    },
  };
}

function documentArtifact(schema, digest, rules, reviewPolicy, modelRouting, sourceMetadata, identity = {}) {
  return {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "Document",
    metadata: metadata(schema, digest, identity),
    spec: {
      documentType: schema.document_type,
      sections: normalizedSections(schema).map((section) => ({
        id: slug(section.id),
        title: section.title ?? title(section.id),
        ...(section.description ? { description: section.description } : {}),
        fieldIds: (
          section.fields ?? schema.fields.filter((field) => (field.section ?? "details") === section.id).map((field) => field.name)
        ).map(slug),
      })),
      fields: schema.fields.map((field) => ({
        id: slug(field.name),
        name: field.name,
        label: title(field.name),
        ...(field.description ? { description: field.description } : {}),
        dataType: dataType(field),
        ...(field.required ? { required: true } : {}),
        sourcePath: `/fields/${field.name}`,
      })),
      validationRules: rules,
      reviewPolicy,
      ...(modelRouting ? { modelRouting } : {}),
      outputSchema: outputSchema(schema.fields),
      inertSourceMetadata: sourceMetadata,
    },
  };
}

function metadata(schema, digest, identity = {}) {
  return {
    name: identity.name ?? `docubricks-${slug(schema.vertical)}-${slug(schema.document_type)}`,
    title: identity.title ?? title(schema.document_type),
    description: `${title(schema.document_type)} contract normalized from the DocuBricks ${verticalTitles[schema.vertical] ?? schema.vertical} library.`,
    version: schema.schema_version ?? "unversioned",
    source: {
      system: "docubricks",
      sourceId: `${schema.vertical}/${schema.document_type}`,
      sourcePath: `Schemas/${schema.vertical}/${schema.document_type}`,
      sourceVersion: schema.schema_version,
      sourceDigest: digest,
      ...(identity.derivedFrom ? { derivedFrom: identity.derivedFrom } : {}),
    },
  };
}

function normalizeReviewPolicy(thresholds) {
  const fieldConfidence = Object.fromEntries(
    Object.entries(thresholds ?? {}).flatMap(([field, value]) => {
      if (field === "default_threshold" || !value || typeof value !== "object" || Array.isArray(value)) return [];
      if (typeof value.min_confidence !== "number") return [];
      return [
        [
          field,
          {
            minConfidence: value.min_confidence,
            ...(typeof value.review_on_breach === "boolean" ? { reviewOnBreach: value.review_on_breach } : {}),
            ...(typeof value.fail_on_breach === "boolean" ? { failOnBreach: value.fail_on_breach } : {}),
            ...(typeof value.regulatory_required === "boolean" ? { regulatoryRequired: value.regulatory_required } : {}),
            ...(typeof value.description === "string" ? { rationale: value.description } : {}),
          },
        ],
      ];
    }),
  );
  return {
    unsupportedRuleAction: "human-review",
    ...(typeof thresholds?.default_threshold === "number" ? { defaultConfidenceThreshold: thresholds.default_threshold } : {}),
    ...(Object.keys(fieldConfidence).length ? { fieldConfidence } : {}),
  };
}

function normalizeModelRouting(routing) {
  if (!routing) return undefined;
  return {
    ...(routing.primary ? { primary: routing.primary } : {}),
    ...(routing.fallback_chain ? { fallbackChain: routing.fallback_chain } : {}),
    ...(typeof routing.max_tokens === "number" ? { maxTokens: routing.max_tokens } : {}),
    ...(typeof routing.temperature === "number" ? { temperature: routing.temperature } : {}),
    ...(typeof routing.timeout_seconds === "number" ? { timeoutSeconds: routing.timeout_seconds } : {}),
    ...(typeof routing.max_retries === "number" ? { maxRetries: routing.max_retries } : {}),
    ...(routing.tier_overrides ? { tierOverrides: routing.tier_overrides } : {}),
    ...(routing.rationale ? { rationale: routing.rationale } : {}),
  };
}

async function sourceFiles(directory) {
  const names = ["fields.json", "validation_rules.json", "field_thresholds.json", "model_routing.json"];
  const files = [];
  for (const name of names) {
    try {
      files.push([name, await readFile(resolve(directory, name), "utf8")]);
    } catch {
      // Optional DocuBricks metadata is reported when absent, not synthesized.
    }
  }
  return files;
}

function digest(files) {
  const hash = createHash("sha256");
  for (const [name, content] of files) hash.update(`${name}\0${content}\0`);
  return hash.digest("hex");
}

const generated = [];
const reportEntries = [];
let safeRules = 0;
let unsupportedRules = 0;
let fieldCount = 0;
let thresholdCount = 0;
let curatedExisting = 0;
const artifactCounts = { form: 0, document: 0 };
const unsupportedReasons = {};

for (const entry of entries) {
  const key = `${entry.vertical}/${entry.documentType}`;
  const directory = resolve(sourceRoot, classification.spec.sourceRoot, entry.vertical, entry.documentType);
  const files = await sourceFiles(directory);
  const fieldsFile = files.find(([name]) => name === "fields.json");
  if (!fieldsFile) throw new Error(`Missing fields.json for classified DocuBricks schema '${key}'.`);
  const schema = JSON.parse(fieldsFile[1]);
  const rules = JSON.parse(files.find(([name]) => name === "validation_rules.json")?.[1] ?? "[]");
  const thresholds = JSON.parse(files.find(([name]) => name === "field_thresholds.json")?.[1] ?? "{}");
  const routing = JSON.parse(files.find(([name]) => name === "model_routing.json")?.[1] ?? "null");
  const selectedKind = entry.artifactKind === "hybrid" ? entry.primaryExperience : entry.artifactKind;
  if (!selectedKind) throw new Error(`Hybrid classification '${key}' requires primaryExperience.`);
  const fieldNames = new Set(schema.fields.map((field) => field.name));
  const convertedRules = rules.map((rule) => convertDocuBricksRule(rule, fieldNames));
  safeRules += convertedRules.filter((rule) => rule.supported).length;
  unsupportedRules += convertedRules.filter((rule) => !rule.supported).length;
  for (const rule of convertedRules.filter((rule) => !rule.supported)) {
    const reason = rule.unsupportedReason ?? "Unknown reason";
    unsupportedReasons[reason] = (unsupportedReasons[reason] ?? 0) + 1;
  }
  fieldCount += schema.fields.length;
  const sourceDigest = digest(files);
  const existing = curated.get(key);
  if (existing) curatedExisting += 1;
  const id = existing?.id ?? `docubricks-${slug(entry.vertical)}-${slug(entry.documentType)}`;
  const reviewPolicy = normalizeReviewPolicy(thresholds);
  const modelRouting = normalizeModelRouting(routing);
  const sourceMetadata = {
    family: schema.family,
    externalStandard: schema.external_standard,
    outputContract: schema.output_contract,
    completenessChecklist: schema.completeness_checklist ?? [],
    sourceFiles: files.map(([name]) => name),
  };
  thresholdCount += Object.keys(reviewPolicy.fieldConfidence ?? {}).length;
  const artifact =
    selectedKind === "form"
      ? formArtifact(schema, entry, sourceDigest, convertedRules, reviewPolicy, modelRouting)
      : documentArtifact(schema, sourceDigest, convertedRules, reviewPolicy, modelRouting, sourceMetadata);
  const artifacts = [{ kind: selectedKind, id, artifact, suffix: undefined }];
  if (entry.artifactKind === "hybrid") {
    const counterpartKind = selectedKind === "form" ? "document" : "form";
    const suffix = counterpartKind === "document" ? "source" : "review";
    const counterpartId = `${id}-${suffix}`;
    const identity = {
      name: counterpartId,
      title: `${title(entry.documentType)} ${title(suffix)}`,
      derivedFrom: id,
    };
    const counterpart =
      counterpartKind === "form"
        ? formArtifact(
            schema,
            { ...entry, role: entry.role ?? "review" },
            sourceDigest,
            convertedRules,
            reviewPolicy,
            modelRouting,
            identity,
          )
        : documentArtifact(schema, sourceDigest, convertedRules, reviewPolicy, modelRouting, sourceMetadata, identity);
    artifacts.push({ kind: counterpartKind, id: counterpartId, artifact: counterpart, suffix });
  }
  for (const item of artifacts) artifactCounts[item.kind] += 1;
  if (!existing) {
    for (const item of artifacts) {
      const plural = item.kind === "form" ? "forms" : "documents";
      const file = `${plural}/${item.id}.yaml`;
      generated.push({
        kind: item.kind,
        file,
        content: stringify(item.artifact, { lineWidth: 110 }),
        manifest: {
          id: item.id,
          path: `${entry.vertical}/${schema.family ?? "general"}/${entry.documentType}${item.suffix ? `/${item.suffix}` : ""}`,
          title: item.artifact.metadata.title,
          description: item.artifact.metadata.description,
          file,
          ref: `ladder://${plural}/docubricks/${entry.vertical}/${entry.documentType}${item.suffix ? `/${item.suffix}` : ""}`,
        },
      });
    }
  }
  const counterpart = artifacts[1];
  reportEntries.push({
    source: key,
    classification: entry.artifactKind,
    primaryExperience: selectedKind,
    catalogId: id,
    ...(counterpart ? { counterpartId: counterpart.id, counterpartKind: counterpart.kind } : {}),
    status: existing ? "curated-existing" : "generated",
    fields: schema.fields.length,
    rules: {
      total: rules.length,
      safe: convertedRules.filter((rule) => rule.supported).length,
      unsupported: convertedRules.filter((rule) => !rule.supported).length,
    },
    thresholds: {
      fields: Object.keys(reviewPolicy.fieldConfidence ?? {}).length,
      hasDefault: typeof reviewPolicy.defaultConfidenceThreshold === "number",
    },
    sourceDigest,
    sourceFiles: files.map(([name]) => name).join(", "),
    rationale: entry.rationale,
  });
}

const expectedForms = [
  ...manifest.forms.filter((entry) => !entry.ref.includes("/docubricks/")),
  ...generated.filter((item) => item.kind === "form").map((item) => item.manifest),
];
const expectedDocuments = [
  ...manifest.documents.filter((entry) => !entry.ref.includes("/docubricks/")),
  ...generated.filter((item) => item.kind === "document").map((item) => item.manifest),
];
expectedForms.sort((left, right) => left.ref.localeCompare(right.ref));
expectedDocuments.sort((left, right) => left.ref.localeCompare(right.ref));
const nextManifest = `${JSON.stringify({ ...manifest, forms: expectedForms, documents: expectedDocuments }, null, 2)}\n`;
const report = `${JSON.stringify(
  {
    kind: "DocuBricksImportReport",
    classificationVersion: classification.metadata.version,
    source: basename(sourceRoot),
    totals: {
      schemas: entries.length,
      artifacts: artifactCounts.form + artifactCounts.document,
      generated: generated.length,
      curatedExisting,
      forms: artifactCounts.form,
      documents: artifactCounts.document,
      hybrids: reportEntries.filter((entry) => entry.classification === "hybrid").length,
      fields: fieldCount,
      thresholds: thresholdCount,
      rules: { safe: safeRules, unsupported: unsupportedRules, unsupportedReasons },
    },
    entries: reportEntries,
  },
  null,
  2,
)}\n`;

async function emit(path, content) {
  if (check) {
    const current = await readFile(path, "utf8").catch(() => undefined);
    if (current !== content) throw new Error(`${path.replace(`${projectRoot}/`, "")} is not up to date.`);
  } else {
    await writeFile(path, content);
  }
}

for (const item of generated) await emit(resolve(catalogRoot, item.file), item.content);
await emit(manifestPath, nextManifest);
await emit(reportPath, report);
console.log(
  `${check ? "Verified" : "Imported"} ${entries.length} DocuBricks schemas as ${artifactCounts.form + artifactCounts.document} artifacts: ${artifactCounts.form} forms, ${artifactCounts.document} documents, ${fieldCount} fields.`,
);
