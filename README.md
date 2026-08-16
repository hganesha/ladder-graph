# Ladder Graph Documentation

Design agent workflows visually. Validate the hard parts. Compile prompts or deterministic code.

Ladder Graph is an open-source, offline-first visual compiler for agent workflows. It provides a synchronized graph and LGIR YAML editor, structured loops, sequential or parallel execution groups, typed dependencies, diagnostics, local templates, deterministic Markdown adapters for Codex, Claude, and Hermes Agent, and deterministic data modules for Python and TypeScript. It does not run agents or contact model providers.

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

# Terminal 1: keep the browser sync service running
./target/release/ladder-graph-mcp serve

# Terminal 2: create a one-time browser pairing code
./target/release/ladder-graph-mcp pair
```

Open **Local storage → MCP companion** in Ladder Graph, enter the code, and publish the saved library. The stdio MCP server can then be configured with:

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

It exposes MCP resources for workflows and agent templates plus `search_catalog`, `get_workflow`, `get_agent_template`, `validate_workflow`, and `compile_workflow`. Run `ladder-graph-mcp doctor` to inspect local setup, `status` for catalog counts, or `revoke` to invalidate all browser pairing tokens.

The sync service binds only to loopback. Development origins are allowed by default; a deployed PWA origin must be added explicitly with `serve --allow-origin https://your-origin.example`.

The Rust-generated files in `src/wasm/pkg` are intentionally committed so static deployments do not need a Rust toolchain.

## What the MVP includes

- Outcome-led starter workflows and editable role templates, including researched software, security, architecture/design, humanities, writing, personal-development, mathematics, music, and physics specialists.
- Canonical node kinds, including multi-output aggregators and teacher-model feedback, edge kinds, and visual macros.
- DAG validation, structured bounded loops, bounded execution groups with aggregate or serialized exits, safe declarative transforms, explicit aggregation strategies, teacher-model feedback declarations, target capability reporting, and stable diagnostics.
- One self-contained Markdown artifact for Codex, Claude, or Hermes Agent, or an importable deterministic data module for Python or TypeScript.
- Typed text, image, audio, video, document, and mixed-media input contracts, including image-to-text and reference-image transformation workflows.
- Target-aware skill and connector templates with per-node customization stored directly in LGIR, including 15 declarative OpenRouter image, video, speech, music, and transcription profiles.
- IndexedDB and OPFS persistence, invalid-draft recovery, import/export, revisions, installable PWA behavior, and no telemetry.

See [ladder-graph-specs.md](ladder-graph-specs.md), [ARCHITECTURE.md](ARCHITECTURE.md), [ladder-graph-validation-plan.md](ladder-graph-validation-plan.md), and [ladder-graph-mcp-native-plan.md](ladder-graph-mcp-native-plan.md).

## Security model

Imported YAML is data, never code. Ladder Graph rejects custom tags, aliases, external references, arbitrary cycles, oversized documents, and unsupported transforms. Generated artifacts do not grant tools or permissions, and generated source is never executed by Ladder Graph. Browser storage is convenient local state, not a durable backup; export important workflows.

## License

Apache-2.0. See [LICENSE](LICENSE).
