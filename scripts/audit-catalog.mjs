import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

const catalogRoot = resolve(import.meta.dirname, "..", "catalog");
const manifest = JSON.parse(await readFile(resolve(catalogRoot, "manifest.json"), "utf8"));
const vocabulary = JSON.parse(await readFile(resolve(catalogRoot, "capability-vocabulary.json"), "utf8"));
const agentUsage = JSON.parse(await readFile(resolve(catalogRoot, "agent-usage.json"), "utf8"));
const check = process.argv.includes("--check");
const errors = [];

async function loadEntries(kind, entries) {
  const directory = kind === "Workflow" ? "workflows" : "agents";
  const actual = (await readdir(resolve(catalogRoot, directory))).filter((name) => name.endsWith(".yaml")).sort();
  const listed = entries.map((entry) => entry.file.replace(`${directory}/`, "")).sort();
  if (JSON.stringify(actual) !== JSON.stringify(listed)) errors.push(`${directory} files do not match catalog/manifest.json`);

  return Promise.all(
    entries.map(async (entry) => {
      const document = parse(await readFile(resolve(catalogRoot, entry.file), "utf8"));
      if (document?.kind !== kind) errors.push(`${entry.file} is not a ${kind}`);
      if (kind === "AgentTemplate" && document?.metadata?.name !== entry.id)
        errors.push(`${entry.file} metadata.name does not match ${entry.id}`);
      return { entry, document };
    }),
  );
}

function frequencies(values) {
  return Object.fromEntries(
    [...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map())].sort(([a], [b]) =>
      String(a).localeCompare(String(b)),
    ),
  );
}

function uniqueIds(entries, label) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) errors.push(`Duplicate ${label} id: ${entry.id}`);
    seen.add(entry.id);
  }
}

uniqueIds(manifest.workflows, "workflow");
uniqueIds(manifest.agents, "agent");

const workflows = await loadEntries("Workflow", manifest.workflows);
const agents = await loadEntries("AgentTemplate", manifest.agents);
const nodes = workflows.flatMap(({ document }) => document?.spec?.nodes ?? []);
const roleNodes = nodes.filter((node) => ["agent", "evaluate", "teacher"].includes(node.kind));
const agentPrompts = new Map();
for (const { entry, document } of agents) {
  const prompt = document?.spec?.prompt;
  if (!prompt) continue;
  const matches = agentPrompts.get(prompt) ?? [];
  matches.push(entry.id);
  agentPrompts.set(prompt, matches);
}

const workflowModalities = workflows.map(({ document }) => {
  const modes = [
    ...new Set(
      (document?.spec?.nodes ?? [])
        .filter((node) => node.kind === "input")
        .map((node) => node.inputSchema?.["x-ladder-input-mode"] ?? "unset"),
    ),
  ];
  return modes.length === 1 ? modes[0] : modes.sort().join("+");
});

const allCapabilities = [
  ...nodes.map((node) => node.capabilities ?? {}),
  ...agents.map(({ document }) => document?.spec?.capabilities ?? {}),
];
const skills = allCapabilities.flatMap((capabilities) => capabilities.skills ?? []);
const connectors = allCapabilities.flatMap((capabilities) => capabilities.connectors ?? []);
const skillFrequency = frequencies(skills);
const connectorFrequency = frequencies(connectors);
const boundAgentIds = new Set(
  roleNodes.flatMap((node) =>
    node.templateRef ? [node.templateRef] : (agentPrompts.get(node.prompt) ?? []).length === 1 ? agentPrompts.get(node.prompt) : [],
  ),
);
const agentIds = new Set(agents.map(({ entry }) => entry.id));
for (const node of roleNodes) {
  if (node.templateRef && !agentIds.has(node.templateRef)) errors.push(`Unknown templateRef ${node.templateRef} on node ${node.id}`);
}
for (const node of roleNodes) {
  if (!node.templateRef && !node.inlineRole) errors.push(`Role node ${node.id} is neither template-backed nor intentionally inline`);
}
const paletteOnlyAgents = new Set(agentUsage.paletteOnly);
for (const id of paletteOnlyAgents) {
  if (!agentIds.has(id)) errors.push(`agent-usage.json contains unknown agent ${id}`);
  if (boundAgentIds.has(id)) errors.push(`Workflow-bound agent ${id} is incorrectly marked palette-only`);
}
for (const id of agentIds) {
  if (!boundAgentIds.has(id) && !paletteOnlyAgents.has(id)) errors.push(`Dormant agent ${id} is not marked palette-only`);
}
const governedSkills = new Set(vocabulary.skills);
const governedConnectors = new Set(vocabulary.connectors);
for (const { entry, document } of agents) {
  for (const skill of document.spec.capabilities?.skills ?? []) {
    if (!governedSkills.has(skill)) errors.push(`${entry.file} uses unregistered governed skill ${skill}`);
  }
  for (const connector of document.spec.capabilities?.connectors ?? []) {
    if (!governedConnectors.has(connector)) errors.push(`${entry.file} uses unregistered governed connector ${connector}`);
  }
}
for (const { entry, document } of workflows) {
  for (const node of document.spec.nodes) {
    for (const skill of node.capabilities?.skills ?? []) {
      if (!governedSkills.has(skill)) errors.push(`${entry.file}:${node.id} uses unregistered governed skill ${skill}`);
    }
    for (const connector of node.capabilities?.connectors ?? []) {
      if (!governedConnectors.has(connector)) errors.push(`${entry.file}:${node.id} uses unregistered governed connector ${connector}`);
    }
  }
}

const report = {
  workflows: workflows.length,
  agents: agents.length,
  areas: new Set(manifest.workflows.map((entry) => entry.area)).size,
  nodes: nodes.length,
  modalities: frequencies(workflowModalities),
  nodeKinds: frequencies(nodes.map((node) => node.kind)),
  roleBinding: {
    structural: roleNodes.filter((node) => node.templateRef).length,
    intentionallyInline: roleNodes.filter((node) => node.inlineRole).length,
    unclassified: roleNodes.filter((node) => !node.templateRef && !node.inlineRole).length,
    boundAgentTemplates: boundAgentIds.size,
    paletteOnlyAgentTemplates: paletteOnlyAgents.size,
  },
  configurationCoverage: {
    customizationNodes: nodes.filter((node) => Object.keys(node.capabilities?.customizations ?? {}).length > 0).length,
    workingDirectoryNodes: nodes.filter((node) => node.config?.workingDirectory?.trim()).length,
    loopExhaustion: frequencies(nodes.filter((node) => node.kind === "loop").map((node) => node.config?.onExhausted ?? "unset")),
    joins: frequencies(nodes.filter((node) => node.kind === "join").map((node) => node.config?.join ?? "unset")),
  },
  vocabulary: {
    distinctSkills: Object.keys(skillFrequency).length,
    singleUseSkills: Object.values(skillFrequency).filter((count) => count === 1).length,
    distinctConnectors: Object.keys(connectorFrequency).length,
    singleUseConnectors: Object.values(connectorFrequency).filter((count) => count === 1).length,
    governedSkills: governedSkills.size,
    governedConnectors: governedConnectors.size,
  },
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) {
  for (const error of errors) console.error(`catalog audit: ${error}`);
  if (check) process.exitCode = 1;
}
