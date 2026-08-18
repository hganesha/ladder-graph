import { ARTIFACT_TEMPLATES, ROLE_TEMPLATES, WORKFLOW_TEMPLATES } from "../generated/catalog";
import type { InputModality } from "../types";

export type CatalogSearchKind = "subject" | "workflow" | "agent" | "form" | "document";
export type CatalogSearchAction = "browse-subject" | "open-workflow" | "create-with-agent" | "open-form" | "inspect-document";

export interface CatalogSearchSubject {
  name: string;
  description: string;
}

export interface CatalogSearchEntry {
  key: string;
  id: string;
  kind: CatalogSearchKind;
  title: string;
  description: string;
  subjectAreas: string[];
  modalities: InputModality[];
  eyebrow?: string;
  detail?: string;
  tags: string[];
  action: CatalogSearchAction;
  primaryText: string;
  secondaryText: string;
  aliases: string[];
}

export interface CatalogSearchMatch extends CatalogSearchEntry {
  score: number;
  reason: string;
}

export interface CatalogSearchFilters {
  kinds?: CatalogSearchKind[];
  subjectArea?: string;
  modality?: "all" | InputModality;
}

export interface CatalogSearchResponse {
  query: string;
  total: number;
  groups: Record<CatalogSearchKind, CatalogSearchMatch[]>;
  counts: Record<CatalogSearchKind, number>;
  subjectAreas: string[];
  didUseTypoRecovery: boolean;
}

export const CATALOG_SEARCH_KIND_ORDER: CatalogSearchKind[] = ["subject", "workflow", "agent", "form", "document"];

export const CATALOG_SEARCH_KIND_LABELS: Record<CatalogSearchKind, string> = {
  subject: "Subject areas",
  workflow: "Workflows",
  agent: "Agents",
  form: "Forms",
  document: "Documents",
};

const ARTIFACT_INDUSTRY_TO_SUBJECT: Record<string, string> = {
  energy: "Energy & utilities",
  fs: "Finance & risk",
  healthcare: "Clinical & health sciences",
  insurance: "Insurance & underwriting",
  legal: "Legal & contracts",
  manufacturing: "Manufacturing & industrial operations",
  real_estate: "Real estate & construction",
};

const SUBJECT_ALIASES: Record<string, string[]> = {
  "Product design": ["ux", "user experience", "usability", "accessibility"],
  "HR & talent operations": ["hr", "human resources", "hiring", "recruiting"],
  "DevOps & site reliability": ["sre", "site reliability", "incident response"],
  "Quality assurance & compliance": ["qa", "quality", "testing", "audit"],
  "Insurance & underwriting": ["claims", "claim", "loss notice", "policy"],
  "Legal & contracts": ["contract", "agreement", "regulatory", "legal document"],
  "Clinical & health sciences": ["healthcare", "clinical", "medical", "patient"],
  "Finance & risk": ["financial services", "credit", "lending", "kyc"],
};

