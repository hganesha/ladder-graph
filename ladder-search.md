# Ladder universal catalog search

**Status:** Product experience specification  
**Scope:** Search and discovery across subject areas, workflows, agents, forms, and documents  
**Primary surface:** Ladder library, with the same search available from the studio  
**Product constraint:** Offline-first; search never sends catalog or user-project data to a remote service

## Summary

Ladder should replace type-first browsing with one universal search entry. A user enters a keyword or partial word once, and Ladder returns a single relevance-ranked page grouped into:

1. Subject areas
2. Workflows
3. Agents
4. Forms
5. Documents

The experience should work equally well for someone who knows an exact artifact name and someone who only knows the domain, task, or fragment of a word. Searching `underw`, for example, should surface **Insurance & underwriting** as a subject area, then relevant underwriting workflows, agents, forms, and document contracts.

Search is a navigation and creation surface, not a separate database screen. Selecting a subject area narrows the catalog; selecting an artifact opens the correct Ladder studio or starts the relevant workflow.

## Product principles

### One question, one field

The interface should ask only: **What do you want to build or find?** Users should not have to choose a subject area or artifact type before searching.

### Domain language before internal structure

Match the words people use: `claim`, `contract`, `incident`, `hiring`, `approval`, `image`, or `flight`. Internal IDs, paths, and schema terms may improve retrieval but should not dominate the visible result.

### Useful with an incomplete thought

Partial words should work from the first meaningful characters. `insur`, `regres`, and `approv` should return useful results without requiring wildcards, exact spelling, or an Enter key.

### Categories clarify; they do not fragment

All five categories appear in one result surface. The user can scan across them without moving between tabs, while optional type filters can reduce the set after results appear.

### Action is part of the answer

Every result says what will happen next: **Browse subject**, **Open workflow**, **Create with agent**, **Open form studio**, or **Inspect document**.

### Local and explainable

Results come from a deterministic local index. Ladder should be able to explain why a result matched, and identical catalog state plus query should produce identical ordering.

## Entry points

### Library entry

Place a full-width search field directly below the library heading and above existing browsing controls.

- Label: `Search the Ladder catalog`
- Placeholder: `Search subjects, workflows, agents, forms, and documents…`
- Leading icon: search
- Trailing hint when empty: `/`
- Trailing control when populated: clear query
- The current subject-area, starting-point, and modality controls remain available as browse and refinement tools, but they are secondary to search.

The input receives focus when the user presses `/` anywhere on the library page unless focus is already in an editable field.

### Global entry

Expose the same search from the studio header as a compact **Search catalog** control. `Cmd+K` on macOS and `Ctrl+K` elsewhere opens it from any Ladder surface. This opens the same search experience in a centered search dialog and does not discard the current project.

The library and dialog share query syntax, ranking, result components, and recent-query history. The only difference is navigation: the library uses the page result region; the studio uses a modal dialog and returns focus to the invoking control when closed.

## Core interaction

### 1. Focus

When the empty field receives focus, show a compact discovery panel with:

- up to three recent searches stored in the browser;
- up to five suggested subject areas based on recently opened artifacts;
- short examples such as `claim review`, `accessibility`, and `approval form`.

Do not show an undifferentiated wall of popular catalog items. The default state should teach the scope of search and help the user form a query.

### 2. Type

Search begins after two non-space characters. Update results after a 100 ms debounce. Do not require Enter.

While the user is typing:

- preserve the input cursor and visible results;
- replace results atomically when the new match set is ready;
- announce result-count changes to assistive technology without moving focus;
- cancel or ignore work for an obsolete query.

Because the index is local, a spinner should rarely be necessary. If work exceeds 150 ms, show a subtle inline `Searching…` status without blanking previous results.

### 3. Scan

Results appear below the field in category order:

1. Subject areas
2. Workflows
3. Agents
4. Forms
5. Documents

Each section header contains its label and total match count. Initially show:

- up to 4 subject areas;
- up to 6 results in each artifact category;
- a `Show all N` action when a group has additional matches.

Hide categories with zero results once a query exists. Do not use empty cards to preserve the five-section structure.

Within each category, sort by relevance. Across categories, keep the fixed category order rather than interleaving different artifact types into a visually unstable list.

### 4. Refine

Below the search field, display filter chips only after a query starts:

- `All`
- `Subject areas`
- `Workflows`
- `Agents`
- `Forms`
- `Documents`

Each chip includes the current count. `All` is selected by default. Selecting one or more type chips hides other sections; selecting `All` clears type selections.

Two optional refinements follow the type chips:

- **Subject area:** populated from subject-area matches and the areas attached to matching artifacts.
- **Modality:** All, text, image, audio, video, document, and mixed.

