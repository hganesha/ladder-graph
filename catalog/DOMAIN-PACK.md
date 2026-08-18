# Domain expansion pack

Status: proposed catalog addition, generated against the checked-in `catalog/` contract
Companion documents: [ladder-graph-library-expansion.md](ladder-graph-library-expansion.md), [ladder-graph-specs.md](ladder-graph-specs.md)

---

## 1. What this pack adds

| | Before | Added | After |
| --- | ---: | ---: | ---: |
| Workflow templates | 29 | 70 | 99 |
| Agent templates | 119 | 192 | 311 |
| Subject areas | 15 | 31 | 46 |
| Role categories | 10 | 9 | 19 |

Every file is canonical `catalog/` YAML registered in `catalog/manifest.json`, so `npm run catalog:generate` picks the pack up with no bespoke adapter and no TypeScript change beyond the nine new role categories.

## 2. Primitive coverage

The expansion proposal's finding was that 8 of 14 node kinds, 0 of 4 aggregation strategies, 0 of 7 transform operations, 0 of 4 group configurations, and 0 of 3 teacher feedback modes were demonstrated by any shipped template. This pack closes all five gaps.

| Surface | Coverage in this pack |
| --- | --- |
| Node kinds | 14 of 14 — `agent` (229), `aggregator` (42), `approval` (77), `condition` (69), `evaluate` (30), `group` (13), `input` (70), `join` (8), `loop` (15), `output` (70), `subgraph` (5), `teacher` (17), `tool` (13), `transform` (61) |
| Aggregation strategies | 4 of 4 — `collect` (15), `concat` (5), `merge` (10), `vote` (12) |
| Transform operations | 7 of 7 — `deduplicate` (7), `filter` (8), `merge` (5), `rename` (5), `select` (17), `slice` (9), `sort` (10) |
| Group configurations | 4 of 4 — `parallel/aggregate` (5), `parallel/serialize` (1), `sequential/aggregate` (1), `sequential/serialize` (6) |
| Teacher feedback modes | 3 of 3 — `critique` (6), `rubric` (6), `score` (5) |

Selection rule applied per the proposal: a template earns its place only if it opens value the library cannot currently serve **and** exercises a primitive, strategy, or shape nothing else exercises. Every workflow below names the primitive it lights up.

The three core patterns the proposal asked for first are present as reusable shapes rather than one-off templates: blind dual read → discordance resolution (4 workflows), independent re-derivation (7), and the verified citation/claim gate (6).

Three further shapes were added for safety-critical operations, where the decision structure itself is the control:

| Shape | What it encodes | Used by |
| --- | --- | --- |
| Barrier verification + hard stop | Each barrier verified by a separate agent against its own evidence; results are source-tagged by `aggregator: collect`, and a single unverified barrier routes to a rectification path that never reaches the release approval. Release requires two approvals in order. | 3 workflows |
| Ordered authority chain | Preparation runs as a sequential/serialize `group`, a conflict check deconflicts simultaneous activity, then three `approval` nodes fire in the order the procedure requires — the chain cannot be reordered or skipped. | 2 workflows |
| Go / hold / no-go + contingency | Assessment against criteria declared before the decision point, a four-branch `condition`, a bounded hold-and-reassess `loop`, and a pre-planned contingency path so no-go is a planned outcome rather than a failure. | 2 workflows |

Three more were added for creative critique on typed media contracts, where the input is an asset rather than text:

| Shape | What it encodes | Used by |
| --- | --- | --- |
| Blind critique panel + synthesis | Each dimension is critiqued independently on the same asset, `aggregator: collect` keeps every observation attributable to the dimension it came from, and a `teacher: critique` weighs them against the maker's stated intent instead of returning an undifferentiated list. | 1 workflow |
| Cull + ordered sequence | `transform: deduplicate` collapses near-identical takes, sort and slice cut to length, and `aggregator: concat` assembles the surviving pieces in declared viewing order for a critique of the sequence rather than of individual pieces. | 1 workflow |
| Outlier vote + rework loop | Reviewers call outliers against a reference independently, `aggregator: vote` keeps a contested item contested, and a bounded `loop` reworks until the set coheres. | 1 workflow |

Media contracts in this pack: `image` 2, `mixed` 4, `document` 48, `text` 16. The photography area is the first place in the library where the input contract carries an asset, its rights and provenance field, and the workflow fields together.

## 3. Areas, workflows, and agents

### Business operations & enterprise

#### Supply chain & logistics

