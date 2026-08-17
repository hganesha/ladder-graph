import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

const root = resolve(import.meta.dirname, "..");
const catalogRoot = resolve(root, "catalog");
const manifest = JSON.parse(await readFile(resolve(catalogRoot, "manifest.json"), "utf8"));
let changed = 0;

for (const entry of manifest.workflows) {
  const file = resolve(catalogRoot, entry.file);
  const source = await readFile(file, "utf8");
  const document = parse(source);
  const missingInputIds = new Set(
    document.spec.nodes.filter((node) => node.kind === "input" && !node.inputSchema?.["x-ladder-input-mode"]).map((node) => node.id),
  );
  if (!missingInputIds.size) continue;

  const lines = source.split("\n");
  let currentNodeId = null;
  const output = [];
  for (const line of lines) {
    const idMatch = line.match(/^ {4}- id: (.+)$/);
    if (idMatch) currentNodeId = idMatch[1].trim();
    output.push(line);
    if (currentNodeId && missingInputIds.has(currentNodeId) && line.trim() === "kind: input") {
      output.push(
        "      inputSchema:",
        "        type: object",
        "        required: [text]",
        "        properties:",
        "          text: { type: string, description: The requester's objective, source material, or instructions. }",
        "        x-ladder-input-mode: text",
      );
      missingInputIds.delete(currentNodeId);
    }
  }
  await writeFile(file, output.join("\n"));
  changed += 1;
}

console.log(`Backfilled text input contracts in ${changed} workflows.`);