Only show a refinement if it can change the current result set. Forms and documents with no modality metadata remain included under `All`; choosing a modality removes items that cannot declare support for it.

Active refinements appear in the URL and can be cleared individually. A final `Clear filters` action resets refinements but preserves the query.

### 5. Act

The whole result row is interactive, with one unambiguous primary outcome:

| Result type | Primary action | Destination |
| --- | --- | --- |
| Subject area | Browse subject | Library filtered to that subject area, with the query cleared |
| Workflow | Open workflow | Workflow studio populated from that template |
| Agent | Create with agent | New workflow seeded with that agent template |
| Form | Open form | Form studio populated from that template |
| Document | Inspect document | Document contract studio populated from that template |

Opening a result should preserve the previous search state in navigation history. Returning to the library restores the query, filters, expansion state, scroll position, and focused result.

## Result anatomy

Every result row uses the same information hierarchy:

1. Type icon and visible type label
2. Title
3. One-line description or role
4. Subject area
5. Type-specific metadata
6. Match explanation
7. Primary action label

Matched fragments in the title and descriptive text use visual emphasis, but the emphasis is not the only indication that an item matched.

### Subject-area result

- Title: `Insurance & underwriting`
- Description: the existing area description
- Metadata: counts for workflows, agents, forms, and documents
- Match explanation: `Subject name begins with “underw”` or `Matches alias “claims”`
- Action: `Browse subject`

Selecting the result returns to browse mode scoped to that subject, rather than opening a new editor.

### Workflow result

- Title and existing description
- Subject area
- Eyebrow or use case
- Topology
- Supported modalities
- Match explanation, such as `Title match` or `Agent role: Underwriting reviewer`
- Action: `Open workflow`

### Agent result

- Agent name
- Role summary
- Subject area and subcategory
- Up to three matching or representative skills
- Supported modalities
- Match explanation, such as `Skill match: accessibility`
- Action: `Create with agent`

### Form result

- Form title and description
- Subject area or industry
- Form role when known: start, clarification, review, approval, exception, or completion
- Field count when cheaply available from the catalog index
- Match explanation, such as `Field match: policy number`
- Action: `Open form`

### Document result

- Document title and description
- Subject area or industry
- Document type
- Field or validation-rule count when cheaply available
- Match explanation, such as `Document type match: claim file`
- Action: `Inspect document`

## Search behavior

### Normalization

Before indexing and querying, Ladder should:

- lowercase text using locale-independent rules;
- normalize Unicode and diacritics;
- treat punctuation, underscores, slashes, ampersands, and hyphens as token boundaries;
- collapse whitespace;
- keep both the normalized phrase and individual tokens;
- generate edge prefixes for each token from two characters onward;
- retain the original display text for rendering.

Thus `real_estate`, `real-estate`, and `real estate` resolve consistently. `UX` can match `user experience` through curated aliases rather than opaque stemming.

### Partial-word matching

Partial input is prefix-based by default:

- `underw` matches `underwriting`;
- `access` matches `accessibility`;
- `regres` matches `regression`;
- `doc` matches `document`.

Prefix matches may occur at the beginning of any indexed token, not just the title. Infix matching should be limited to identifiers and exact compact strings, where users may paste a known ID fragment. This avoids noisy results such as a short query matching arbitrary letters inside every description.

### Multiple terms

Treat whitespace-separated terms as AND by default. `claim approv` should favor items containing both concepts. An exact phrase match outranks separate-token matches, but quotation-mark syntax is not required for the first release.

If no result contains every token, show a clearly labeled recovery set matching all but one token. For example: `No exact matches. Results matching “claim”`.

### Typo tolerance

Apply edit-distance tolerance only when:

- the token contains at least four characters;
- exact, prefix, and alias matches produce too few results;
- the candidate differs by one edit for tokens of 4–7 characters or two edits for longer tokens.

Typo-tolerant results must display `Similar to “…”` in the match explanation. They always rank below exact and prefix matches. Ladder should never silently rewrite the visible query.

### Synonyms and aliases

Maintain a small, reviewed alias map rather than using generated semantic guesses. Initial examples:

| Query term | Also match |
| --- | --- |
| UX | user experience, product design, usability |
| HR | human resources, talent operations |
| SRE | site reliability, incident response |
| QA | quality assurance, testing |
| claims | insurance claim, claim file, loss notice |
| contract | agreement, legal document |
| intake | start form, submission form |
| approval | decision form, review gate |

Aliases are bidirectional only when that is semantically safe. A result matched solely by an alias identifies the alias in its explanation.

### Searchable fields

