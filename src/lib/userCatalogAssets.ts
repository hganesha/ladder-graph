import { parse } from "yaml";
import { SUBJECT_AREAS } from "../generated/catalog";
import type { InputModality, ProjectRecord, RoleTemplate, TemplateDefinition } from "../types";
import type { UserTemplateRecord } from "./persistence";
import { WORKFLOW_TEMPLATES } from "./templates";

export const USER_ASSETS_SUBJECT = "Your assets";

export type UserWorkflowTemplate = TemplateDefinition & {
  userProject?: ProjectRecord;
  userRecord?: UserTemplateRecord;
};
export type UserAgentTemplate = RoleTemplate & { userRecord: UserTemplateRecord };

const INPUT_MODALITIES = new Set<InputModality>(["text", "image", "audio", "video", "document", "mixed"]);

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function modalities(value: unknown, fallback: InputModality[] = ["text"]): InputModality[] {
  const valid = strings(value).filter((item): item is InputModality => INPUT_MODALITIES.has(item as InputModality));
  return valid.length > 0 ? valid : fallback;
}

function pathMatchesPrefix(path: string, prefix: string): boolean {
  const normalizedPrefix = prefix.replace(/\/+$/, "");
  return path === normalizedPrefix || path.startsWith(`${normalizedPrefix}/`);
}

function declaredSubject(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && SUBJECT_AREAS.some((subject) => subject.name === value));
}

export function subjectForUserPath(path: string): string {
  const workflowMatch = WORKFLOW_TEMPLATES.filter((template) => pathMatchesPrefix(path, template.path)).sort(
    (left, right) => right.path.length - left.path.length,
  )[0];
  if (workflowMatch) return workflowMatch.area;

  return (
    SUBJECT_AREAS.flatMap((subject) =>
      subject.agentPathPrefixes.map((prefix) => ({ name: subject.name, prefix: prefix.replace(/\/+$/, "") })),
    )
      .filter(({ prefix }) => pathMatchesPrefix(path, prefix))
      .sort((left, right) => right.prefix.length - left.prefix.length)[0]?.name ?? USER_ASSETS_SUBJECT
  );
}

export function userWorkflowTemplate(recordValue: UserTemplateRecord): UserWorkflowTemplate | undefined {
  if (recordValue.kind === "agent-template") return undefined;
  try {
    const source = record(parse(recordValue.yaml));
    if (source?.kind !== "Workflow") return undefined;
    const metadata = record(source.metadata);
    const spec = record(source.spec);
    const nodes = Array.isArray(spec?.nodes) ? spec.nodes.map(record).filter(Boolean) : [];
    const inputModalities = nodes.flatMap((node) => {
      const inputSchema = record(node?.inputSchema);
      return modalities(inputSchema?.["x-ladder-input-mode"], []);
    });
    const area =
      declaredSubject(metadata?.subjectArea, metadata?.area, spec?.subjectArea, spec?.area) ?? subjectForUserPath(recordValue.path);
    const title = typeof metadata?.title === "string" ? metadata.title : recordValue.title;
    const description = typeof metadata?.description === "string" ? metadata.description : "A reusable workflow saved in this browser.";

    return {
      id: recordValue.id,
      path: recordValue.path,
      area,
      title,
      eyebrow: "Your workflow",
      description,
      topology: `${nodes.length} ${nodes.length === 1 ? "node" : "nodes"}`,
      accent: WORKFLOW_TEMPLATES.find((template) => template.area === area)?.accent ?? "#f2b84b",
      modalities: inputModalities.length > 0 ? [...new Set(inputModalities)] : ["text"],
      yaml: recordValue.yaml,
      userRecord: recordValue,
    };
  } catch {
    return undefined;
  }
}

export function userProjectWorkflow(project: ProjectRecord): UserWorkflowTemplate | undefined {
  if ((project.artifactKind ?? "workflow") !== "workflow") return undefined;
  const template = userWorkflowTemplate({
    id: project.id,
    kind: "workflow",
    path: `user/${project.id}`,
    title: project.name,
    yaml: project.lastValidYaml,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
  if (!template) return undefined;
  return { ...template, eyebrow: "Your project", userProject: project, userRecord: undefined };
}

export function userAgentTemplate(recordValue: UserTemplateRecord): UserAgentTemplate | undefined {
  if (recordValue.kind !== "agent-template") return undefined;
  try {
    const source = record(parse(recordValue.yaml));
    if (source?.kind !== "AgentTemplate") return undefined;
    const metadata = record(source.metadata);
    const spec = record(source.spec);
    const capabilities = record(spec?.capabilities);
    if (!spec || typeof spec.role !== "string" || typeof spec.prompt !== "string") return undefined;

    const path = typeof spec.path === "string" ? spec.path : recordValue.path;
    const areas = strings(spec.areas).filter((area) => SUBJECT_AREAS.some((subject) => subject.name === area));
    return {
      id: recordValue.id,
      path,
      name: typeof metadata?.title === "string" ? metadata.title : recordValue.title,
      role: spec.role,
      prompt: spec.prompt,
      areas: areas.length > 0 ? areas : [subjectForUserPath(path)],
      modalities: modalities(spec.modalities),
      usage: "palette-only",
      skills: strings(capabilities?.skills),
      tools: strings(capabilities?.tools),
      connectors: strings(capabilities?.connectors),
      permissions: strings(capabilities?.permissions),
      userRecord: recordValue,
    };
  } catch {
    return undefined;
  }
}
