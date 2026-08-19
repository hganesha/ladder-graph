import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

const root = resolve(import.meta.dirname, "..");
const catalogRoot = resolve(root, "catalog");
const manifest = JSON.parse(await readFile(resolve(catalogRoot, "manifest.json"), "utf8"));
const subjectRelations = JSON.parse(await readFile(resolve(catalogRoot, "subject-relations.json"), "utf8"));
const agentUsage = JSON.parse(await readFile(resolve(catalogRoot, "agent-usage.json"), "utf8"));
const paletteOnlyAgents = new Set(agentUsage.paletteOnly);
const bodyRoot = resolve(root, "public/catalog/bodies");

function bodyReference(kind, id, payload) {
  const serialized = JSON.stringify(payload);
  const hash = createHash("sha256").update(serialized).digest("hex");
  return {
    serialized,
    bodyHash: hash,
    bodyUrl: `catalog/bodies/${kind}/${id}.${hash.slice(0, 16)}.json`,
  };
}

async function writeBody(kind, id, payload) {
  const reference = bodyReference(kind, id, payload);
  const path = resolve(root, "public", reference.bodyUrl);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, `${reference.serialized}\n`);
  return { bodyHash: reference.bodyHash, bodyUrl: reference.bodyUrl };
}

const supportedModalities = new Set(["text", "image", "audio", "video", "document", "mixed"]);

function workflowModalities(document) {
  const modes = document.spec.nodes
    .filter((node) => node.kind === "input")
    .map((node) => node.inputSchema?.["x-ladder-input-mode"] ?? "text")
    .filter((mode) => supportedModalities.has(mode));
  return [...new Set(modes.length ? modes : ["text"])];
}

function agentModalities(document) {
  const explicit = document.spec.modalities?.filter((mode) => supportedModalities.has(mode));
  if (explicit?.length) return [...new Set(explicit)];

  const text = [document.metadata.title, document.spec.role, document.spec.prompt, ...(document.spec.capabilities?.skills ?? [])]
    .join(" ")
    .toLowerCase();
  const modes = new Set(["text", "document"]);
  if (/\b(image|imaging|visual|vision|ocr|photograph|remote sensing|cartograph)/.test(text)) modes.add("image");
  if (/\b(audio|speech|transcri|radio|sound|music|voice|acoustic)/.test(text)) modes.add("audio");
  if (/\b(video|film|footage|dailies|motion picture)/.test(text)) modes.add("video");
  if (/\b(mixed media|multimodal|cross-media)/.test(text)) modes.add("mixed");
  return [...modes];
}

function propertyRefs(value, result = new Set()) {
  if (Array.isArray(value)) for (const child of value) propertyRefs(child, result);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "ontologyPropertyRef" && typeof child === "string") result.add(child);
      propertyRefs(child, result);
    }
  }
  return [...result].sort();
}

async function assertCatalogFiles(directory, expected) {
  const actual = (await readdir(resolve(catalogRoot, directory)))
    .filter((name) => name.endsWith(".yaml") && !/ \d+\.yaml$/u.test(name))
    .sort();
  const listed = expected.map((entry) => entry.file.replace(`${directory}/`, "")).sort();
  if (JSON.stringify(actual) !== JSON.stringify(listed)) {
    throw new Error(`${directory} files do not match catalog/manifest.json`);
  }
}

await assertCatalogFiles("workflows", manifest.workflows);
await assertCatalogFiles("agents", manifest.agents);
await assertCatalogFiles("ontologies", manifest.ontologies ?? []);
await assertCatalogFiles("forms", manifest.forms ?? []);
await assertCatalogFiles("documents", manifest.documents ?? []);
await assertCatalogFiles("bundles", manifest.bundles ?? []);

const workflows = await Promise.all(
  manifest.workflows.map(async (entry) => {
    const { file, ...definition } = entry;
    const yaml = await readFile(resolve(catalogRoot, file), "utf8");
    const document = parse(yaml);
    return {
      ...definition,
      modalities: workflowModalities(document),
      yaml,
    };
  }),
);

const agents = await Promise.all(
  manifest.agents.map(async (entry) => {
    const yaml = await readFile(resolve(catalogRoot, entry.file), "utf8");
    const document = parse(yaml);
    if (document?.kind !== "AgentTemplate" || document?.metadata?.name !== entry.id) {
      throw new Error(`${entry.file} is not the expected AgentTemplate ${entry.id}`);
    }
    return {
      id: entry.id,
      path: document.spec.path,
      name: document.metadata.title,
      role: document.spec.role,
      prompt: document.spec.prompt,
      areas: document.spec.areas ?? [],
      modalities: agentModalities(document),
      usage: paletteOnlyAgents.has(entry.id) ? "palette-only" : "workflow-bound",
      skills: document.spec.capabilities?.skills ?? [],
      tools: document.spec.capabilities?.tools ?? [],
      connectors: document.spec.capabilities?.connectors ?? [],
      permissions: document.spec.capabilities?.permissions ?? ["read-only"],
    };
  }),
);

const workflowAreas = [...new Set(workflows.map((workflow) => workflow.area))];
const unknownSubjectRelations = Object.keys(subjectRelations).filter((name) => !workflowAreas.includes(name));
if (unknownSubjectRelations.length > 0) {
  throw new Error(`Subject relations reference unknown workflow areas: ${unknownSubjectRelations.join(", ")}`);
}
const subjectAreas = workflowAreas.map((name) => ({
  name,
  agentPathPrefixes: subjectRelations[name]?.agentPathPrefixes ?? [],
  agentIds: subjectRelations[name]?.agentIds ?? [],
  artifactPathPrefixes: subjectRelations[name]?.artifactPathPrefixes ?? [],
}));