| Category | High-weight fields | Supporting fields |
| --- | --- | --- |
| Subject area | name, aliases | description, search terms |
| Workflow | title, area, eyebrow | description, topology, objective, node names, node roles, capabilities, modalities, ID, path |
| Agent | name, role, area | skills, subcategory, modalities, ID, path |
| Form | title, role, industry | description, field labels, field names, aliases, ID, path |
| Document | title, document type, industry | description, section titles, field labels, validation descriptions, ID, path |

Long YAML source is not searched at query time. The catalog-generation step should extract approved searchable fields into a compact index so prompts, fixtures, and repeated schema text do not flood relevance.

## Ranking

Each item receives a deterministic score. Recommended precedence:

1. Exact title or subject-area name
2. Title phrase prefix
3. Complete title-token prefix
4. Curated alias
5. High-weight metadata match
6. Supporting metadata match
7. Typo-tolerant match

Apply the following boosts after text relevance:

- current subject-area filter;
- exact modality match;
- locally saved or recently opened counterpart of the same catalog item;
- curated starter status.

Do not allow recency to overtake a materially stronger text match. Recency is a tie-breaker, not the main relevance signal.

Stable final ordering should use score, then title, then canonical ID. Catalog generation must produce the same index order on every build.

### Group prominence

Subject areas remain first because they help broad queries become useful navigation. Artifact groups retain their fixed order so the page does not jump as the query changes. Within a type-filtered view, the selected group naturally occupies the full result surface.

For keyboard use, however, maintain one flattened result order matching the visual sequence. Arrow navigation should never jump unpredictably between columns.

## Keyboard behavior

- `/`: focus library search when not already editing text.
- `Cmd+K` / `Ctrl+K`: open global search.
- `Escape`: first clear the active query suggestion or close an expanded group; when in the global dialog, a subsequent Escape closes the dialog.
- `ArrowDown` / `ArrowUp`: move through visible results in visual order.
- `Home` / `End`: move to the first or last visible result.
- `Enter`: activate the focused result.
- `Tab`: moves through the input, filters, group actions, and results using normal document order.

Typing should keep DOM focus in the search field. The active result may be represented with `aria-activedescendant`, but mouse hover must not steal keyboard focus.

## States

### Empty query

Show recent searches and a few context-aware subject suggestions. Preserve the normal library browse experience below the search region.

### One character

Do not search. Show `Type one more character to search the catalog.` This prevents a huge, low-value match set.

### Results

Show the total once near the input (`27 results`) and per-group counts. Avoid repeated sentences about the same count.

### No results

Use the query in the message: `No catalog results for “mortgatge”.`

Then offer, in order:

1. a spelling suggestion when confidence is high;
2. removable active filters that may be excluding matches;
3. up to three related subject areas based on alias or token similarity;
4. `Clear search and browse all`.

Do not offer to create an arbitrary new artifact from an unmatched term in the first release; that implies generation behavior Ladder does not provide.

### Error

If the local index cannot load, keep normal library browsing available and show: `Search is unavailable, but you can still browse the catalog.` Provide a `Retry` action and record a local diagnostic. Never imply a network problem.

### No results in one category

Hide that category while `All` is selected. If the user explicitly filters to the empty category, show a specific message such as `No forms match “flight dispatch”.` and keep other type-filter chips visible.

## Responsive behavior

### Desktop

Use a single-column result list with compact section dividers. A two-column card grid is visually attractive but makes cross-category scanning and arrow-key order harder. Rows may expose metadata in a right-aligned secondary column when space permits.

The global dialog should be no wider than 760 px and no taller than the viewport minus 64 px. The result region, not the document, owns overflow.

### Mobile

Search is full width. Filter chips horizontally scroll with a visible end fade; the user should not need to open a separate filter sheet for type selection. Metadata wraps below the title and description. Keep a minimum 44 × 44 px activation target.

The mobile global entry opens a full-height sheet with the search field pinned to the top and the on-screen keyboard accommodated through dynamic viewport units.

## Accessibility

- Use a visible `<label>`; placeholder text is supplementary.
- Represent search results as a labeled region, not as a tab panel.
- Group result sections with headings and semantic lists.
- Every result has one accessible name that includes title, type, and action.
- Result count updates use a polite live region; do not announce each keystroke or every highlighted fragment.
- Match highlighting uses `<mark>` plus text context and meets contrast requirements in light and dark themes.
- Type icons are decorative when the type label is present.
- Focus remains visible at 200% zoom and in high-contrast mode.
- Reduced-motion preferences disable animated group expansion and dialog transitions.
- Restoring search state also restores a sensible focus target; if the prior result no longer exists, focus returns to the search field.

## URL, persistence, and history

On the library page, encode shareable state as query parameters:

```text
?q=claim+review&type=workflow,form&subject=insurance&modality=document
```

Rules:

- use canonical lowercase IDs for filters;
- omit parameters with default values;
- update history with `replaceState` while typing;
- push a history entry when a result opens or a subject result changes browse context;
- recover gracefully from unknown or removed filter IDs.

Store at most 10 recent queries locally. A recent query contains only the normalized query and timestamp, never result contents or user project data. Provide `Clear recent searches` in the focused empty state.

## Catalog index contract

Generate one versioned search index alongside the existing generated catalog. A normalized entry should resemble:

```ts
type SearchCatalogKind = "subject" | "workflow" | "agent" | "form" | "document";

interface SearchCatalogEntry {
  id: string;
  kind: SearchCatalogKind;
  title: string;
  description: string;
  subjectAreaIds: string[];
  modalities: string[];
  primaryTerms: string[];
  secondaryTerms: string[];
  aliases: string[];
  metadata: Record<string, string | number | string[]>;
  destination: {
    action: "browse-subject" | "open-workflow" | "create-with-agent" | "open-form" | "inspect-document";
    templateId?: string;
    subjectAreaId?: string;
  };
}
```

Index generation should validate:

- globally unique `{kind}:{id}` keys;
- a destination for every result;
- a subject mapping for every artifact where one exists;
- normalized and deduplicated terms;
- no inclusion of full YAML, personal saved-project contents, or executable source;
- deterministic output and source hash.

Built-in catalog results and user-saved projects should remain conceptually separate. The first release searches the universal built-in catalog described here. A later `My projects` group can join the index only after its privacy, naming collisions, and stale-record behavior are specified.

## Performance targets

- Search index should load with the library route and be ready before the first input interaction.
- P95 query-to-results time: under 100 ms on the supported baseline for the current catalog.
- No main-thread task longer than 50 ms during typing.
- Initial search-index payload: target under 300 KB compressed; split descriptive detail from core terms if needed.
- Queries and ranking must work completely offline.
- A larger future catalog should move scoring to the existing worker boundary without changing the UI contract.

## Measurement

Keep measurement local by default, consistent with Ladder's offline-first promise. Useful counters include:

- searches started;
- searches producing a result;
- no-result rate;
- result activation rate;
- activation by category;
- query-to-open time;
- filter use;
- keyboard versus pointer activation;
- searches abandoned after a typo recovery.

Do not record raw query text in remotely exported analytics. If telemetry is ever added, it should be opt-in and use aggregate event properties such as query length, result count bucket, and selected category.

## Acceptance criteria

### Retrieval

- Entering any two-character prefix produces matching title, alias, and metadata results without pressing Enter.
- `underw` returns **Insurance & underwriting** and relevant artifacts in the correct groups.
- Multi-term queries require all terms before recovery results are considered.
- Exact title matches outrank prefix, metadata, and fuzzy matches within their category.
- Ranking and tie-breaking are deterministic.

### Grouping and action

- Results are visibly and semantically grouped into subject areas, workflows, agents, forms, and documents.
- Empty groups are hidden unless explicitly filtered.
- Each result opens the correct Ladder destination and uses the type-specific action label.
- Back navigation restores the prior search state, scroll position, and focus.

### Refinement

- Type, subject, and modality refinements update counts and results without clearing the query.
- The URL represents query and filter state.
- Clearing filters preserves the query; clearing the query returns to browse mode.

### Accessibility

- The complete experience is operable using only the keyboard.
- Result changes and no-result states are announced without excessive repetition.
- At 200% zoom, no horizontal document overflow appears and all primary actions remain visible.
- Light theme, dark theme, high contrast, and reduced motion retain complete meaning and visible focus.

### Reliability

- Search works offline after the app has loaded.
- Failure to load the search index does not block normal catalog browsing.
- Catalog generation rejects invalid destinations and duplicate result keys.

## Example journey

A user opens Ladder and types `claim approv` into the single search field.

1. The field remains focused while results update.
2. Ladder shows **Insurance & underwriting** under Subject areas because its catalog terms include claims.
3. Workflows shows claim-review and decision-gate templates whose titles, descriptions, or node roles contain both concepts.
4. Agents shows claim reviewers and approval specialists.
5. Forms shows claim decision and approval forms.
6. Documents shows claim-file contracts only when both query terms are represented; otherwise they appear in the labeled recovery set.
7. The user chooses **Open form** on the claim decision form.
8. The form studio opens. When the user returns to the library, `claim approv`, the prior group expansions, scroll position, and keyboard focus are restored.

This is the intended feeling of the feature: one incomplete thought turns into a structured, trustworthy map of everything Ladder can offer.