const QUERY_ALIASES: Record<string, string[]> = {
  ux: ["user experience", "product design", "usability"],
  hr: ["human resources", "talent", "hiring"],
  sre: ["site reliability", "incident", "reliability"],
  qa: ["quality assurance", "testing", "quality"],
  claims: ["claim", "insurance"],
  claim: ["claims", "insurance"],
  contract: ["agreement", "document", "legal"],
  intake: ["start form", "submission form", "input"],
  approval: ["decision form", "review gate", "approve"],
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[_/&+—–-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalize(value).split(" ").filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

function titleCasePathPart(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function artifactSubject(path: string) {
  const industry = path.split("/")[0];
  return ARTIFACT_INDUSTRY_TO_SUBJECT[industry] ?? titleCasePathPart(industry);
}

function yamlTerms(yaml: string) {
  const values: string[] = [];
  for (const line of yaml.split("\n")) {
    const match = line.match(/^\s+(?:label|title|documentType|role|name):\s+(.+)$/);
    if (!match) continue;
    values.push(match[1].replace(/^['"]|['"]$/g, ""));
    if (values.length >= 80) break;
  }
  return values;
}

function countYamlItems(yaml: string, marker: "fields" | "validationRules") {
  const markerIndex = yaml.indexOf(`\n  ${marker}:`);
  if (markerIndex < 0) return 0;
  const tail = yaml.slice(markerIndex + marker.length + 4);
  const nextSection = tail.search(/\n  [a-zA-Z]/);
  const section = nextSection >= 0 ? tail.slice(0, nextSection) : tail;
  return (section.match(/\n    - id:/g) ?? []).length;
}

export function createCatalogSearchIndex(subjects: CatalogSearchSubject[]): CatalogSearchEntry[] {
  const entries: CatalogSearchEntry[] = subjects.map((subject) => ({
    key: `subject:${normalize(subject.name).replaceAll(" ", "-")}`,
    id: subject.name,
    kind: "subject",
    title: subject.name,
    description: subject.description,
    subjectAreas: [subject.name],
    modalities: [],
    detail: `${WORKFLOW_TEMPLATES.filter((workflow) => workflow.area === subject.name).length} workflows · ${ROLE_TEMPLATES.filter((agent) => agent.areas.includes(subject.name)).length} agents`,
    tags: SUBJECT_ALIASES[subject.name] ?? [],
    action: "browse-subject",
    primaryText: subject.name,
    secondaryText: subject.description,
    aliases: SUBJECT_ALIASES[subject.name] ?? [],
  }));

  for (const workflow of WORKFLOW_TEMPLATES) {
    entries.push({
      key: `workflow:${workflow.id}`,
      id: workflow.id,
      kind: "workflow",
      title: workflow.title,
      description: workflow.description,
      subjectAreas: [workflow.area],
      modalities: workflow.modalities,
      eyebrow: workflow.eyebrow,
      detail: workflow.topology,
      tags: workflow.modalities,
      action: "open-workflow",
      primaryText: `${workflow.title} ${workflow.area} ${workflow.eyebrow}`,
      secondaryText: `${workflow.description} ${workflow.topology} ${workflow.path} ${yamlTerms(workflow.yaml).join(" ")}`,
      aliases: [],
    });
  }

  for (const agent of ROLE_TEMPLATES) {
    entries.push({
      key: `agent:${agent.id}`,
      id: agent.id,
      kind: "agent",
      title: agent.name,
      description: agent.role,
      subjectAreas: agent.areas,
      modalities: agent.modalities,
      eyebrow: titleCasePathPart(agent.path.split("/").at(-1) ?? "Agent template"),
      detail: `${agent.skills.length} skills`,
      tags: agent.skills.slice(0, 3),
      action: "create-with-agent",
      primaryText: `${agent.name} ${agent.role} ${agent.areas.join(" ")}`,
      secondaryText: `${agent.prompt} ${agent.skills.join(" ")} ${agent.path} ${agent.modalities.join(" ")}`,
      aliases: [],
    });
  }

  for (const artifact of ARTIFACT_TEMPLATES) {
    if (artifact.kind !== "form" && artifact.kind !== "document") continue;
    const subjectArea = artifactSubject(artifact.path);
    const fieldCount = countYamlItems(artifact.yaml, "fields");
    const validationCount = artifact.kind === "document" ? countYamlItems(artifact.yaml, "validationRules") : 0;
    entries.push({
      key: `${artifact.kind}:${artifact.id}`,
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      description: artifact.description,
      subjectAreas: [subjectArea],
      modalities: [],
      eyebrow: artifact.kind === "form" ? "Portable form" : "Document contract",
      detail:
        artifact.kind === "form"
          ? `${fieldCount || "Structured"} ${fieldCount === 1 ? "field" : "fields"}`
          : `${fieldCount || "Structured"} fields${validationCount ? ` · ${validationCount} rules` : ""}`,
      tags: [titleCasePathPart(artifact.path.split("/")[0])],
      action: artifact.kind === "form" ? "open-form" : "inspect-document",
      primaryText: `${artifact.title} ${subjectArea} ${artifact.path}`,
      secondaryText: `${artifact.description} ${yamlTerms(artifact.yaml).join(" ")}`,
      aliases: [],
    });
  }

  return entries;
}

function levenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function termScore(entry: CatalogSearchEntry, queryTerm: string, allowTypo: boolean) {
  const normalizedTitle = normalize(entry.title);
  const primary = normalize(entry.primaryText);
  const secondary = normalize(entry.secondaryText);
  const titleTokens = tokens(entry.title);
  const primaryTokens = tokens(entry.primaryText);
  const secondaryTokens = tokens(entry.secondaryText);
  const aliases = entry.aliases.flatMap(tokens);

  if (normalizedTitle === queryTerm) return { score: 1000, reason: "Exact title match" };
  if (normalizedTitle.startsWith(queryTerm)) return { score: 850, reason: `Title begins with “${queryTerm}”` };
  if (titleTokens.some((token) => token.startsWith(queryTerm))) return { score: 700, reason: `Title match: “${queryTerm}”` };
  if (aliases.some((token) => token.startsWith(queryTerm))) return { score: 580, reason: `Matches alias “${queryTerm}”` };
  if (primaryTokens.some((token) => token.startsWith(queryTerm)) || primary.includes(queryTerm)) {
    return { score: 430, reason: `Catalog match: “${queryTerm}”` };
  }
  if (secondaryTokens.some((token) => token.startsWith(queryTerm))) return { score: 240, reason: `Metadata match: “${queryTerm}”` };

  for (const alias of QUERY_ALIASES[queryTerm] ?? []) {
    const expanded = normalize(alias);
    if (primary.includes(expanded) || secondary.includes(expanded)) return { score: 190, reason: `Related to “${queryTerm}”` };
  }

  if (allowTypo) {
    const maxDistance = queryTerm.length >= 8 ? 2 : 1;
    const candidate = [...titleTokens, ...primaryTokens, ...aliases].find((token) => levenshtein(queryTerm, token) <= maxDistance);
    if (candidate) return { score: 90, reason: `Similar to “${candidate}”` };
  }
  return null;
}

function scoreEntry(entry: CatalogSearchEntry, query: string, allowTypo: boolean) {
  const normalizedQuery = normalize(query);
  const queryTerms = tokens(normalizedQuery);
  const normalizedTitle = normalize(entry.title);
  let score = normalizedTitle === normalizedQuery ? 2500 : normalizedTitle.startsWith(normalizedQuery) ? 1200 : 0;
  let reason = score ? (normalizedTitle === normalizedQuery ? "Exact title match" : `Title begins with “${normalizedQuery}”`) : "";

  for (const queryTerm of queryTerms) {
    const termMatch = termScore(entry, queryTerm, allowTypo);
    if (!termMatch) return null;
    score += termMatch.score;
    if (!reason || termMatch.score > 430) reason = termMatch.reason;
  }

  return { score, reason };
}

function emptyGroups(): Record<CatalogSearchKind, CatalogSearchMatch[]> {
  return { subject: [], workflow: [], agent: [], form: [], document: [] };
}

export function searchCatalog(
  index: CatalogSearchEntry[],
  query: string,
  filters: CatalogSearchFilters = {},
): CatalogSearchResponse {
  const normalizedQuery = normalize(query);
  const groups = emptyGroups();
  const selectedKinds = new Set(filters.kinds ?? []);
  const baseCandidates = index.filter((entry) => {
    if (selectedKinds.size && !selectedKinds.has(entry.kind)) return false;
    if (filters.subjectArea && !entry.subjectAreas.includes(filters.subjectArea) && entry.kind !== "subject") return false;
    if (filters.modality && filters.modality !== "all" && !entry.modalities.includes(filters.modality)) return false;
    return true;
  });

  const exactMatches = normalizedQuery.length >= 2
    ? baseCandidates.flatMap((entry) => {
        const scored = scoreEntry(entry, normalizedQuery, false);
        return scored ? [{ ...entry, ...scored }] : [];
      })
    : [];
  const allowTypo = exactMatches.length < 3 && tokens(normalizedQuery).every((term) => term.length >= 4);
  const matches = allowTypo
    ? baseCandidates.flatMap((entry) => {
        const scored = scoreEntry(entry, normalizedQuery, true);
        return scored ? [{ ...entry, ...scored }] : [];
      })
    : exactMatches;

  for (const match of matches) groups[match.kind].push(match);
  for (const kind of CATALOG_SEARCH_KIND_ORDER) {
    groups[kind].sort((left, right) => right.score - left.score || left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
  }

  const counts = Object.fromEntries(CATALOG_SEARCH_KIND_ORDER.map((kind) => [kind, groups[kind].length])) as Record<
    CatalogSearchKind,
    number
  >;
  const subjectAreas = [...new Set(matches.flatMap((entry) => entry.subjectAreas))].sort((left, right) => left.localeCompare(right));
  return {
    query: normalizedQuery,
    total: matches.length,
    groups,
    counts,
    subjectAreas,
    didUseTypoRecovery: allowTypo && matches.some((match) => match.reason.startsWith("Similar")),
  };
}