`research/operations/supply-chain` — Demand Forecast Analyst, Inventory Policy Planner, Network & Route Optimizer, Supplier Risk Analyst, Logistics Exception Controller, S&OP Reconciler

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Demand forecast + independent tie-out | Dual derivation + tie-out | `tool` node, `transform: select`, `aggregator: vote` on scalars |
| Disruption triage + recovery routing | Scored queue + routing | `transform: filter` / `sort` / `slice`, `join: first` |

#### HR & talent operations

`research/operations/talent` — Talent Sourcing Researcher, Structured Screening Interviewer, Selection Fairness Reviewer, Onboarding Program Designer, Workforce Capacity Planner, Compensation Band Analyst

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Blind screening panel + rubric calibration | Blind panel + teacher loop | `group` (parallel), `teacher: rubric`, bounded `loop` |
| Role opening → ramped hire | Sequential group + subgraph | `group` (sequential), `subgraph` |

#### Sales & business development

`research/operations/revenue` — Account Research Analyst, Opportunity Qualification Analyst, Outreach Sequence Designer, Deal Desk Reviewer, Pipeline Hygiene Auditor, Competitive Position Strategist

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Account research + claim verification gate | Verification fan-out + collect | `transform: deduplicate`, `aggregator: collect` |
| Deal desk review + position merge | Position merge + collisions | `aggregator: merge` with collision surfacing |

#### Customer success & support

`research/operations/support` — Support Triage Classifier, Resolution Specialist, Escalation Manager, Knowledge Base Curator, Churn Risk Analyst, Voice-of-Customer Synthesizer

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Ticket triage → resolution or escalation | Scored queue + routing | `transform: filter` / `sort` / `slice`, `join: first` |
| Knowledge base refresh + scored review | Normalize + scored gate | `transform: rename`, `teacher: score` |

#### Marketing & growth

`research/operations/growth` — Campaign Strategist, Experiment Designer, SEO & Discovery Analyst, Channel Distribution Planner, Brand & Claims Reviewer, Growth Lift Analyst

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Experiment readout + statistical tie-out | Dual derivation + tie-out | `tool` node, `transform: select`, `aggregator: vote` on scalars |
| Campaign assembly + teacher critique | Ordered assembly + critique | `aggregator: concat`, `teacher: critique` |

#### Accounting, tax & audit

`research/operations/finance-ops` — Transaction Classification Analyst, Reconciliation Analyst, Tax Position Researcher, Internal Control Tester, Audit Evidence Reviewer, Disclosure & Reporting Reviewer

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Close reconciliation + exception register | Merge transform + exceptions | `transform: merge`, `aggregator: collect` |
| Two-person review + discordance resolution | Blind panel + vote | `aggregator: vote` with ties preserved, multi-branch `condition` |

### Physical industries & infrastructure

#### Manufacturing & industrial operations

`research/industry/manufacturing` — Reliability & Maintenance Engineer, Process Quality Engineer, Production Line Optimizer, FMEA Facilitator, Manufacturing Process Validator, Supplier Quality Engineer

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Predictive maintenance call + instrument tie-out | Tool run + bounded loop | `tool` node, `aggregator: merge`, bounded `loop` |
| New line qualification | Sequential group + subgraph | `group` (sequential), `subgraph` |

#### Energy & utilities

`research/industry/energy` — Renewable Generation Forecaster, Grid Balancing Analyst, Outage Response Coordinator, Asset Health & Investment Planner, Demand Response & Flexibility Analyst, Energy Regulatory & Compliance Analyst

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Renewable forecast + reserve tie-out | Dual derivation + tie-out | `tool` node, `transform: select`, `aggregator: vote` on scalars |
| Balancing scenario + contingency run | Tool run + bounded loop | `tool` node, `aggregator: merge`, bounded `loop` |

#### Transportation & mobility

`research/industry/mobility` — Fleet Operations Analyst, Traffic & Network Coordinator, Routing & Dispatch Engineer, Autonomy Safety Case Analyst, Transit Service Planner, Mobility Incident Analyst

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Fleet record reconciliation + exception register | Merge transform + exceptions | `transform: merge`, `aggregator: collect` |
| Network incident triage + dispatch | Scored queue + routing | `transform: filter` / `sort` / `slice`, `join: first` |

#### Real estate & construction

`research/industry/built-environment` — Property Valuation Analyst, Permit & Entitlement Analyst, Construction Cost Estimator, Project Scheduler, Construction Risk & Contract Reviewer, Building Performance Analyst

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Valuation + independent re-derivation | Dual derivation + tie-out | `tool` node, `transform: select`, `aggregator: vote` on scalars |
| Design review + position merge | Position merge + collisions | `aggregator: merge` with collision surfacing |

