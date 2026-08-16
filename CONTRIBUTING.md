# Contributing

Thank you for helping make agent workflows easier to inspect and share.

## Development

1. Create a focused branch.
2. Run `npm install`.
3. Use `npm run dev` for the studio.
4. Add tests for compiler behavior, templates, or UI changes.
5. Run `npm run typecheck`, `npm test`, `npm run rust:test`, and `npm run build` before opening a pull request.

Rust semantic changes must regenerate `src/wasm/pkg` from `crates/lgir-wasm` with `npm run wasm:build`. Commit the generated `.js`, `.d.ts`, and `.wasm` files. CI rebuilds them and fails when they differ.

Built-in workflow or agent-template changes belong under `catalog/`. Run `npm run catalog:generate` and commit the generated `src/generated/catalog.ts` index. Do not hand-edit the generated index.

## Design principles

- Preserve YAML as the portable source of truth.
- Prefer stable diagnostics and safe fixes over implicit correction.
- Never add execution, provider calls, credentials, or telemetry to the compiler path.
- Expose target limitations as native, instructional, or unsupported.
- Keep templates inspectable, editable, and useful without hidden files.

## Proposals

LGIR additions should include syntax, validation rules, target behavior, migration strategy, security implications, fixtures, and a clear reason canonical nodes cannot already express the use case.
