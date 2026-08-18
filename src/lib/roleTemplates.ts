import { ROLE_TEMPLATES as CATALOG_ROLE_TEMPLATES, SUBJECT_AREAS } from "../generated/catalog";
import type { RoleTemplate } from "../types";

export type { RoleTemplate } from "../types";

export const ROLE_TEMPLATES = CATALOG_ROLE_TEMPLATES;

export function roleTemplatesForSubject(area: string): RoleTemplate[] {
  const subject = SUBJECT_AREAS.find((candidate) => candidate.name === area);
  const prefixes = (subject?.agentPathPrefixes ?? []).map((prefix) => prefix.replace(/\/+$/, ""));
  const ids = new Set(subject?.agentIds ?? []);
  return ROLE_TEMPLATES.filter(
    (template) =>
      template.areas.includes(area) ||
      ids.has(template.id) ||
      prefixes.some((prefix) => template.path === prefix || template.path.startsWith(`${prefix}/`)),
  );
}

export const RESEARCH_ROLE_SKILLS = Array.from(
  new Map(
    ROLE_TEMPLATES.filter((template) => template.path.startsWith("research/")).flatMap((template) =>
      template.skills.map((id) => [
        id,
        {
          id,
          label: id
            .split("-")
            .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
            .join(" "),
          description: `${template.name}: ${template.prompt.split(". ")[0]}.`,
        },
      ]),
    ),
  ).values(),
);
