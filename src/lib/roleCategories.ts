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
    id: "multimodal",
    label: "Multimodal",
    description: "Image, video, speech, transcription, and cross-media direction.",
    pathPrefix: "research/multimodal/",
    searchTerms: ["image", "video", "audio", "media", "speech"],
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
  {
    id: "operations",
    label: "Business operations",
    description: "Supply chain, talent, revenue, support, growth, and finance operations.",
    pathPrefix: "research/operations/",
    searchTerms: ["business", "enterprise", "supply chain", "hr", "sales", "support", "marketing", "accounting"],
  },
  {
    id: "industry",
    label: "Industry & infrastructure",
    description: "Manufacturing, energy, mobility, built environment, and agriculture.",
    pathPrefix: "research/industry/",
    searchTerms: ["manufacturing", "energy", "utilities", "transportation", "construction", "agriculture"],
  },
  {
    id: "aviation",
    label: "Aviation",
    description: "Flight dispatch, planning and fuel, performance, airspace, crew legality, and airworthiness.",
    pathPrefix: "research/aviation/",
    searchTerms: ["airline", "flight operations", "dispatch", "notam", "mel", "crew", "weather"],
  },
  {
    id: "wells",
    label: "Drilling & wells",
    description: "Well design, anti-collision, geomechanics, well control barriers, integrity, and permits.",
    pathPrefix: "research/wells/",
    searchTerms: ["oil", "gas", "drilling", "anti-collision", "well control", "barrier", "permit to work"],
  },
  {
    id: "applied-science",
    label: "Applied science",
    description: "Chemistry, biology, environment, astronomy, and geospatial analysis.",
    pathPrefix: "research/applied-science/",
    searchTerms: ["chemistry", "materials", "bioinformatics", "climate", "space", "remote sensing"],
  },
  {
    id: "visual-craft",
    label: "Visual craft",
    description: "Photography critique, editing and sequencing, grading, and delivery compliance.",
    pathPrefix: "research/visual/",
    searchTerms: ["photography", "photo", "critique", "lighting", "composition", "framing", "grading", "retouching"],
  },
  {
    id: "creative-social",
    label: "Creative & social",
    description: "Games, film and post, fashion, social policy, and linguistics.",
    pathPrefix: "research/creative/",
    searchTerms: ["games", "film", "post-production", "fashion", "policy", "language"],
  },
  {
    id: "professional-services",
    label: "Professional services",
    description: "Insurance, events and hospitality, and quality assurance and compliance.",
    pathPrefix: "research/professional/",
    searchTerms: ["insurance", "underwriting", "events", "hospitality", "compliance", "audit"],
  },
  {
    id: "emerging",
    label: "Emerging",
    description: "Robotics and embodied AI, scholarly publishing, and crisis management.",
    pathPrefix: "research/emerging/",
    searchTerms: ["robotics", "peer review", "publishing", "crisis", "emergency"],
  },
];

export function groupRoleTemplates(roles: RoleTemplate[], query = ""): RoleCategoryGroup[] {
  const normalizedQuery = query.trim().toLowerCase();
  const fixedGroups = ROLE_CATEGORIES.map((category) => {
    const categorySearchText = `${category.label} ${category.description} ${category.searchTerms.join(" ")}`.toLowerCase();
    const categoryMatches = Boolean(normalizedQuery && categorySearchText.includes(normalizedQuery));
    const categoryRoles = roles.filter((role) => {
      if (!role.path.startsWith(category.pathPrefix)) return false;
      if (!normalizedQuery || categoryMatches) return true;

      return `${role.name} ${role.role} ${role.path} ${role.skills.join(" ")}`.toLowerCase().includes(normalizedQuery);
    });

    return { ...category, roles: categoryRoles };
  }).filter((category) => category.roles.length > 0);
  const categorized = new Set(
    roles.filter((role) => ROLE_CATEGORIES.some((category) => role.path.startsWith(category.pathPrefix))).map((role) => role.id),
  );
  const dynamicGroups = new Map<string, RoleTemplate[]>();

  for (const role of roles) {
    if (categorized.has(role.id)) continue;
    const label = role.areas[0] ?? "Other";
    const haystack = `${label} ${role.name} ${role.role} ${role.path} ${role.skills.join(" ")}`.toLowerCase();
    if (normalizedQuery && !haystack.includes(normalizedQuery)) continue;
    dynamicGroups.set(label, [...(dynamicGroups.get(label) ?? []), role]);
  }

  return [
    ...fixedGroups,
    ...[...dynamicGroups].map(([label, categoryRoles]) => ({
      id: label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
      label,
      description: `${label} specialist agent templates.`,
      pathPrefix: "",
      searchTerms: [],
      roles: categoryRoles,
    })),
  ];
}

export function roleSubcategory(role: RoleTemplate): string {
  const segment = role.path.split("/").at(-1) ?? role.path;
  return segment
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
