# Artifact contract RFC

Status: Accepted

Ladder Graph treats `Ontology`, `Form`, `Document`, and `WorkflowBundle` as portable data contracts under `ladder.dev/v1alpha1`. Inputs are parsed as inert YAML/JSON, normalized into the shared model, validated without network access, and compiled deterministically. Lattice and DocuBricks are import sources only; their runtimes and executable behavior are outside the boundary.

## Limits

- Source documents are limited to 2,000,000 bytes.
- Ontologies are limited to 1,000 types and 2,000 relationships.
- Custom YAML tags, anchors, aliases, and remote `$ref` values are rejected.
- Bundle references must resolve from explicit local snapshots.
- Binding transforms use the fixed allowlist in the workflow-bundle schema.

## Determinism

Source hashes use canonical JSON with lexicographically ordered object keys. Ontology closure and bundle files are path-sorted. Equivalent inputs must produce identical normalized values, diagnostic order, hashes, lockfiles, and artifact paths in Rust, Wasm, and the TypeScript fallback.

## Diagnostic registry

The machine-readable registry is [`fixtures/artifacts/diagnostic-registry.json`](../fixtures/artifacts/diagnostic-registry.json). Prefixes are stable public namespaces:

- `LA`: artifact envelope, parsing, and security
- `LO`: ontology structure and closure
- `LF`: form contracts
- `LD`: document contracts
- `LB`: bundle resolution, binding, and compilation

Codes may be added within a prefix, but an existing code must not be reused with a different meaning. Cross-artifact diagnostics include the originating reference and JSON Pointer path.

## Compatibility fixtures

[`fixtures/artifacts/parity.json`](../fixtures/artifacts/parity.json) is consumed by Rust and browser/Wasm tests. A fixture change is a contract change and requires review of both implementations.
