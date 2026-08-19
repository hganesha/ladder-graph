import { ROLE_TEMPLATES, WORKFLOW_TEMPLATES } from "../generated/catalog";
import type { RoleTemplateMetadata, WorkflowTemplateMetadata } from "../types";

const SUBJECTS = new Set(["Mathematics", "Music", "Physics"]);
const PATH_PREFIXES = ["research/mathematics/", "research/music/", "research/physics/"];

/** Compatibility view for consumers of the original subject-specific importer. */
export const MATH_MUSIC_PHYSICS_ROLES: RoleTemplateMetadata[] = ROLE_TEMPLATES.filter((role) =>
  PATH_PREFIXES.some((prefix) => role.path.startsWith(prefix)),
);

/** Compatibility view backed by the canonical generated workflow catalog. */
export const MATH_MUSIC_PHYSICS_WORKFLOW_TEMPLATES: WorkflowTemplateMetadata[] = WORKFLOW_TEMPLATES.filter((workflow) =>
  SUBJECTS.has(workflow.area),
);
