# Icons for ontology types and workflow agents

## Recommendation

Proceed with stable icon references in the artifact data, with two scope and architecture adjustments:

1. An ontology type may have an explicit icon override.
2. In a workflow, only a node whose exact `kind` is `agent` may have an explicit icon override. Existing kind icons remain unchanged for input, output, tool, transform, condition, evaluate, teacher, approval, join, aggregator, loop, group, and subgraph nodes.

The persisted value should be an icon reference, never a React component, import path, SVG, or URL:

```yaml
icon:
  set: lucide
  name: database
```

Absence of `icon` means “automatic.” That is enough to distinguish a user override from a derived default; no `derivedIcon` or `isCustom` field should be stored.

For the first release, “custom” should mean choosing another icon from the approved Lucide catalog. User-uploaded SVGs, arbitrary URLs, and arbitrary SVG markup should be out of scope. Those introduce a separate asset-storage and sanitization design.

## Assessment of the proposal

The proposal is directionally strong. The data-model decision is correct, as are the recommendations to reserve a fixed layout box, keep rendering failures non-fatal, lazy-load the picker UI, make icons decorative when a visible label is present, and keep explicit choices separate from automatic defaults.

Several details should be changed for this repository.

### Keep the icon reference in the portable artifact

The reference belongs on `OntologyType` and on an agent `LgirNode`, because users expect it to survive YAML edits, project persistence, bundle previews, ontology slicing, export, and collaboration. Resolution and rendering remain presentation concerns.

The reference should use canonical kebab-case Lucide names. A shared type is sufficient:

```ts
export interface IconRef {
  set: "lucide";
  name: string;
}
```

Recommended constraints:

- `set` is a known icon-pack identifier. Adding another set later changes the allowed union and resolver, but does not require migrating existing Lucide values.
- `name` is canonical kebab-case, has a modest length limit, and contains no path separators.
- Unknown names produce a warning and render the generic fallback. They must not make a graph unusable.
- The stored value is not silently rewritten through the alias map. Aliases are a read-time compatibility layer; an explicit migration can canonicalize old data later.

The current ontology JSON Schema has `additionalProperties: false` on type records, so it must explicitly add `icon`. The workflow schema accepts arbitrary node properties today, but it should still define `icon` and enforce that it is absent unless `kind` is `agent`. The TypeScript model can document the same restriction without first converting the entire node model into a discriminated union.

### The compiler path is part of the change

Adding only the TypeScript field would not work end to end. Workflow analysis is backed by the typed Rust `Node` in `crates/lgir-core/src/lib.rs`; an unknown field is dropped from the normalized workflow. The Rust node needs an optional `IconRef` with `skip_serializing_if = "Option::is_none"`, plus validation that only agent nodes use it.

The TypeScript fallback compiler also needs equivalent validation so WASM and fallback mode agree. Ontologies are normalized as generic JSON values, so an allowed icon property will already round-trip and will be retained when ontology types are copied into a sliver. Tests should lock down both behaviors.

It is acceptable for compiled Python/TypeScript workflow manifests and bundled ontology artifacts to carry the reference as inert authoring metadata. Runtime adapters should not interpret it as an executable capability.

### Start with one curated sprite, not category tiers

The build-time sprite recommendation fits the existing Vite application and avoids importing a dynamic React component per visible node. However, category sprites do not currently buy much here:

- `vite.config.ts` precaches every emitted SVG through the PWA `globPatterns`, so category files placed in the normal build output would all be downloaded during service-worker installation unless the caching policy also changes.
- The likely first-release catalog is a few hundred icons, where one versioned, cacheable sprite is simpler and should be measured before adding category loading.
- Lucide is already a dependency and the app already uses static, tree-shaken Lucide imports throughout the UI. Icon support should not trigger a broader rewrite of existing UI icons.

Generate one curated Lucide sprite and one metadata file at build time. Include the generic ontology and agent fallbacks in that catalog. Keep the generated asset content-hashed through Vite or otherwise versioned with the Lucide version.

