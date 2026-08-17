import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse, stringify } from "yaml";

const root = resolve(import.meta.dirname, "..");
const catalogRoot = resolve(root, "catalog");
const manifest = JSON.parse(await readFile(resolve(catalogRoot, "manifest.json"), "utf8"));
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const adoptInferred = process.argv.includes("--adopt-inferred");
const agents = new Map();
const prompts = new Map();

for (const entry of manifest.agents) {
  const document = parse(await readFile(resolve(catalogRoot, entry.file), "utf8"));
  agents.set(entry.id, document);
  const matches = prompts.get(document.spec.prompt) ?? [];
  matches.push(entry.id);
  prompts.set(document.spec.prompt, matches);
}

let referenced = 0;
let changed = 0;
const errors = [];
for (const entry of manifest.workflows) {
  const file = resolve(catalogRoot, entry.file);
  const source = await readFile(file, "utf8");
  const document = parse(source);
  let workflowChanged = false;

  if (write && adoptInferred) {
    const inferred = new Map(
      document.spec.nodes
        .filter((node) => !node.templateRef && node.prompt && (prompts.get(node.prompt) ?? []).length === 1)
        .map((node) => [node.id, prompts.get(node.prompt)[0]]),
    );
    if (inferred.size) {
      const lines = source.split("\n");
      const adopted = [];
      let currentNodeId = null;
      for (const line of lines) {
        const idMatch = line.match(/^ {4}- id: (.+)$/);
        if (idMatch) currentNodeId = idMatch[1].trim();
        adopted.push(line);
        if (currentNodeId && inferred.has(currentNodeId) && line.trim().startsWith("kind:")) {
          adopted.push(`      templateRef: ${inferred.get(currentNodeId)}`);
          inferred.delete(currentNodeId);
        }
      }
      await writeFile(file, adopted.join("\n"));
      changed += 1;
      continue;
    }
  }

  for (const node of document.spec.nodes) {
    if (!node.templateRef) continue;
    referenced += 1;
    const agent = agents.get(node.templateRef);
    if (!agent) {
      errors.push(`${entry.file}:${node.id} references unknown agent ${node.templateRef}`);
      continue;
    }
    const expected = agent.spec;
    const drifted = node.prompt !== expected.prompt;
    if (!drifted) continue;
    if (!write) {
      errors.push(`${entry.file}:${node.id} has drifted from ${node.templateRef}`);
      continue;
    }
    node.prompt = expected.prompt;
    workflowChanged = true;
  }

  if (workflowChanged) {
    await writeFile(file, stringify(document, { lineWidth: 110 }));
    changed += 1;
  }
}

for (const error of errors) console.error(`catalog role sync: ${error}`);
console.log(`Checked ${referenced} structural role references; updated ${changed} workflows.`);
if (check && errors.length) process.exitCode = 1;