const artifactGroups = [
  ["ontology", manifest.ontologies ?? []],
  ["form", manifest.forms ?? []],
  ["document", manifest.documents ?? []],
  ["workflow-bundle", manifest.bundles ?? []],
];
const artifacts = (
  await Promise.all(
    artifactGroups.flatMap(([kind, entries]) =>
      entries.map(async (entry) => ({
        ...entry,
        kind,
        yaml: await readFile(resolve(catalogRoot, entry.file), "utf8"),
      })),
    ),
  )
).sort((left, right) => left.ref.localeCompare(right.ref));

const blankWorkflow = await readFile(resolve(catalogRoot, "blank-workflow.yaml"), "utf8");
await rm(bodyRoot, { recursive: true, force: true });
const workflowIndex = await Promise.all(
  workflows.map(async (workflow) => {
    const { yaml: _yaml, ...metadata } = workflow;
    return { ...metadata, ...(await writeBody("workflows", workflow.id, workflow)) };
  }),
);
const agentIndex = await Promise.all(
  agents.map(async (agent) => {
    const { prompt: _prompt, ...metadata } = agent;
    return { ...metadata, ...(await writeBody("agents", agent.id, agent)) };
  }),
);
const artifactIndex = await Promise.all(
  artifacts.map(async (artifact) => {
    const { yaml: _yaml, ...metadata } = artifact;
    const document = artifact.kind === "workflow-bundle" ? parse(artifact.yaml) : undefined;
    const bundleSummary = document
      ? {
          workflowRef: document.spec.workflowRef,
          formCount: document.spec.forms?.length ?? 0,
          documentCount: document.spec.documents?.length ?? 0,
          bindingCount: document.spec.bindings?.length ?? 0,
          hasOntology: Boolean(document.spec.ontology),
        }
      : undefined;
    return { ...metadata, ...(bundleSummary ? { bundleSummary } : {}), ...(await writeBody("artifacts", artifact.id, artifact)) };
  }),
);
const artifactUsageIndex = artifacts.flatMap((artifact) => {
  if (artifact.kind !== "form" && artifact.kind !== "document" && artifact.kind !== "workflow-bundle") return [];
  const document = parse(artifact.yaml);
  if (artifact.kind !== "workflow-bundle") {
    return [{ id: artifact.id, kind: artifact.kind, title: artifact.title, propertyRefs: propertyRefs(document), relationshipIds: [] }];
  }
  return [
    {
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      ontologyRef: document.spec.ontology?.ref,
      workflowRef: document.spec.workflowRef,
      propertyRefs: [...new Set([...(document.spec.ontology?.selection?.propertyRefs ?? []), ...propertyRefs(document)])].sort(),
      relationshipIds: [...(document.spec.ontology?.selection?.relationshipIds ?? [])].sort(),
    },
  ];
});
const source = `// Generated by scripts/generate-catalog-index.mjs. Do not edit.\nimport type { ArtifactTemplateMetadata, ArtifactUsageMetadata, RoleTemplateMetadata, SubjectAreaDefinition, WorkflowTemplateMetadata } from "../types";\n\nexport const BLANK_WORKFLOW = ${JSON.stringify(blankWorkflow)};\n\nexport const SUBJECT_AREAS: SubjectAreaDefinition[] = ${JSON.stringify(subjectAreas, null, 2)};\n\nexport const WORKFLOW_TEMPLATES: WorkflowTemplateMetadata[] = ${JSON.stringify(workflowIndex, null, 2)};\n\nexport const ROLE_TEMPLATES: RoleTemplateMetadata[] = ${JSON.stringify(agentIndex, null, 2)};\n\nexport const ARTIFACT_INDEX: ArtifactTemplateMetadata[] = ${JSON.stringify(artifactIndex, null, 2)};\n\nexport const ARTIFACT_USAGE_INDEX: ArtifactUsageMetadata[] = ${JSON.stringify(artifactUsageIndex, null, 2)};\n`;
const artifactSource = `// Generated by scripts/generate-catalog-index.mjs. Do not edit.\nimport type { ArtifactTemplateDefinition } from "../types";\n\nexport const ARTIFACT_TEMPLATES: ArtifactTemplateDefinition[] = ${JSON.stringify(artifacts, null, 2)};\n`;
const testFixtureSource = `// Generated test fixtures. Production code must import ./catalog instead.\nimport type { ArtifactTemplateMetadata, RoleTemplate, SubjectAreaDefinition, TemplateDefinition } from "../types";\n\nexport const BLANK_WORKFLOW = ${JSON.stringify(blankWorkflow)};\n\nexport const SUBJECT_AREAS: SubjectAreaDefinition[] = ${JSON.stringify(subjectAreas, null, 2)};\n\nexport const WORKFLOW_TEMPLATES: TemplateDefinition[] = ${JSON.stringify(workflows, null, 2)};\n\nexport const ROLE_TEMPLATES: RoleTemplate[] = ${JSON.stringify(agents, null, 2)};\n\nexport const ARTIFACT_INDEX: ArtifactTemplateMetadata[] = ${JSON.stringify(artifactIndex, null, 2)};\n`;
await mkdir(resolve(root, "src/generated"), { recursive: true });
await writeFile(resolve(root, "src/generated/catalog.ts"), source);
await writeFile(resolve(root, "src/generated/artifactCatalog.ts"), artifactSource);
await writeFile(resolve(root, "src/generated/catalogTestFixtures.ts"), testFixtureSource);
console.log(
  `Generated browser index for ${workflows.length} workflows, ${agents.length} agent templates, and ${artifacts.length} bundle artifacts.`,
);
