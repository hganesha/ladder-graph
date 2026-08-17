import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

const catalogRoot = resolve(import.meta.dirname, "..", "catalog");
const manifest = JSON.parse(await readFile(resolve(catalogRoot, "manifest.json"), "utf8"));
let marked = 0;
for (const entry of manifest.workflows) {
  const file = resolve(catalogRoot, entry.file);
  const source = await readFile(file, "utf8");
  const document = parse(source);
  const inlineIds = new Set(
    document.spec.nodes
      .filter((node) => ["agent", "evaluate", "teacher"].includes(node.kind) && node.prompt && !node.templateRef && !node.inlineRole)
      .map((node) => node.id),
  );
  if (!inlineIds.size) continue;
  const output = [];
  let currentNodeId = null;
  for (const line of source.split("\n")) {
    const match = line.match(/^ {4}- id: (.+)$/);
    if (match) currentNodeId = match[1].trim();
    output.push(line);
    if (currentNodeId && inlineIds.has(currentNodeId) && line.trim().startsWith("kind:")) {
      output.push("      inlineRole: true");
      inlineIds.delete(currentNodeId);
      marked += 1;
    }
  }
  await writeFile(file, output.join("\n"));
}
console.log(`Marked ${marked} intentionally inline catalog roles.`);
