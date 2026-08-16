import type { RoleTemplate } from "./roleTemplates";

export interface RoleCategory {
  id: string;
  label: string;
  description: string;
  pathPrefix: string;
  searchTerms: string[];
}

export interface RoleCategoryGroup extends RoleCategory {
  roles: RoleTemplate[];
}

export const ROLE_CATEGORIES: RoleCategory[] = [
  {
    id: "core",
    label: "Core",
    description: "General-purpose product, research, quality, and delivery agents.",
    pathPrefix: "core/",
    searchTerms: ["general", "foundation"],
  },
  {
    id: "swe",
    label: "SWE",
    description: "Software discovery, implementation, quality, maintenance, and operations.",
    pathPrefix: "research/software/",
    searchTerms: ["software", "engineering", "developer", "coding"],
  },
  {
    id: "security",
    label: "Security",
    description: "Offensive, defensive, cloud, identity, privacy, GRC, and DevSecOps.",
    pathPrefix: "research/security/",
    searchTerms: ["cybersecurity", "infosec"],
  },
  {
    id: "architecture-design",
    label: "Architecture & design",
    description: "Building design, engineering, interiors, performance, and delivery.",
    pathPrefix: "research/architecture/",
    searchTerms: ["architect", "built environment", "construction"],
  },
  {
    id: "humanities",
    label: "Humanities",
    description: "Philosophy, history, critical inquiry, and liberal arts.",
    pathPrefix: "research/humanities/",
    searchTerms: ["philosophy", "history", "liberal arts"],
  },
  {
    id: "writing",
    label: "Writing",
    description: "Drafting, editing, storytelling, and persuasive communication.",
    pathPrefix: "research/writing/",
    searchTerms: ["author", "editor", "copywriting"],
  },
  {
    id: "personal-development",
    label: "Personal development",
    description: "Goal setting, reflection, productivity, and career direction.",
    pathPrefix: "research/personal-development/",
    searchTerms: ["goals", "coaching", "career", "productivity"],
  },
  {
    id: "mathematics",
    label: "Mathematics",
    description: "Trigonometry, algebra, optimization, proof verification, and mathematical visualization.",
    pathPrefix: "research/mathematics/",
    searchTerms: ["math", "algebra", "trigonometry", "optimization", "proof"],
  },
  {
    id: "music",
    label: "Music",
    description: "Pitch, harmony, rhythm, form, recommendation, composition, lyrics, and orchestration.",
    pathPrefix: "research/music/",
    searchTerms: ["audio", "composition", "songwriting", "harmony", "recommendation"],
  },
  {
    id: "physics",
    label: "Physics",
    description: "Mechanics, electromagnetism, thermodynamics, quantum, simulation, units, and experiments.",
    pathPrefix: "research/physics/",
    searchTerms: ["science", "mechanics", "quantum", "simulation", "experimental"],
  },
];

export function groupRoleTemplates(roles: RoleTemplate[], query = ""): RoleCategoryGroup[] {
  const normalizedQuery = query.trim().toLowerCase();

  return ROLE_CATEGORIES.map((category) => {
    const categorySearchText = `${category.label} ${category.description} ${category.searchTerms.join(" ")}`.toLowerCase();
    const categoryMatches = Boolean(normalizedQuery && categorySearchText.includes(normalizedQuery));
    const categoryRoles = roles.filter((role) => {
      if (!role.path.startsWith(category.pathPrefix)) return false;
      if (!normalizedQuery || categoryMatches) return true;

      return `${role.name} ${role.role} ${role.path} ${role.skills.join(" ")}`.toLowerCase().includes(normalizedQuery);
    });

    return { ...category, roles: categoryRoles };
  }).filter((category) => category.roles.length > 0);
}

export function roleSubcategory(role: RoleTemplate): string {
  const segment = role.path.split("/").at(-1) ?? role.path;
  return segment
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
