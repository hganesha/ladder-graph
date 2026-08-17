import { parse } from "yaml";
import { ARTIFACT_TEMPLATES, WORKFLOW_TEMPLATES } from "../generated/catalog";
import type {
  ArtifactTemplateDefinition,
  BundleBinding,
  FormRole,
  LadderArtifact,
  ResolvedBundleAsset,
  TemplateDefinition,
  Workflow,
  WorkflowBundle,
} from "../types";

export interface BundleAssetOption {
  ref: string;
  kind: "workflow" | "ontology" | "form" | "document";
  title: string;
  description: string;
  source: string;
}

export interface BindingPathOption {
  path: string;
  label: string;
}

export const workflowRef = (id: string) => `ladder://workflows/builtin/${id}`;

export const WORKFLOW_ASSET_OPTIONS: BundleAssetOption[] = WORKFLOW_TEMPLATES.map((template) => ({
  ref: workflowRef(template.id),
  kind: "workflow",
  title: template.title,
  description: template.description,
  source: template.yaml,
}));

export const ARTIFACT_ASSET_OPTIONS: BundleAssetOption[] = ARTIFACT_TEMPLATES.flatMap((template) =>
  template.kind === "workflow-bundle"
    ? []
    : [
        {
          ref: template.ref,
          kind: template.kind,
          title: template.title,
          description: template.description,
          source: template.yaml,
        },
      ],
);

const ASSET_BY_REF = new Map([...WORKFLOW_ASSET_OPTIONS, ...ARTIFACT_ASSET_OPTIONS].map((asset) => [asset.ref, asset]));

function cloneBundle(bundle: WorkflowBundle): WorkflowBundle {
  return structuredClone(bundle);
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}

export function createBundleForWorkflow(workflow: TemplateDefinition): WorkflowBundle {
  return {
    apiVersion: "ladder.dev/v1alpha1",
    kind: "WorkflowBundle",
    metadata: {
      name: `${slug(workflow.id)}-bundle`,
      title: `${workflow.title} bundle`,
      description: `Portable assets and explicit bindings for ${workflow.title}.`,
      version: "1.0.0",
    },
    spec: {
      workflowRef: workflowRef(workflow.id),
      forms: [],
      documents: [],
      bindings: [],
    },
  };
}

export function replaceBundleWorkflow(bundle: WorkflowBundle, workflow: TemplateDefinition): WorkflowBundle {
  const next = cloneBundle(bundle);
  const previousRef = next.spec.workflowRef;
  next.metadata.name = `${slug(workflow.id)}-bundle`;
  next.metadata.title = `${workflow.title} bundle`;
  next.metadata.description = `Portable assets and explicit bindings for ${workflow.title}.`;
  next.spec.workflowRef = workflowRef(workflow.id);
  next.spec.bindings = (next.spec.bindings ?? []).filter(
    (binding) => binding.source.ref !== previousRef && binding.target.ref !== previousRef,
  );
  return next;
}

export function attachedBundleRefs(bundle: WorkflowBundle) {
  return [
    bundle.spec.workflowRef,
    bundle.spec.ontology?.ref,
    ...(bundle.spec.forms ?? []).map((asset) => asset.ref),
    ...(bundle.spec.documents ?? []).map((asset) => asset.ref),
  ].filter(Boolean) as string[];
}

export function resolveBundleAssets(bundle: WorkflowBundle, sourceOverrides: Record<string, string> = {}): ResolvedBundleAsset[] {
  return [...new Set(attachedBundleRefs(bundle))].flatMap((ref) => {
    const source = sourceOverrides[ref] ?? ASSET_BY_REF.get(ref)?.source;
    return source ? [{ ref, source }] : [];
  });
}

export function bundleAsset(ref: string) {
  return ASSET_BY_REF.get(ref);
}

export function bundleAssetSource(ref: string, sourceOverrides: Record<string, string> = {}) {
  return sourceOverrides[ref] ?? ASSET_BY_REF.get(ref)?.source;
}

export function attachBundleArtifact(bundle: WorkflowBundle, template: ArtifactTemplateDefinition): WorkflowBundle {
  const next = cloneBundle(bundle);
  if (template.kind === "ontology") {
    next.spec.ontology = { ref: template.ref, mode: "sliver", selection: { typeIds: [], propertyRefs: [], relationshipIds: [] } };
  } else if (template.kind === "form") {
    if (!(next.spec.forms ?? []).some((asset) => asset.ref === template.ref)) {
      let role: FormRole = "start";
      try {
        const form = parse(template.yaml) as { spec?: { role?: FormRole } };
        role = form.spec?.role ?? role;
      } catch {
        // The compiler will surface malformed catalog content; attachment remains deterministic.
      }
      next.spec.forms = [...(next.spec.forms ?? []), { ref: template.ref, role }];
    }
  } else if (template.kind === "document") {
    if (!(next.spec.documents ?? []).some((asset) => asset.ref === template.ref)) {
      next.spec.documents = [...(next.spec.documents ?? []), { ref: template.ref, role: "supporting" }];
    }
  }
  return next;
}

