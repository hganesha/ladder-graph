import { ROLE_TEMPLATES as CATALOG_ROLE_TEMPLATES } from "../generated/catalog";
import type { RoleTemplate } from "../types";

export type { RoleTemplate } from "../types";

export const ROLE_TEMPLATES = CATALOG_ROLE_TEMPLATES;

const SUBJECT_PATH_PREFIXES: Record<string, string[]> = {
  "Software engineering": ["research/software/"],
  Security: ["research/security/"],
  Multimodal: ["research/multimodal/"],
  "Architecture & design": ["research/architecture/"],
  Humanities: ["research/humanities/"],
  Writing: ["research/writing/"],
  "Personal development": ["research/personal-development/"],
  Mathematics: ["research/mathematics/"],
  Music: ["research/music/"],
  Physics: ["research/physics/"],
  "Supply chain & logistics": ["research/operations/supply-chain"],
  "HR & talent operations": ["research/operations/talent"],
  "Sales & business development": ["research/operations/revenue"],
  "Customer success & support": ["research/operations/support"],
  "Marketing & growth": ["research/operations/growth"],
  "Accounting, tax & audit": ["research/operations/finance-ops"],
  "Manufacturing & industrial operations": ["research/industry/manufacturing"],
  "Energy & utilities": ["research/industry/energy"],
  "Transportation & mobility": ["research/industry/mobility"],
  "Real estate & construction": ["research/industry/built-environment"],
  "Agriculture & food systems": ["research/industry/agriculture"],
  "Airline flight operations": ["research/aviation/flight-operations"],
  "Oil & gas drilling & well operations": ["research/wells/drilling"],
  "Chemistry & materials science": ["research/applied-science/chemistry"],
  "Biology & bioinformatics": ["research/applied-science/biology"],
  "Environmental & climate science": ["research/applied-science/environment"],
  "Astronomy & space": ["research/applied-science/astronomy"],
  "Geospatial & earth observation": ["research/applied-science/geospatial"],
  "Gaming & interactive media": ["research/creative/games"],
  "Film, video & post-production": ["research/creative/film"],
  "Fashion & textiles": ["research/creative/fashion"],
  "Social sciences & policy": ["research/creative/social-policy"],
  "Linguistics & language preservation": ["research/creative/linguistics"],
  "Insurance & underwriting": ["research/professional/insurance"],
  "Event planning & hospitality": ["research/professional/events"],
  "Quality assurance & compliance": ["research/professional/compliance"],
  "DevOps & site reliability": ["research/software/reliability"],
  "Robotics & embodied AI": ["research/emerging/robotics"],
  "Scientific peer review & publishing": ["research/emerging/peer-review"],
  "Crisis & emergency management": ["research/emerging/crisis"],
};

const SUBJECT_ROLE_IDS: Record<string, string[]> = {
  Research: ["core-researcher"],
  "Product management": ["core-product-manager", "dev-01"],
  "Product design": ["core-designer", "dev-07", "dev-12"],
  "Go-to-market": ["core-gtm"],
  Security: ["core-security-reviewer"],
};

export function roleTemplatesForSubject(area: string): RoleTemplate[] {
  if (area === "Core patterns") return ROLE_TEMPLATES.filter((template) => template.path.startsWith("core/"));

  const prefixes = (SUBJECT_PATH_PREFIXES[area] ?? []).map((prefix) => prefix.replace(/\/+$/, ""));
  const ids = new Set(SUBJECT_ROLE_IDS[area] ?? []);
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