#### Agriculture & food systems

`research/industry/agriculture` — Agronomic Decision Analyst, Remote Crop Monitoring Analyst, Precision Application Planner, Food Traceability Analyst, Food Safety & Compliance Reviewer, Yield & Margin Analyst

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Field signal → prescription with scored review | Normalize + scored gate | `transform: rename`, `teacher: score` |
| Lot trace reconciliation + exception register | Merge transform + exceptions | `transform: merge`, `aggregator: collect` |

### Science, engineering & research adjacent

#### Chemistry & materials science

`research/applied-science/chemistry` — Molecular Design Chemist, Synthesis Route Planner, Materials Characterization Analyst, Process Chemistry Scale-Up Engineer, Laboratory Safety & Compliance Reviewer, Experimental Design Statistician

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Property prediction + computational run | Tool run + bounded loop | `tool` node, `aggregator: merge`, bounded `loop` |
| Synthesis route → reviewed protocol | Sequential group + subgraph | `group` (sequential), `subgraph` |

#### Biology & bioinformatics

`research/applied-science/biology` — Genomic Variant Interpreter, Bioinformatics Pipeline Analyst, Pathway & Systems Modeler, Laboratory Protocol Designer, Biostatistics Reviewer, Research Data Steward

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Blind dual variant read + discordance resolution | Blind panel + vote | `aggregator: vote` with ties preserved, multi-branch `condition` |
| Sequence analysis + scored QC gate | Normalize + scored gate | `transform: rename`, `teacher: score` |

#### Environmental & climate science

`research/applied-science/environment` — Emissions Inventory Analyst, Climate Impact Modeler, Conservation Planner, Environmental Compliance Analyst, Disaster Risk & Response Analyst, Environmental Data Quality Analyst

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Emissions inventory + independent tie-out | Dual derivation + tie-out | `tool` node, `transform: select`, `aggregator: vote` on scalars |
| Scope consolidation + double-count register | Merge transform + exceptions | `transform: merge`, `aggregator: collect` |

#### Astronomy & space

`research/applied-science/astronomy` — Observation Scheduler, Astrophysical Data Reduction Analyst, Mission & Trajectory Analyst, Satellite Operations Analyst, Instrument Calibration Specialist, Science Case Writer

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Observation queue + feasibility routing | Scored queue + routing | `transform: filter` / `sort` / `slice`, `join: first` |
| Measurement + model comparison | Tool run + bounded loop | `tool` node, `aggregator: merge`, bounded `loop` |

#### Geospatial & earth observation

`research/applied-science/geospatial` — Remote Sensing Analyst, Geospatial Data Engineer, Land Use & Urban Analyst, Cartographic Communicator, Ground Truth & Validation Analyst, Geospatial Privacy Reviewer

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Land-use claim verification gate | Verification fan-out + collect | `transform: deduplicate`, `aggregator: collect` |
| Layer normalization + scored release review | Normalize + scored gate | `transform: rename`, `teacher: score` |

### Creative, social & cultural

#### Gaming & interactive media

`research/creative/games` — Game Systems Designer, NPC Behavior Designer, Procedural Content Designer, Narrative Designer, Playtest Research Lead, Live Balance Analyst

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Playtest panel + rubric calibration | Blind panel + teacher loop | `group` (parallel), `teacher: rubric`, bounded `loop` |
| Content beat assembly + teacher critique | Ordered assembly + critique | `aggregator: concat`, `teacher: critique` |

#### Film, video & post-production

`research/creative/film` — Post Pipeline Supervisor, Editorial Story Analyst, VFX Shot Planner, Colour & Finishing Specialist, Sound Design & Mix Lead, Delivery QC Reviewer

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Cut → delivery pipeline | Sequential group + subgraph | `group` (sequential), `subgraph` |
| Reel assembly + teacher critique | Ordered assembly + critique | `aggregator: concat`, `teacher: critique` |

#### Fashion & textiles

`research/creative/fashion` — Trend Research Analyst, Materials & Sustainability Specialist, Technical Design & Fit Specialist, Sourcing & Supplier Analyst, Merchandise Planner, Product Compliance Reviewer

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Line direction + position merge | Position merge + collisions | `aggregator: merge` with collision surfacing |
| Tech pack normalization + scored review | Normalize + scored gate | `transform: rename`, `teacher: score` |

#### Social sciences & policy

