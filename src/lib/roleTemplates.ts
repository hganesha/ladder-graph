import { ROLE_TEMPLATES } from "../generated/catalog";

export type { RoleTemplate } from "../types";
export { ROLE_TEMPLATES };

export const RESEARCH_ROLE_SKILLS = Array.from(
  new Map(
    ROLE_TEMPLATES.filter((template) => !template.path.startsWith("core/")).flatMap((template) =>
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
