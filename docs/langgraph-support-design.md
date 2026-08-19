# Supporting LangGraph code generation

Status: research and implementation proposal
Research date: 2026-08-16
Recommended first target: `langgraph-python`

## Executive answer

Adding a LangGraph target to this compiler is **straightforward at the adapter and UI layers, but moderate at the semantic layer**.

The existing architecture is already favorable:

- LGIR has nodes, edges, control branches, joins, bounded loops, approvals, groups, aggregators, and subgraphs.
- Compilation is already target-specific and deterministic.
- The Rust compiler and its committed WebAssembly build expose the same compile-result contract.
- Generated Python and TypeScript modules already embed normalized workflow data, a stable node order, dependencies, and capability declarations.

LangGraph's `StateGraph` is also a strong conceptual match: it combines a shared state schema with executable node functions, fixed edges, conditional edges, `START`/`END`, reducers for parallel state updates, and a compile step. The official Python API describes a node as `State -> Partial<State>` and requires a `StateGraph` builder to be compiled before invocation. See the [Python `StateGraph` reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) and [Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api).

The main difficulty is that LGIR currently describes some behavior in natural language while LangGraph needs executable callables. In particular, `prompt`, `config.expression`, `exitCondition`, tool identifiers, and subgraph intent are data, not safe Python code. The compiler must preserve that boundary and generate explicit handler/router interfaces rather than turn strings into executable code.

For one engineer familiar with this repository:

| Delivery level | Scope | Estimated effort |
| --- | --- | --- |
| Topology proof of concept | New target, `StateGraph`, fixed edges, host-supplied node handlers, simple conditional routers | 2-4 working days |
| Trustworthy Python MVP | Strict diagnostics, parallel state reducer, `join: all`, handler/router contracts, output assembly, Rust/WASM verification, MCP/UI support, tests | 1-2 weeks |
| Broad LGIR coverage | Bounded-loop lowering, approvals with interrupts, groups, aggregators, `allSettled`, stronger schemas | 3-5 weeks total |
| Python and TypeScript parity plus deployable bundles | LangGraph.js adapter, multi-file output or archive, deployment config, compatibility tests | 5-8 weeks total |

These are implementation estimates, not elapsed-time commitments. The adapter itself is small; semantic validation and parity testing account for most of the work.

## Recommendation

Add a new `langgraph-python` target. Do **not** change the existing `python` target.

The current `python` artifact explicitly promises deterministic workflow data and no runtime calls. Turning it into executable LangGraph code would be a breaking change and would weaken the product's existing safety language. A separate target makes the distinction visible:

- `python`: inert, importable Ladder Graph data module.
- `langgraph-python`: executable graph topology with explicit host-provided behavior.
- Later, `langgraph-typescript`: the equivalent `@langchain/langgraph` output.

Start with Python because the Python `StateGraph` API is mature, its shared-state and reducer model maps cleanly to LGIR, and a single generated `.py` module fits the existing one-artifact `CompileResult`. LangGraph.js is viable as a second adapter; its official API uses `StateSchema`, `StateGraph`, `addNode`, `addEdge`, and `addConditionalEdges`. See the [JavaScript Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api).

## What the current baseline provides

The relevant implementation is compact and already organized around adapters:

- `src/types.ts` defines the target union and LGIR types.
- `crates/lgir-core/src/lib.rs` contains the canonical Rust validation and emitters.
- `src/compiler/worker.ts` runs the committed WebAssembly compiler and reports initialization failures explicitly.
- `src/components/StudioHeader.tsx` and `src/components/OutputPanel.tsx` expose target selection and artifact download.
- `crates/ladder-catalog/src/lib.rs` and `crates/ladder-graph-mcp/src/server.rs` validate target names for catalog/MCP compilation.
- `tests/compiler.test.ts` and the Rust tests already check deterministic output and adapter behavior.

No parser rewrite or graph-editor rewrite is required for the first target. The existing LGIR remains the source language; LangGraph is an output adapter.

Target behavior has one production authority in Rust. A production compiler change must update the Rust implementation and tests, then regenerate and verify the committed WebAssembly artifact.

## Evidence from the bundled workflows

The 93 canonical workflow YAML files currently contain:

| Construct | Count |
| --- | ---: |
| Agent nodes | 317 |
| Approval nodes | 87 |
| Condition nodes | 78 |
| Control edges | 235 |
| Transform nodes | 54 |
| Aggregator nodes | 38 |
| Join nodes | 36 |
| Bounded loop nodes | 22 |
| Teacher nodes | 14 |
| Group nodes | 12 |
| Subgraph nodes | 5 |