`research/creative/social-policy` — Survey Methodologist, Qualitative Coding Analyst, Public Opinion Analyst, Policy Impact Modeler, Research Ethics Reviewer, Evidence Synthesis Reviewer

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Coder reliability + rubric calibration | Blind panel + teacher loop | `group` (parallel), `teacher: rubric`, bounded `loop` |
| Policy claim verification gate | Verification fan-out + collect | `transform: deduplicate`, `aggregator: collect` |

#### Linguistics & language preservation

`research/creative/linguistics` — Field Documentation Linguist, Phonological & Morphological Analyst, Corpus & Lexicography Specialist, Translation & Localization Reviewer, Dialect & Variation Analyst, Language Revitalization Planner

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Documentation claim verification gate | Verification fan-out + collect | `transform: deduplicate`, `aggregator: collect` |
| Learner material assembly + teacher critique | Ordered assembly + critique | `aggregator: concat`, `teacher: critique` |

### Specialized professional services

#### Insurance & underwriting

`research/professional/insurance` — Claims Adjuster, Underwriting Risk Analyst, Actuarial Reviewer, Fraud Detection Analyst, Policy Wording Analyst, Catastrophe Exposure Modeler

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Blind dual claim review + discordance resolution | Blind panel + vote | `aggregator: vote` with ties preserved, multi-branch `condition` |
| Alert triage + investigation routing | Scored queue + routing | `transform: filter` / `sort` / `slice`, `join: first` |

#### Event planning & hospitality

`research/professional/events` — Venue & Logistics Coordinator, Vendor & Contract Manager, Guest Experience Designer, Event Production Scheduler, Event Risk & Safety Planner, Event Budget Controller

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Venue and vendor selection + position merge | Position merge + collisions | `aggregator: merge` with collision surfacing |
| Brief → run of show | Sequential group + subgraph | `group` (sequential), `subgraph` |

#### Quality assurance & compliance

`research/professional/compliance` — Regulatory Change Monitor, Control Design Analyst, Audit Evidence Collector, Certification Readiness Assessor, Nonconformance & CAPA Analyst, Quality Management Reviewer

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Audit rubric calibration | Blind panel + teacher loop | `group` (parallel), `teacher: rubric`, bounded `loop` |
| Regulatory change → verified obligations | Verification fan-out + collect | `transform: deduplicate`, `aggregator: collect` |

#### DevOps & site reliability

`research/software/reliability` — Incident Commander, Reliability Diagnostician, Capacity & Performance Planner, Deployment & Release Engineer, Observability Engineer, Postmortem Facilitator

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Alert triage → incident response | Scored queue + routing | `transform: filter` / `sort` / `slice`, `join: first` |
| Capacity plan + load test tie-out | Tool run + bounded loop | `tool` node, `aggregator: merge`, bounded `loop` |

### Emerging & cross-cutting

#### Robotics & embodied AI

`research/emerging/robotics` — Manipulation Planning Engineer, Multi-Robot Coordination Engineer, Robot Perception Engineer, Robot Safety Engineer, Simulation & Sim-to-Real Analyst, Deployment Readiness Assessor

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Manipulation plan + hardware tie-out | Tool run + bounded loop | `tool` node, `aggregator: merge`, bounded `loop` |
| Blind safety case review + discordance resolution | Blind panel + vote | `aggregator: vote` with ties preserved, multi-branch `condition` |

#### Scientific peer review & publishing

`research/emerging/peer-review` — Manuscript Triage Editor, Reviewer Matching Analyst, Methods & Statistics Reviewer, Reproducibility Analyst, Research Integrity Screener, Editorial Decision Writer

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Reviewer calibration panel | Blind panel + teacher loop | `group` (parallel), `teacher: rubric`, bounded `loop` |
| Reproducibility + citation verification gate | Verification fan-out + collect | `transform: deduplicate`, `aggregator: collect` |

#### Crisis & emergency management

`research/emerging/crisis` — Emergency Dispatch Coordinator, Scenario Simulation Analyst, Resource & Logistics Officer, Public Information Officer, Situation Assessment Analyst, Recovery & Continuity Planner

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Incident intake → dispatch with coverage gate | Scored queue + routing | `transform: filter` / `sort` / `slice`, `join: first` |
| Multi-agency resource reconciliation | Merge transform + exceptions | `transform: merge`, `aggregator: collect` |

### Safety-critical operations

#### Airline flight operations

