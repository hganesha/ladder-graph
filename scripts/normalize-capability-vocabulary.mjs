import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

const root = resolve(import.meta.dirname, "..");
const catalogRoot = resolve(root, "catalog");
const manifest = JSON.parse(await readFile(resolve(catalogRoot, "manifest.json"), "utf8"));
const existingVocabulary = JSON.parse(await readFile(resolve(catalogRoot, "capability-vocabulary.json"), "utf8"));
const preserved = new Set(existingVocabulary.skills);
const shared = new Set([
  "accessibility",
  "application-security",
  "data-modeling",
  "documentation",
  "evaluation",
  "implementation",
  "observability",
  "privacy-review",
  "product-design",
  "product-management",
  "release-engineering",
  "research",
  "software-architecture",
  "test-design",
]);

function canonicalSkill(skill) {
  const id = String(skill).trim().toLowerCase();
  if (preserved.has(id) || shared.has(id)) return id;
  const match = (pattern) => pattern.test(id);
  if (match(/accessib|universal-design/)) return "accessibility";
  if (match(/privacy|de-ident|phi|pii|confidential|sensitive-data/)) return "privacy-review";
  if (match(/security|threat|vulnerab|penetration|red-team|iam|identity|forensic|malware|fraud/)) return "application-security";
  if (match(/incident|crisis|emergency|containment|disaster|recovery/)) return "incident-response";
  if (match(/observab|telemetry|monitoring|alert|logging|sre|reliability/)) return "observability";
  if (match(/release|deploy|rollback|delivery|ci-cd|devops/)) return "release-engineering";
  if (match(/test|qa|quality|verification|validation|review|audit|critique|rubric|scoring|evaluation/)) return "evaluation";
  if (match(/citation|source|evidence|fact-check|provenance|triangulat|research-integrity/)) return "evidence-verification";
  if (match(/research|literature|scholarly|bibliograph|archive/)) return "research";
  if (match(/statistic|biostat|regression|probab|sample|significance|effect-size/)) return "statistical-analysis";
  if (match(/math|algebra|trig|calculus|proof|geometry|equation|numeric|quant|calculation|unit-/)) return "quantitative-analysis";
  if (match(/optimization|solver|scheduling|routing|allocation/)) return "optimization";
  if (match(/simulation|modeling|forecast|scenario|digital-twin/)) return "simulation";
  if (match(/data-quality|anomaly|drift|completeness|lineage/)) return "data-quality-analysis";
  if (match(/database|schema|semantic|data-model|etl|pipeline|warehouse|analytics|query|data-engineer/)) return "data-engineering";
  if (match(/experiment|a-b|hypothesis|causal/)) return "experiment-design";
  if (match(/image|vision|ocr|visual|photograph|render/)) return "image-understanding";
  if (match(/video|film|motion|vfx|dailies|colour/)) return "video-processing";
  if (match(/audio|music|speech|sound|voice|transcri|acoustic|rhythm|melody|harmony/)) return "audio-processing";
  if (match(/write|edit|copy|story|narrative|rhetoric|content|publication|language|translation/)) return "writing-editing";
  if (match(/teach|tutor|curricul|assessment|learning|pedagog|education|instruction/)) return "teaching";
  if (match(/product|roadmap|requirements|acceptance|user-story|market/)) return "product-management";
  if (match(/design|ux|ui|architecture|building|bim|cad|spatial|interior/)) return "design-review";
  if (match(/implement|code|software|frontend|backend|api|programming|repository/)) return "implementation";
  if (match(/contract|clause|legal|privilege|license|obligation/)) return "contract-analysis";
  if (match(/regulat|compliance|control|policy|governance|standard|certification/)) return "compliance-review";
  if (match(/risk|safety|hazard|barrier|failure|fmea|assurance/)) return "risk-analysis";
  if (match(/finance|financial|account|tax|valuation|credit|actuar|cost|budget|pricing/)) return "finance-analysis";
  if (match(/clinical|patient|diagnos|medical|pharma|gmp|gxp|trial|protocol|batch/)) return "clinical-review";
  if (match(/manufactur|industrial|process|maintenance|asset|equipment|materials/)) return "manufacturing-analysis";
  if (match(/supply|supplier|inventory|logistics|procurement|sourcing/)) return "supply-chain-analysis";
  if (match(/geo|gis|remote-sensing|cartograph|spatial|earth/)) return "geospatial-analysis";
  if (match(/physics|chem|biology|bioinform|astronomy|climate|environment|scientific|laboratory|experiment/)) return "scientific-analysis";
  if (match(/plan|project|program|workflow|coordination|handoff|capacity|operations/)) return "operations-planning";
  if (match(/communicat|stakeholder|facilitat|interview|negotiat|customer|support/)) return "communication";
  if (match(/decision|tradeoff|priorit|strategy|analysis|assessment/)) return "decision-analysis";
  return "domain-analysis";
}

function normalizeSource(source) {
  const lines = source.split("\n");
  const output = [];
  let skillIndent = null;
  let seen = new Set();

  for (const line of lines) {
    const inline = line.match(/^(\s*)skills:\s*\[(.*)]\s*$/);
    if (inline) {
      const values = inline[2].trim() ? inline[2].split(",").map((value) => value.trim().replace(/^['"]|['"]$/g, "")) : [];
      const normalized = [...new Set(values.map(canonicalSkill))];
      output.push(`${inline[1]}skills: [${normalized.join(", ")}]`);
      skillIndent = null;
      continue;
    }
    const block = line.match(/^(\s*)skills:\s*$/);
    if (block) {
      skillIndent = block[1].length;
      seen = new Set();
      output.push(line);
      continue;
    }
    if (skillIndent !== null) {
      const item = line.match(/^(\s*)-\s+([^#]+?)\s*$/);
      if (item && item[1].length > skillIndent) {
        const normalized = canonicalSkill(item[2].replace(/^['"]|['"]$/g, ""));
        if (!seen.has(normalized)) output.push(`${item[1]}- ${normalized}`);
        seen.add(normalized);
        continue;
      }
      if (line.trim() && line.search(/\S/) <= skillIndent) skillIndent = null;
    }
    output.push(line);
  }
  return output.join("\n");
}

const entries = [...manifest.workflows, ...manifest.agents];
for (const entry of entries) {
  const file = resolve(catalogRoot, entry.file);
  const source = await readFile(file, "utf8");
  const normalized = normalizeSource(source);
  if (normalized !== source) await writeFile(file, normalized);
}

const skills = new Set();
const connectors = new Set();
for (const entry of entries) {
  const document = parse(await readFile(resolve(catalogRoot, entry.file), "utf8"));
  const capabilitySets =
    document.kind === "Workflow" ? document.spec.nodes.map((node) => node.capabilities ?? {}) : [document.spec.capabilities ?? {}];
  for (const capabilities of capabilitySets) {
    for (const skill of capabilities.skills ?? []) skills.add(skill);
    for (const connector of capabilities.connectors ?? []) connectors.add(connector);
  }
}

await writeFile(
  resolve(catalogRoot, "capability-vocabulary.json"),
  `${JSON.stringify({ schemaVersion: 1, skills: [...skills].sort(), connectors: [...connectors].sort() }, null, 2)}\n`,
);
console.log(`Normalized the catalog to ${skills.size} skills and registered ${connectors.size} connectors.`);