The 36 joins break down into 22 `all`, 12 `first`, and 2 `allSettled`. This matters: a basic fixed-edge adapter would compile many simple graphs, but it would not truthfully support a large share of the library. Approvals and conditions are especially common and should be in the first production milestone or clearly rejected by target-specific diagnostics.

## Semantic mapping

| LGIR construct | LangGraph lowering | Proposed status |
| --- | --- | --- |
| Workflow input | A small generated input node reached from `START`, storing validated host input in shared state | MVP |
| Workflow output | A generated output node that collects named dependency results, followed by `END` | MVP |
| Agent, tool, evaluate, teacher | `add_node`/`addNode` wrapper around a required host handler keyed by node ID | MVP |
| Dependency edge | Fixed `add_edge` scheduling edge | MVP |
| Data edge | Fixed scheduling edge plus source result lookup in shared state; contract remains metadata initially | MVP, contract validation later |
| Condition node and control edges | `add_conditional_edges` with a host router returning a declared branch token and a generated path map | MVP |
| Parallel fan-out | Multiple outgoing fixed edges; LangGraph schedules destinations in the next superstep | MVP |
| `join: all` | One waiting edge from the complete list of upstream nodes, then an optional no-op join node | MVP |
| `join: allSettled` | Per-node error capture plus a barrier that receives success/error envelopes | Later |
| `join: first` | Race/cancellation policy not represented directly by ordinary `StateGraph` edges | Unsupported initially |
| Aggregator | Generated deterministic reducer node for `collect`, `concat`, `merge`, or `vote` over upstream results | Later or MVP handler fallback |
| Transform | Host handler initially; the operation name is safe but the current expression is free-form text | MVP handler fallback |
| Approval | Generated node calling `interrupt()`, requiring a checkpointer and `thread_id`, then resumed with `Command` | Later milestone |
| Bounded loop | Conditional back-edge plus a generated iteration counter and hard `maxIterations` guard | Later milestone after loop semantics are tightened |
| Sequential group | Flatten to member edges in declared order plus a synthesized group exit | Later milestone |
| Parallel group | Fan out to members and synthesize an all-members barrier before group exit | Later milestone |
| Subgraph | Compiled graph as a node, with explicit parent/child state mapping and persistence mode | Blocked on LGIR schema extension |
| Capabilities and permissions | Immutable node metadata passed to the handler; never interpreted as ambient authority | MVP |
| `workingDirectory` | Handler metadata only; the generated graph does not change process directories | MVP |

LangGraph supports multiple fixed outgoing edges as parallel work in a subsequent superstep. It also supports a list of start nodes in Python `add_edge`; the destination waits for all of them, which is the correct basis for `join: all`. See [`add_edge`](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_edge). Conditional edges can return one or more destinations and can use a path map, which is a direct match for declared LGIR branch tokens. See [`add_conditional_edges`](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_conditional_edges).

### Why some mappings are not automatic

#### Natural-language conditions are not code

Examples in the catalog include expressions such as `the requested work conflicts with an active operation under simultaneous operations rules`. The compiler must not emit `eval`, attempt to translate prose into Python, or silently choose a branch.

The generated module should require a router callable for every condition:

```python
Router = Callable[["LadderState", "NodeSpec"], str]

routers = {
    "n-conflict": route_conflict,
}
```

The generated path map restricts the router's return value to the branch tokens declared by LGIR control edges. Unknown tokens raise a descriptive error.

#### Node prompts are specifications, not implementations

An agent node's prompt, tool list, connector list, and permission declarations should be passed to a host-supplied handler. The compiler should not choose a model provider, instantiate a LangChain agent, contact a connector, or broaden permissions.

This keeps the current security model intact while still producing a genuinely executable graph once the application binds handlers.

#### Shared state needs a reducer

Parallel nodes can update state in the same superstep. A generated `results` mapping therefore needs a reducer that merges per-node result entries:

```python
class LadderState(TypedDict, total=False):
    inputs: dict[str, Any]
    results: Annotated[dict[str, Any], merge_result_maps]
    output: Any
    routes: Annotated[dict[str, str], merge_maps]
    iterations: Annotated[dict[str, int], merge_maps]
    approvals: Annotated[dict[str, Any], merge_maps]
    errors: Annotated[dict[str, str], merge_maps]
```

