import { ICON_ALIASES, ICON_NAMES } from "../generated/iconRegistry";
import type { IconRef, LgirNode, OntologyType } from "../types";

export type IconResolutionSource = "explicit" | "semantic" | "fallback";

export interface ResolvedNodeIcon {
  name: string;
  source: IconResolutionSource;
  invalidOverride?: string;
}

const CATALOG_NAMES = new Set<string>(ICON_NAMES);
const ALIASES: Readonly<Record<string, string>> = ICON_ALIASES;

function canonicalName(icon: IconRef | undefined) {
  if (icon?.set !== "lucide") return undefined;
  const name = ALIASES[icon.name] ?? icon.name;
  return CATALOG_NAMES.has(name) ? name : undefined;
}

export function resolveCatalogIcon(icon: IconRef | undefined) {
  return canonicalName(icon);
}

function tokens(...values: Array<string | string[] | undefined>) {
  return new Set(
    values
      .flatMap((value) => (Array.isArray(value) ? value : [value ?? ""]))
      .flatMap((value) =>
        value
          .normalize("NFKD")
          .toLowerCase()
          .split(/[^a-z0-9]+/u),
      )
      .filter(Boolean),
  );
}

function firstMatch(words: Set<string>, rules: ReadonlyArray<readonly [string, readonly string[]]>) {
  return rules.find(([, candidates]) => candidates.some((candidate) => words.has(candidate)))?.[0];
}

const ONTOLOGY_RULES = [
  ["user", ["person", "patient", "claimant", "customer", "employee", "provider", "insured"]],
  ["building", ["organization", "organisation", "company", "business", "employer", "carrier", "payer"]],
  ["calendar", ["event", "appointment", "meeting", "encounter", "occurrence"]],
  ["file-text", ["document", "record", "report", "article", "notice"]],
  ["map-pin", ["location", "place", "address", "site", "region"]],
  ["ruler", ["measure", "measurement", "metric", "dimension"]],
  ["database", ["database", "dataset", "warehouse", "repository"]],
  ["scroll-text", ["policy", "contract", "agreement", "law", "regulation"]],
  ["package", ["asset", "product", "inventory", "item"]],
  ["file-check", ["claim", "case", "application", "request"]],
  ["wallet-cards", ["account", "wallet", "portfolio"]],
  ["badge-dollar-sign", ["payment", "invoice", "transaction", "finance"]],
  ["house", ["property", "home", "residence"]],
  ["plane", ["flight", "aircraft", "airline"]],
  ["factory", ["factory", "plant", "manufacturer"]],
  ["pill", ["medication", "drug", "treatment"]],
] as const;

const AGENT_RULES = [
  ["search", ["research", "researcher", "investigator", "discovery"]],
  ["chart-line", ["analyst", "analytics", "metrics", "insights"]],
  ["shield-check", ["reviewer", "review", "compliance", "auditor", "safety"]],
  ["pen-line", ["writer", "editor", "author", "copywriter"]],
  ["code-xml", ["developer", "engineer", "programmer", "coding"]],
  ["graduation-cap", ["teacher", "educator", "coach", "tutor"]],
  ["scale", ["legal", "lawyer", "counsel", "attorney"]],
  ["heart-handshake", ["support", "care", "success", "service"]],
  ["database", ["data", "database", "sql", "warehouse"]],
  ["megaphone", ["marketing", "campaign", "communications", "promotion"]],
  ["badge-dollar-sign", ["finance", "financial", "accounting", "billing"]],
] as const;

function resolve(explicit: IconRef | undefined, semantic: string | undefined, fallback: string): ResolvedNodeIcon {
  const explicitName = canonicalName(explicit);
  if (explicitName) return { name: explicitName, source: "explicit" };
  if (semantic) return { name: semantic, source: "semantic", invalidOverride: explicit ? explicit.name : undefined };
  return { name: fallback, source: "fallback", invalidOverride: explicit ? explicit.name : undefined };
}

export function resolveOntologyIcon(type: Pick<OntologyType, "aliases" | "icon" | "id" | "label">): ResolvedNodeIcon {
  return resolve(type.icon, firstMatch(tokens(type.id, type.label, type.aliases), ONTOLOGY_RULES), "boxes");
}

export function resolveAgentIcon(node: Pick<LgirNode, "icon" | "name" | "role" | "summary" | "templateRef">): ResolvedNodeIcon {
  return resolve(node.icon, firstMatch(tokens(node.templateRef, node.name, node.role, node.summary), AGENT_RULES), "bot");
}
