import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";
import { importLatticeOntology } from "../src/compiler/artifacts/importers.ts";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const sourcePath = valueAfter("--source");
const requested = (valueAfter("--industries") ?? "energy,financial-services,healthcare,insurance,legal,manufacturing,real-estate")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!sourcePath) throw new Error("Usage: node scripts/import-lattice-ontologies.mjs --source <contract-registry.json>");

const registry = JSON.parse(await readFile(sourcePath, "utf8"));
const report = {
  schemaVersion: 1,
  source: path.resolve(sourcePath),
  generatedAt: new Date().toISOString(),
  imports: [],
};
for (const industry of requested) {
  const workspaceId = `workspace-${industry}`;
  const sourceOntology = registry.workspaces?.[workspaceId]?.ontology;
  if (!sourceOntology) throw new Error(`Lattice registry does not contain ${workspaceId}.ontology`);

  const digest = `sha256:${createHash("sha256").update(JSON.stringify(sourceOntology)).digest("hex")}`;
  const portableSource = {
    id: sourceOntology.id,
    name: sourceOntology.name,
    description: sourceOntology.description,
    version: sourceOntology.version,
    digest,
    entityTypes: sourceOntology.entityTypes,
    relationshipTypes: sourceOntology.relationshipTypes,
  };
  const imported = importLatticeOntology(JSON.stringify({ ontology: portableSource }));
  if (!imported.ok || !imported.artifact) {
    throw new Error(`${workspaceId} import failed: ${JSON.stringify(imported.diagnostics)}`);
  }

  const outputPath = path.resolve("catalog/ontologies", `${imported.artifact.metadata.name}.yaml`);
  await writeFile(outputPath, stringify(imported.artifact, { lineWidth: 110 }), "utf8");
  report.imports.push({
    workspaceId,
    artifact: `ladder://ontologies/builtin/${imported.artifact.metadata.name}`,
    sourceDigest: digest,
    typeCount: imported.artifact.spec.types.length,
    relationshipCount: imported.artifact.spec.relationships.length,
    output: path.relative(process.cwd(), outputPath),
    omittedSemantics: ["policies", "evidence", "runtime behavior", "governance workflows", "source bindings"],
  });
  console.log(
    `Imported ${workspaceId}: ${imported.artifact.spec.types.length} types, ${imported.artifact.spec.relationships.length} relationships -> ${outputPath}`,
  );
}
const reportPath = path.resolve("catalog/imports/lattice-import-report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Wrote Lattice ontology import report -> ${reportPath}`);