LangGraph state keys support reducer annotations; without a reducer, updates overwrite the prior value. See the official [state and reducer guide](https://docs.langchain.com/oss/python/langgraph/use-graph-api#process-state-updates-with-reducers).

The reducer must be deterministic. Every normal node writes only `{node_id: result}`. Re-execution of the same node may replace its prior value, while concurrent writes from distinct node IDs merge. Target-specific validation should reject graph shapes that could cause ambiguous concurrent writes for the same node ID.

## Proposed generated Python contract

The first production artifact should be one importable module such as `workflow-name.langgraph.py` containing:

1. The normalized LGIR and compile metadata.
2. Typed state, node specification, handler, and router protocols.
3. Deterministic state reducers.
4. Generated wrappers for input, output, condition, join, and bound handlers.
5. `build_graph(handlers, routers, *, checkpointer=None)` returning a compiled graph.
6. A `required_bindings()` helper listing missing node handlers and routers.
7. No provider imports, secrets, network calls, dynamic evaluation, or implicit tool access.

An abbreviated shape is:

```python
from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Annotated, Any, TypedDict

from langgraph.graph import END, START, StateGraph


def merge_result_maps(
    current: dict[str, Any], update: dict[str, Any]
) -> dict[str, Any]:
    return {**current, **update}


class LadderState(TypedDict, total=False):
    inputs: dict[str, Any]
    results: Annotated[dict[str, Any], merge_result_maps]
    output: Any


def build_graph(
    handlers: Mapping[str, Callable[[LadderState, dict[str, Any]], Any]],
    routers: Mapping[str, Callable[[LadderState, dict[str, Any]], str]],
    *,
    checkpointer: Any = None,
):
    require_bindings(handlers, routers)
    builder = StateGraph(LadderState)

    builder.add_node("research", bind_handler("research", handlers))
    builder.add_node("review", bind_handler("review", handlers))
    builder.add_node("quality-gate", bind_router_node("quality-gate", routers))
    builder.add_node("workflow-output", build_output_node("workflow-output"))

    builder.add_edge(START, "research")
    builder.add_edge("research", "review")
    builder.add_edge("review", "quality-gate")
    builder.add_conditional_edges(
        "quality-gate",
        route("quality-gate", routers),
        {"pass": "workflow-output", "revise": "research"},
    )
    builder.add_edge("workflow-output", END)
    return builder.compile(checkpointer=checkpointer)
```

The actual emitter should generate string literals and tables rather than Python function names derived from node IDs. This avoids identifier-sanitization problems and keeps output stable.

## Target-specific validation

The existing validator should remain target-neutral where possible. `analyze(source, "langgraph-python")` should add LangGraph-specific diagnostics before emission.

Recommended checks:

- Every condition node has at least one outgoing control edge.
- Condition branch tokens are unique and exactly match outgoing control-edge conditions.
- A default branch is explicit when not all router outcomes are closed.
- Static edges and conditional edges are not both emitted from the same source unless the behavior is intentional. LangGraph's `Command` and conditional routing add dynamic paths; static edges still execute.
- `join: all` has at least two distinct upstream nodes and is lowered as one waiting edge, not separate edges.
- `join: first` is an error for the initial target.
- `join: allSettled` is an error until error-envelope semantics are implemented.
- Any control edge leaving a non-condition/non-approval/non-loop router source must have an explicit lowering.
- Input and output schemas use the supported JSON Schema subset; unsupported schema features remain embedded metadata and produce a warning.
- Every agent/tool/evaluate/teacher node is listed in required handler bindings.
- Every condition is listed in required router bindings.
- Loops, groups, and subgraphs fail compilation until their lowering is implemented; they must not be silently flattened.
- A workflow containing approval nodes requires `build_graph` to enforce a non-null checkpointer.

New diagnostics should use stable codes, for example:

- `LG310`: LangGraph target does not yet support this node/join policy.
- `LG311`: condition branch and control-edge tokens do not agree.
- `LG312`: required router source is ambiguous.
- `LG313`: approval workflow requires a checkpointer.
- `LG314`: loop body cannot be lowered safely.
- `LG315`: subgraph lacks a graph reference or state mapping.

Strict failure is preferable to runnable-looking code that changes the workflow's meaning.

## Loops need a small LGIR clarification

LangGraph natively supports cycles through conditional edges and uses a recursion limit as a safety net. The official guides recommend an explicit termination condition and show a conditional back-edge; see the [Python Graph API guide](https://docs.langchain.com/oss/python/langgraph/use-graph-api) and [JavaScript Graph API guide](https://docs.langchain.com/oss/javascript/langgraph/use-graph-api).

LGIR's loop node is intentionally acyclic at the document level and names a `body`, `exitCondition`, `maxIterations`, and exhaustion policy. That is sufficient for instruction generation, but not always sufficient for unambiguous runtime lowering. The current catalog can reference body nodes that also appear on the main path before the loop node. Before implementing loop codegen, define and validate:

- the loop entry node;
- the body exit/router node;
- whether `body` order is authoritative or edges inside the body are authoritative;
- which state value the host router returns;
- the target after successful exit;
- the target for each `onExhausted` policy;
- whether body nodes may have incoming/outgoing edges outside the loop boundary.

A backward-compatible approach is to treat `body` as ordered for v1alpha1, require a single external entry and exit, and synthesize the back-edge. The generated router first checks the host exit predicate, then checks the compiler-managed iteration counter. `maxIterations` must be enforced by generated code even if the host router is faulty.

Do not rely only on LangGraph's recursion limit: that limit counts supersteps, not LGIR loop iterations, so the values are not equivalent.

## Approvals and persistence

LGIR approval nodes map naturally to LangGraph interrupts. `interrupt()` pauses execution, persists state, and is resumed by invoking with `Command(resume=...)`. Official documentation states that human-in-the-loop execution requires a checkpointer and a `thread_id`; see [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts) and [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence).

The generated approval node should:

- emit a JSON-serializable approval request containing node ID, name, summary, and declared next action;
- call `interrupt()` before any non-idempotent side effect;
- record the resume value in `approvals[node_id]`;
- route only through declared approval control edges;
- require the host to provide a checkpointer at build time and a thread ID at invocation time.

The compiler should not select an in-memory or production checkpointer. That is a host deployment decision.

## Subgraphs require an LGIR extension

LangGraph can add a compiled subgraph as a node and has explicit persistence choices for subgraphs. The parent and child may share state keys or use an adapter function when their schemas differ. See [Use subgraphs](https://docs.langchain.com/oss/python/langgraph/use-subgraphs).

The current `subgraph` node kind has no field that identifies the child graph, embeds child LGIR, maps parent/child state, or selects persistence. A safe adapter therefore cannot infer a subgraph.

Suggested future configuration:

```yaml
config:
  subgraph:
    ref: ladder://workflows/research-pass
    inputMap:
      request: inputs.request
    outputMap:
      result: results.research-pass
    checkpointer: inherit
```

The reference should resolve only through an explicit compiler/catalog input. It must not fetch remote content during browser compilation.

## Compiler and UI changes

### Milestone 1: strict Python MVP

Add `langgraph-python` to:

- the TypeScript `Target` union;
- desktop target selectors and download labels;
- capability catalog target metadata;
- Rust compiler target validation and title/MIME/filename handling;
- catalog and MCP target allowlists/descriptions;
- compiler tests, Rust tests, UI tests, and MCP tests;
- README, specification, help text, and capability reporting.

Add a dedicated Rust lowering layer rather than extending the current `compile_python` data emitter with many conditionals. Useful internal structures are:

```text
LangGraphPlan
  nodes: runtime nodes and generated control nodes
  fixedEdges: ordinary transitions
  conditionalEdges: source, router ID, branch map
  waitingEdges: complete source set and destination
  requiredHandlers: node IDs
  requiredRouters: condition IDs
  unsupported: stable diagnostics
```

Planning first and rendering second makes semantic tests easier and keeps output ordering deterministic.

Suggested output metadata:

- target: `langgraph-python`
- adapter version: `langgraph-python-v1`
- filename: `<workflow>.langgraph.py`
- MIME type: `text/x-python`
- documented minimum dependency: choose and test one supported `langgraph` floor rather than floating to latest
- source hash and compiler version, matching existing adapters

### Milestone 2: runtime controls

Implement, in this order:

1. deterministic aggregators;
2. approvals and checkpoint requirements;
3. sequential/parallel groups;
4. bounded loops with hard iteration guards;
5. `allSettled` error envelopes;
6. subgraphs after the schema extension.

Keep `join: first` unsupported until its cancellation and side-effect semantics are deliberately specified. “Take the first result” is not equivalent to preventing slower branches from completing their side effects.

### Milestone 3: TypeScript and bundles

Add `langgraph-typescript` using `StateSchema`/Zod and `@langchain/langgraph`. Do not assume a mechanical casing conversion is sufficient; dependency versions, state declarations, reducer APIs, and checkpointer packages differ.

The existing `CompileResult` contains one content string. That works for a single graph module. A deployment-ready LangGraph application commonly also needs dependency metadata and `langgraph.json`. The official [application structure guide](https://docs.langchain.com/oss/python/langgraph/application-structure) describes the graph module, dependency file, environment configuration, and `langgraph.json` used for deployment. Supporting that should be a separate multi-artifact/export-bundle feature, not part of the first adapter.

## Testing strategy

### Golden and parity tests

- Compile the same LGIR twice and assert byte-identical output.
- Run the same golden cases through native Rust tests and the committed WebAssembly build, asserting the same diagnostics, filenames, MIME types, and capability reports.
- Snapshot simple sequence, parallel fan-out, conditional branch, and `join: all` workflows.
- Test hostile node IDs and string escaping.

### Syntax and import tests

- Parse generated Python with `ast.parse` without importing LangGraph.
- In a dedicated compatibility environment, install the supported LangGraph version range and import every golden module.
- Construct each graph with fake handlers and routers.
- Do not require provider packages or credentials.

### Behavioral tests

- Sequence: downstream sees upstream result.
- Fan-out: parallel nodes write distinct result keys without loss.
- Join: downstream runs once after all sources complete.
- Condition: only the selected branch runs; unknown branch tokens fail clearly.
- Approval: execution interrupts and resumes with the same thread.
- Loop: exit predicate and `maxIterations` are both enforced.
- Exhaustion: each declared policy has an asserted outcome.
- Capability boundary: prompts/connectors remain data and are never invoked by generated scaffolding.

### Compatibility tests

Run a small generated-code matrix against the minimum supported version and the newest compatible LangGraph release. The public API is evolving: the current references include node retry, cache, timeout, and error-handler options, while some features have recent version requirements. Avoid generating optional policies until the project pins and tests their supported floor. See [`add_node`](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) and [Fault tolerance](https://docs.langchain.com/oss/python/langgraph/fault-tolerance).

## Capability report for the initial target

The initial `langgraph-python` report should be candid.

Native:

- StateGraph topology
- fixed dependency scheduling
- parallel fan-out
- shared-state result reducer
- conditional routing with host routers
- `join: all`
- importable graph builder

Host-bound/instructional:

- model and agent behavior
- tool and connector calls
- condition evaluation
- input/output contract enforcement beyond the supported schema subset
- permissions and working directories

Unsupported until later milestones:

- `join: first`
- `join: allSettled`
- executable bounded loops
- approval interrupts
- execution groups
- referenced subgraphs

The compiler should list only constructs actually present in a workflow, as the existing capability report does.

## Decision summary

1. Treat LangGraph as a new output adapter, not a new source notation or parser.
2. Ship `langgraph-python` before TypeScript.
3. Preserve `python` and `typescript` as inert data-module targets.
4. Generate topology plus explicit handler/router contracts; never compile prose with `eval` or choose a provider.
5. Use a reducer-backed per-node results map for parallel safety.
6. Support sequences, fan-out, conditional routing, and `join: all` first.
7. Fail strictly on unsupported runtime semantics.
8. Clarify loop boundaries and extend subgraph configuration before lowering them.
9. Keep deployment bundles separate from the first single-file adapter.

With those boundaries, LangGraph support is a good extension of the current compiler. A useful scaffold is easy; a trustworthy runtime target is a moderate project, mainly because the compiler must make every semantic gap explicit rather than because `StateGraph` is difficult to emit.

## Primary sources

- [LangGraph Python Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Python `StateGraph` reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph)
- [LangGraph Python `add_node` reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)
- [LangGraph Python `add_edge` reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_edge)
- [LangGraph Python `add_conditional_edges` reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_conditional_edges)
- [LangGraph Python Graph API guide](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph subgraphs](https://docs.langchain.com/oss/python/langgraph/use-subgraphs)
- [LangGraph fault tolerance](https://docs.langchain.com/oss/python/langgraph/fault-tolerance)
- [LangGraph application structure](https://docs.langchain.com/oss/python/langgraph/application-structure)
- [LangGraph JavaScript Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api)
- [LangGraph JavaScript Graph API guide](https://docs.langchain.com/oss/javascript/langgraph/use-graph-api)