Do not rely on `lucide-react/dynamicIconImports` for the canvas. The installed package exposes a roughly 100 KB uncompressed import map and a chunk per selected icon. A module cache would mitigate remounts, but it is unnecessary if the canvas uses a sprite.

The installed `lucide-react` package supplies icon modules and dynamic-import keys, but not the rich search tags assumed by the proposal. The application should own a curated metadata file containing canonical name, display label, category, and search keywords. This also keeps the picker focused and makes semantic matching testable.

### Treat graph image export as an acceptance gate

`src/lib/graphImage.ts` exports the React Flow viewport with `html-to-image`. External references such as:

```html
<svg><use href="/icons/lucide.svg#database"></use></svg>
```

must be tested in both PNG and SVG exports. A browser-rendered icon is not proof that the cloned/exported graph will contain it.

The preferred sprite implementation is acceptable only if automated and manual export checks show that symbols are embedded or otherwise preserved. If external `<use>` references disappear, inject the generated symbol definitions into the exported viewport before capture, or switch the node renderer to generated inline Lucide path data. Do not ship icons that vanish from exported diagrams.

### Use semantic defaults, but avoid pseudo-semantic hash choices

An explicit override should win. Otherwise derive an icon from stable semantic fields, then use one generic fallback:

```text
explicit valid override
  -> semantic rule
  -> generic kind fallback (Boxes for ontology, Bot for agent)
```

Do not hash an unmatched type ID into a set of unrelated icons. That is deterministic, but it assigns visual meaning where none exists and can make diagrams harder to learn. A single neutral fallback is more honest and more consistent.

Ontology rules should use normalized tokens from `id`, `label`, and `aliases`, with exact/high-confidence matches taking priority. Free-form descriptions should not drive a default in the first release because incidental words can produce surprising results. A small curated map can cover concepts such as person, organization, event, document, location, measure, database, policy, asset, claim, and account.

Agent rules should use stable `templateRef` or known role/category metadata first, then high-confidence role/name tokens. This avoids writing derived icons into every generated workflow or role template. Unmatched agents remain `bot`.

The resolver should be a pure function and should return enough provenance for the editor to say “Automatic: database” versus “Custom: database.” It should apply a versioned alias map before determining that a name is missing.

### The picker is an editor feature, not a canvas loader

Use one shared picker for ontology types and workflow agents:

- Load the modal/popover component only when the user opens it.
- Search the application-owned metadata by name, label, category, and keywords.
- Group or filter by a small number of categories.
- Virtualize only if the measured catalog size/render cost warrants it. A curated set of about 200 icons may not need another dependency.
- Include an “Automatic” action that removes the persisted `icon` key.
- Show the resolved automatic icon in the trigger so users can understand what will happen before opening the picker.

Clearing an agent override needs care: `patchNode` currently sets every provided key and does not delete a path when its value is `undefined`. The implementation should either teach `patchNode` to delete undefined keys, matching `patchEdge`, or add a dedicated icon mutation that calls `deleteIn`. “Automatic” must remove the YAML field rather than serialize `null` or an empty object.

## Proposed behavior

### Ontology type

```yaml
- id: insurance_claim
  label: Insurance Claim
  icon:
    set: lucide
    name: file-check
  properties: []
```

- The icon appears in `OntologyCanvas` in both the standalone ontology editor and bundle preview.
- The inspector permits choosing an override or returning to Automatic.
- Slicing an ontology retains an explicit override on included types.
- Imported and existing ontologies need no migration; automatic resolution handles missing fields without modifying source YAML.

Displaying the icon in `OntologyTree` is optional polish, not required for the first canvas-focused release.

### Workflow agent

```yaml
- id: research-agent
  kind: agent
  name: Research analyst
  icon:
    set: lucide
    name: search
```

- `TaskNode` substitutes the resolved icon only when `data.kind === "agent"`.
- Every other workflow node keeps its existing `NODE_META`/kind icon behavior.
- The Basics tab of `Inspector` shows the picker only for exact agent nodes.
- Bundle workflow previews inherit the behavior because they reuse `TaskNode` and `workflowNodeTypes`.

