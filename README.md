# Ladder Graph Documentation

Design agent workflows visually. Validate the hard parts. Compile prompts or deterministic code.

Ladder Graph is an open-source, offline-first visual compiler for agent workflows. It provides a synchronized graph and LGIR YAML editor, structured loops, sequential or parallel execution groups, typed dependencies, diagnostics, local templates, deterministic Markdown adapters for Codex, Claude, and Hermes Agent, and deterministic data modules for Python and TypeScript. It does not run agents or contact model providers.

Ladder Graph also compiles portable workflow bundles. The gallery includes curated insurance, manufacturing, legal, commercial-credit, energy, healthcare, and real-estate bundles that combine an existing workflow with first-class forms, supporting document contracts, and either a complete ontology or a deterministic workflow-specific ontology sliver. Forms, documents, and ontologies can also be opened and saved as standalone projects.

## Run locally

Requirements: Node.js 20+, npm 10+, and optionally Rust stable plus `wasm-pack` when regenerating the committed compiler artifacts.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The production PWA is built with:

```bash
npm run build
npm run preview
```

## Verify

```bash
npm run typecheck
npm test
npm run rust:test
npm run wasm:build
npm run build
```

## Local MCP companion

`ladder-graph-mcp` is a native, read-only MCP server for the built-in catalog and workflows explicitly published from this browser. It does not require an account and does not read IndexedDB or OPFS directly.

```bash
cargo build --release -p ladder-graph-mcp
```

Configure the stdio MCP server in your chat client:

```json
{
  "mcpServers": {
    "ladder-graph": {
      "command": "/absolute/path/to/ladder-graph-mcp",
      "args": ["stdio"]
    }
  }
}
```

The chat client starts the binary, and the same process starts its loopback browser bridge automatically. Open **MCP** in Ladder Graph and the browser connects using its anonymous local installation ID—there is no server command or pairing code to copy. Choose **Publish saved library** to expose custom workflows and templates to MCP clients.

It exposes MCP resources for workflows, agent templates, ontologies, forms, documents, and workflow bundles, plus `search_catalog`, `get_workflow`, `get_agent_template`, `get_artifact`, `validate_workflow`, and `compile_workflow`. Run `ladder-graph-mcp doctor` to inspect local setup, `status` for catalog counts, or `revoke` to invalidate all browser connection tokens.

The sync service binds only to loopback. Ladder Graph's production origin and local development origins are allowed by default. Add custom deployments through the comma-separated `LADDER_GRAPH_MCP_ALLOWED_ORIGINS` environment variable or the standalone diagnostic command `serve --allow-origin https://your-origin.example`.

The Rust-generated files in `src/wasm/pkg` are intentionally committed so static deployments do not need a Rust toolchain.

## What the MVP includes

- Outcome-led starter workflows and editable role templates, including researched software, security, architecture/design, humanities, writing, personal-development, mathematics, music, and physics specialists.
- Canonical node kinds, including multi-output aggregators and teacher-model feedback, edge kinds, and compositional visual macros for parallel work, pipelines, reduction, verification, bounded debate, and brainstorming.
- DAG validation, structured bounded loops, bounded execution groups with aggregate or serialized exits, safe declarative transforms, explicit aggregation strategies, teacher-model feedback declarations, target capability reporting, and stable diagnostics.
- One self-contained Markdown artifact for Codex, Claude, or Hermes Agent, or an importable deterministic data module for Python or TypeScript.
- Typed text, image, audio, video, document, and mixed-media input contracts, including image-to-text and reference-image transformation workflows.
- Target-aware skill and connector templates with per-node customization stored directly in LGIR, including 15 declarative OpenRouter image, video, speech, music, and transcription profiles.
- IndexedDB and OPFS persistence, invalid-draft recovery, import/export, revisions, installable PWA behavior, and no telemetry.

## Workflow bundles and artifact studios

The bundle compiler adds versioned `Ontology`, `Form`, `Document`, and `WorkflowBundle` artifacts without changing existing workflow APIs. The curated industry bundles demonstrate:

- ontology-only import from a portable Lattice export—policies, evidence, runtime entities, and governance fields are not imported;
- explicit DocuBricks classification as `form`, `document`, or `hybrid`, with unsupported expressions preserved as inert metadata;
- deterministic ontology sliver closure from explicit type, property, relationship, form, document, and binding references;
- cross-artifact JSON Pointer and ontology-property validation;
- portable form JSON Schema and UI metadata, supporting document schemas, the unchanged workflow target, inclusion reasons, and a deterministic lockfile;
- catalog-backed bundle assembly for any built-in workflow, with attach/remove controls for ontologies, forms, and documents;
- a read-only workflow graph inside every bundle, with selectable node and edge contract inspection;
- direct form attachment on workflow nodes and node-scoped form creation seeded from input/output contracts;
- a visual binding inspector with selectable JSON Pointer endpoints, directions, ontology properties, and safe transforms;
- selectable ontology relationship canvases and inspectors in standalone and bundle views, workflow-sliver impact previews, breaking-change guidance, compile-target selection, pending-change validation, and per-file output download;
- a first-class form studio with structural page/section/field editing, an ontology field palette, field and workflow bindings, responsive preview, canonical YAML editing, diagnostics, undo/redo, and portable form exports;
- bundle recompilation from edited form sources, so visual changes are reflected in the generated JSON Schema and UI contract.
- local bundle persistence with complete-asset revisions, Recent Projects reopening, and history restore;
- deterministic `.ladderbundle.json` import/export with SHA-256 integrity checks;
- a searchable, industry-filtered starter library containing all 55 classified DocuBricks schemas: 24 forms and 31 documents, plus two native Ladder forms;
- standalone form authoring plus document-contract and ontology exploration workspaces, all with local persistence and compiler diagnostics;
- workflow-aware recommendations that upgrade a generic workflow bundle to its curated domain pack when one exists.

Regenerate the DocuBricks snapshot from a local checkout with:

```bash
npm run docubricks:import -- --source /absolute/path/to/DocuBricks
npm run catalog:generate
```

Regenerate the ontology-only Lattice snapshots from a local checkout with:

```bash
npm run lattice:import-ontologies -- --source /absolute/path/to/ontology-builder/lattice/apps/api/data/contract-registry.json
npm run catalog:generate
```

The reviewed classification and deterministic conversion report live in [`catalog/imports`](catalog/imports). Model-routing files and SQL-like expressions are retained only as inert provenance; Ladder Graph never executes them.

Portable authoring contracts are published in [`public/schema`](public/schema). The implementation and product rationale are documented in [ladder-graph-feature-expansion-plan.md](ladder-graph-feature-expansion-plan.md) and [ladder-graph-feature-expansion.md](ladder-graph-feature-expansion.md).

See [ladder-graph-specs.md](ladder-graph-specs.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ladder-graph-validation-plan.md](ladder-graph-validation-plan.md), and [ladder-graph-mcp-native-plan.md](ladder-graph-mcp-native-plan.md).

## Security model

Imported YAML is data, never code. Ladder Graph rejects custom tags, aliases, external references, arbitrary cycles, oversized documents, and unsupported transforms. Generated artifacts do not grant tools or permissions, and generated source is never executed by Ladder Graph. Browser storage is convenient local state, not a durable backup; export important workflows.

## License

Apache-2.0. See [LICENSE](LICENSE).