`research/aviation/flight-operations` — Flight Dispatcher, Flight Planning & Fuel Analyst, Aviation Meteorologist, Aircraft Performance Engineer, NOTAM & Airspace Compliance Analyst, Crew Legality & Fatigue Analyst, MEL & Airworthiness Controller, Flight Safety & FDM Analyst

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Dispatch release + barrier verification | Barrier verification + hard stop | `aggregator: collect` per barrier, blocking `condition`, two sequential `approval` nodes |
| Fuel plan + independent re-derivation | Dual derivation + tie-out | `tool` node, `transform: select`, `aggregator: vote` on scalars |
| Departure go / hold / no-go | Go / hold / no-go + contingency | multi-branch `condition`, bounded `loop` hold, planned contingency path |
| Deferral and maintenance release authority chain | Ordered authority chain | `group` (sequential/serialize), three ordered `approval` nodes |

#### Oil & gas drilling & well operations

`research/wells/drilling` — Well Planning Engineer, Directional Drilling & Anti-Collision Analyst, Geomechanics & Pore Pressure Analyst, Well Control & Barrier Engineer, Casing & Cementing Engineer, Drilling Performance Engineer, Well Integrity & Abandonment Analyst, Drilling HSE & Permit Coordinator

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Anti-collision clearance + independent re-derivation | Dual derivation + tie-out | `tool` node, `transform: select`, `aggregator: vote` on scalars |
| Well control barrier verification | Barrier verification + hard stop | `aggregator: collect` per barrier, blocking `condition`, two sequential `approval` nodes |
| Permit to work + simultaneous operations gate | Ordered authority chain | `group` (sequential/serialize), three ordered `approval` nodes |
| Drill-ahead go / hold / no-go | Go / hold / no-go + contingency | multi-branch `condition`, bounded `loop` hold, planned contingency path |

### Creative, social & cultural

#### Photography

`research/visual/photography` — Lighting & Exposure Critic, Composition & Framing Analyst, Perspective & Lens Advisor, Focus & Technical Quality Inspector, Colour & Tone Grading Reviewer, Retouching & Disclosure Reviewer, Photo Editor & Sequencing Specialist, Brief, Rights & Deliverable Compliance Checker

| Workflow | Topology | Primitive it lights up |
| --- | --- | --- |
| Blind critique panel on a single frame | Blind critique panel + synthesis | **`image` contract**, `aggregator: collect` by dimension, `teacher: critique`, `transform: sort` |
| Fix in camera or fix in post | Scored queue + routing | `transform: filter` / `sort` / `slice`, `join: first` |
| Cull, edit, and sequence a shoot | Cull + ordered sequence | **`mixed` contract**, `transform: deduplicate/sort/slice`, `aggregator: concat`, `teacher: critique` |
| Grade consistency across a set | Outlier vote + rework loop | **`mixed` contract**, `aggregator: vote` with ties preserved, bounded `loop` |
| Commercial delivery gate | Barrier verification + hard stop | `aggregator: collect` per barrier, blocking `condition`, two sequential `approval` nodes |
| Development loop against stated intent | Blind panel + teacher loop | `group` (parallel), `teacher: rubric`, bounded `loop` |

## 4. Guardrails

Every workflow ends at a named professional-review `approval` node listed in `spec.policies.requireApprovalFor`, positioned so the released output cannot bypass it. Areas touching regulated or consequential decisions carry their non-claim in the workflow objective, which survives compilation into every target — the variant interpretation workflow states that it structures interpretation for a qualified professional and is not a diagnostic device; the dispatch release and well control workflows state that they structure verification for licensed or accountable personnel and do not themselves authorize a flight or an operation.

Roles handling personal or health data declare `pii-restricted` or `phi-restricted` permissions; roles that can affect physical systems or people declare `explicit-authorization-required`. A reviewer reads the handling constraint off the node rather than inferring it from the prompt.

Where a workflow depends on a deterministic calculation, simulation, or instrument run, it declares a `tool` node whose summary states plainly that Ladder Graph does not execute it — closing the prose-only tooling gap the proposal identified. The aviation and well-control tool nodes go further and state that no computed figure may be presented as a certified performance result or a survey of record. Consistent with the product line, every catalog entry remains an authoring suggestion: Ladder Graph does not inspect configuration, install skills, or verify that any declared capability exists.

## 5. Applying the pack

```sh
npm run catalog:generate   # regenerates src/generated/catalog.ts from catalog/
npm run check              # typecheck, tests, build
```

`scripts/generate-catalog-index.mjs` asserts that the files on disk match `catalog/manifest.json` exactly. This pack was validated against that assertion, against the checked-in JSON Schema at `public/schema/lgir-v1alpha1.schema.json`, and against the TypeScript parity compiler in `src/compiler/fallback.ts`: 70 of 70 workflows analyze with zero errors and zero warnings.
