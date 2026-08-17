import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

const catalogRoot = resolve(import.meta.dirname, "..", "catalog");
const manifest = JSON.parse(await readFile(resolve(catalogRoot, "manifest.json"), "utf8"));
const bound = new Set();
for (const entry of manifest.workflows) {
  const document = parse(await readFile(resolve(catalogRoot, entry.file), "utf8"));
  for (const node of document.spec.nodes) if (node.templateRef) bound.add(node.templateRef);
}
const paletteOnly = manifest.agents
  .map((entry) => entry.id)
  .filter((id) => !bound.has(id))
  .sort();
await writeFile(resolve(catalogRoot, "agent-usage.json"), `${JSON.stringify({ schemaVersion: 1, paletteOnly }, null, 2)}\n`);
console.log(`Marked ${bound.size} agents workflow-bound and ${paletteOnly.length} intentionally palette-only.`);