export function detachBundleArtifact(bundle: WorkflowBundle, ref: string): WorkflowBundle {
  const next = cloneBundle(bundle);
  if (next.spec.ontology?.ref === ref) {
    delete next.spec.ontology;
    next.spec.bindings = (next.spec.bindings ?? []).map(({ ontologyPropertyRef: _property, ...binding }) => binding);
  }
  next.spec.forms = (next.spec.forms ?? []).filter((asset) => asset.ref !== ref);
  next.spec.documents = (next.spec.documents ?? []).filter((asset) => asset.ref !== ref);
  next.spec.bindings = (next.spec.bindings ?? []).filter((binding) => binding.source.ref !== ref && binding.target.ref !== ref);
  return next;
}

function parsedSource(source: string): LadderArtifact | Workflow | null {
  try {
    return parse(source) as LadderArtifact | Workflow;
  } catch {
    return null;
  }
}

function collectSchemaPaths(schema: unknown, base: string, label: string, output: BindingPathOption[]) {
  if (!schema || typeof schema !== "object") return;
  output.push({ path: base, label });
  const properties = (schema as { properties?: Record<string, unknown> }).properties;
  if (!properties) return;
  for (const [name, value] of Object.entries(properties)) {
    collectSchemaPaths(value, `${base}/properties/${name}`, `${label} · ${name}`, output);
  }
}

export function bindingPathOptions(source: string | undefined): BindingPathOption[] {
  if (!source) return [{ path: "/spec", label: "Artifact specification" }];
  const artifact = parsedSource(source);
  if (!artifact) return [{ path: "/spec", label: "Artifact specification" }];
  const options: BindingPathOption[] = [{ path: "/spec", label: "Artifact specification" }];
  if (artifact.kind === "Workflow") {
    artifact.spec.nodes.forEach((node, index) => {
      const nodePath = `/spec/nodes/${index}`;
      options.push({ path: nodePath, label: node.name });
      collectSchemaPaths(node.inputSchema, `${nodePath}/inputSchema`, `${node.name} · input`, options);
      collectSchemaPaths(node.outputSchema, `${nodePath}/outputSchema`, `${node.name} · output`, options);
    });
  } else if (artifact.kind === "Form") {
    artifact.spec.pages.forEach((page, pageIndex) => {
      page.sections.forEach((section, sectionIndex) => {
        section.fields.forEach((field, fieldIndex) => {
          options.push({
            path: `/spec/pages/${pageIndex}/sections/${sectionIndex}/fields/${fieldIndex}`,
            label: `${page.title} · ${section.title} · ${field.label}`,
          });
        });
      });
    });
  } else if (artifact.kind === "Document") {
    artifact.spec.fields.forEach((field, index) => {
      options.push({ path: `/spec/fields/${index}`, label: field.label });
    });
  } else if (artifact.kind === "Ontology") {
    artifact.spec.types.forEach((type, typeIndex) => {
      options.push({ path: `/spec/types/${typeIndex}`, label: type.label });
      type.properties.forEach((property, propertyIndex) => {
        options.push({
          path: `/spec/types/${typeIndex}/properties/${propertyIndex}`,
          label: `${type.label} · ${property.label}`,
        });
      });
    });
  }
  return options;
}

export function ontologyPropertyOptions(source: string | undefined) {
  const artifact = source ? parsedSource(source) : null;
  if (artifact?.kind !== "Ontology") return [];
  return artifact.spec.types.flatMap((type) =>
    type.properties.map((property) => ({ id: property.id, label: `${type.label} · ${property.label}` })),
  );
}

export function nextBinding(bundle: WorkflowBundle, sources: Record<string, string>): BundleBinding | null {
  const refs = attachedBundleRefs(bundle);
  if (refs.length < 2) return null;
  const sourceRef =
    refs.find((ref) => {
      const kind = bundleAsset(ref)?.kind;
      return kind === "form" || kind === "document";
    }) ??
    refs.find((ref) => ref !== bundle.spec.workflowRef) ??
    refs[0];
  const targetRef = sourceRef === bundle.spec.workflowRef ? refs[1] : bundle.spec.workflowRef;
  const sourcePath = bindingPathOptions(sources[sourceRef])[0]?.path ?? "/spec";
  const targetPath = bindingPathOptions(sources[targetRef])[0]?.path ?? "/spec";
  const used = new Set((bundle.spec.bindings ?? []).map((binding) => binding.id));
  let sequence = used.size + 1;
  while (used.has(`binding-${sequence}`)) sequence += 1;
  return {
    id: `binding-${sequence}`,
    description: "Connect an attached asset to the workflow contract.",
    source: { ref: sourceRef, path: sourcePath },
    target: { ref: targetRef, path: targetPath },
    direction: "input",
  };
}