### Failure behavior

- Unsupported set: warn and show the generic fallback.
- Unknown name: check aliases, then warn and show the generic fallback.
- Sprite unavailable: preserve the fixed icon box and show the generic inline/core glyph.
- No explicit value: do not warn; derive automatically.
- The visible node label remains the accessible name. The icon uses `aria-hidden="true"` and cannot receive focus.

## Implementation plan

### 1. Define and validate the contract

- Add `IconRef` and optional fields to `src/types.ts` / `src/types/artifacts.ts`.
- Add a reusable icon definition to `public/schema/lgir-v1alpha1.schema.json` and `public/schema/ontology-v1alpha1.schema.json`.
- Restrict workflow persistence to exact `kind: agent` in schema and compiler validation.
- Add the optional icon model to `crates/lgir-core/src/lib.rs`.
- Add matching warnings/validation to `src/compiler/fallback.ts` and `src/compiler/artifacts/fallback.ts`.
- Make the Lucide version an intentional exact pin for generated assets and record that version in the generated metadata.

Exit criterion: YAML analysis, formatting, project persistence, and normalized output retain valid icons and remain backward compatible with artifacts that omit them.

### 2. Generate a curated catalog and sprite

- Add a reviewed source catalog of canonical names, categories, and keywords.
- Add a build script that verifies every catalog name exists in the pinned Lucide package and produces the sprite plus picker metadata.
- Ensure aliases and semantic rules only point to catalog entries.
- Run generation before TypeScript/Vite build and fail fast on duplicate IDs or missing Lucide icons.
- Keep UI-chrome imports unchanged.

Exit criterion: one cached asset covers every selectable/default icon, the generated files are deterministic, and the size is recorded in the pull request. Add category sprites only if measurement shows the single sprite is materially too large and update PWA caching at the same time.

### 3. Add the resolver and renderer

- Implement one pure resolver shared by ontology and workflow surfaces.
- Add explicit override, alias, semantic-rule, and generic-fallback tests.
- Implement a fixed-size decorative `NodeIcon` renderer with `currentColor` and no per-node `Suspense` boundary.
- Use it in `TaskNode` for agents and in `OntologyCanvas` for ontology types.
- Keep the icon dimensions independent of load state so node measurements do not change.

Exit criterion: panning, zooming, selection, minimap behavior, bundle previews, and canvas layout remain stable with repeated and distinct icons.

### 4. Add editor controls

- Add a shared lazy-loaded picker.
- Add the control to the agent Basics inspector and ontology type inspector.
- Make “Automatic” delete the field from YAML.
- Preserve selection while ontology edits reserialize the artifact.
- Do not write derived defaults into catalog templates or imported ontologies.

Exit criterion: choose, change, clear, undo/redo for workflow agents, save/reopen, and source-mode edits all converge on the same YAML. The ontology editor does not currently expose undo/redo, so icon editing should follow its existing immediate-edit/save model rather than adding history as part of this feature.

### 5. Verify exports, offline behavior, and compatibility

- Add render tests for explicit, automatic, missing, and aliased icons.
- Add schema/compiler round-trip tests, including rejection or diagnostics for icons on non-agent workflow nodes.
- Add an ontology-slice test proving an explicit icon is retained.
- Add browser-level PNG and SVG export checks that inspect the resulting image, not only the call into `html-to-image`.
- Verify first load, PWA offline reload, and service-worker update after the sprite changes.
- Test light/dark themes and at minimum/maximum graph zoom.

Exit criterion: icons are visible on screen and in both export formats, no broken icon throws inside a React Flow node, and existing icon-free artifacts produce no source diff.

## Rollout order

Ship the contract, renderer, and a small curated picker together behind no data migration. Start with automatic defaults plus roughly 100–200 approved choices. Measure the generated sprite, initial PWA download, picker-open time, and a representative 40-node graph before expanding the catalog or introducing category sprites.

This preserves the proposal’s most important property—portable stable IDs—while fitting the repository’s actual compiler, PWA, React Flow, ontology slicing, and graph-export paths.
