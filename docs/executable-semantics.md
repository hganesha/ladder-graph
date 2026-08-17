# LGIR executable semantics

Status: normative for `ladder.dev/v1alpha1` validation
Effective: 2026-08-17

This document defines the runtime-neutral meaning of LGIR control flow and state transfer. Targets may remain instructional, but no executable target may silently weaken these rules.

## State model

An executable host maintains one workflow state with these logical namespaces:

- `/inputs`: host-provided workflow input;
- `/results/<node-id>`: the latest successful result envelope for a node;
- `/routes/<node-id>`: the branch token selected by a condition or approval;
- `/iterations/<loop-id>`: the completed iteration count;
- `/loopState/<loop-id>/<slot>`: an explicit value carried from one loop iteration into the next;
- `/errors/<node-id>`: a serializable failure envelope;
- `/output`: the declared workflow result.

The namespaces describe behavior, not a required in-memory representation. A target may use typed fields, channels, tables, or another deterministic structure.

Parallel writes from distinct nodes must merge without loss. Two concurrent edges may not write the same explicit target path. Re-executing the same node in a structured loop replaces that node's prior result unless its output schema or aggregator declares accumulation.

## Node handlers

`agent`, `tool`, `transform`, `evaluate`, and `teacher` nodes require host-resolved behavior. Prompts, expressions, capability identifiers, connector identifiers, and working directories are data. They are never evaluated as source code or treated as ambient authority.

An executable adapter must expose every required handler binding before invocation. A missing handler is a build- or invocation-time error, not a skipped node.

## Data and dependency edges

A `dependency` edge orders execution but does not copy a value into a target-specific input path.

A `data` edge orders execution and makes the source result available to the target:

- Without an explicit mapping, the complete source result remains available at `/results/<source-id>`.
- With `sourcePath` and `targetPath`, the host reads the JSON Pointer from the source result and writes it to the target's input view at the target pointer.
- `sourcePath` and `targetPath` must appear together and are valid only on data edges.
- Multiple data edges may target the same node, but explicit target paths must be unique.
- Missing source paths are runtime contract errors. They do not produce `null` implicitly.

`contract` names the logical payload type. It does not execute validation by itself. A target that supports schema validation must validate before the target handler runs and identify the failing edge and path.

## Conditions and routing

A condition declares:

- `expression`: a human-readable description of the decision;
- optional `router`: a host-resolved router identifier; if absent, the node ID is the binding key;
- `branches`: unique tokens and user-facing labels;
- optional `defaultBranch`: one declared token used when the host router explicitly reports no match.

Every outgoing control edge from a condition uses its `condition` field as a branch token. The token must be declared by `config.branches`. A router returns exactly one token. Executable targets must reject unknown or empty tokens.

A declared branch without an edge is valid for authoring compatibility but produces a warning because selecting it cannot advance execution. `defaultBranch` is not taken on exceptions; router failures follow the workflow failure policy.

Static outgoing edges must not be added alongside the selected conditional path unless the LGIR edge is explicitly unconditional. Executable adapters must preserve the distinction so a conditional node cannot accidentally run every branch.

## Structured loops

Arbitrary graph cycles remain invalid. Repetition is represented by one `loop` node.

The loop contract is:

- `body` is an ordered, unique list of node IDs.
- `entry` optionally identifies the first executed body node; it defaults to the first `body` item.
- `exitNode` optionally identifies the body node after which the exit decision is evaluated; it defaults to the last `body` item.
- `exitCondition` describes the host-resolved exit predicate.
- optional `carry` maps stable slot names to state JSON Pointers that are snapshotted for the next iteration.
- `maxIterations` is a hard limit from 1 through 100.
- A successful predicate follows every outgoing edge whose condition is `loop_exit`.
- An exhausted loop records its iteration count and follows `onExhausted`.

`onExhausted` has exact behavior:

- `stop`: terminate the workflow as an exhausted-loop failure. A `loop_exhausted` edge is not followed.
- `continue`: record exhaustion and follow the required `loop_exhausted` edge.
- `warn`: record exhaustion, emit a warning event, and follow the required `loop_exhausted` edge.

The runtime increments `/iterations/<loop-id>` once after `exitNode` completes. It evaluates the exit predicate before starting another iteration. The hard bound is checked by generated control code and cannot be delegated solely to a host router or framework recursion limit.

When another iteration is required, the runtime resolves every `carry` source against the completed iteration state and writes the values to `/loopState/<loop-id>/<slot>` before executing `entry`. Slot names start with a letter and contain only letters, digits, underscores, or hyphens. Missing source paths are runtime contract errors. Carry writes are atomic: body handlers see either the complete next-iteration loop state or no update. The first execution has no carried state unless the host explicitly seeds it.

Body nodes may appear on the initial acyclic path. Executable lowering treats the loop node as ownership of subsequent repetitions; it must not duplicate initial execution. A target that cannot identify one unambiguous entry and exit from the declared fields must reject the loop.

## Joins

A join requires at least two upstream edges and at least one downstream edge.

### `all`

Wait for every upstream node to succeed. Release one ordered collection of upstream results. Ordering follows stable LGIR node order, not completion time. If an upstream node fails, apply the workflow failure policy and do not release the join as successful.

### `allSettled`

Wait for every upstream node to reach a terminal state. Release an ordered array of envelopes:

```json
{
  "source": "node-id",
  "status": "fulfilled | rejected",
  "value": {},
  "error": {}
}
```

`value` appears only for `fulfilled`; `error` appears only for `rejected`. Upstream failures are captured by the join instead of applying the workflow failure policy before settlement.

### `first`

Release the first successfully completed upstream result. Completion ties are resolved by stable LGIR node order. Remaining branches are not cancelled and must not write through the join after release. If every upstream fails, apply the workflow failure policy.

This definition intentionally separates “first result” from cancellation. A future cancellation policy would need explicit idempotency and side-effect rules.

## Approvals

An approval pauses before downstream work and emits a JSON-serializable request containing its node ID, name, summary, and declared next action. The host resumes with a branch token stored at `/routes/<approval-id>`.

Outgoing edge conditions are the allowed resume tokens. An unknown token is rejected. Executable targets must use durable state when suspension crosses process or request boundaries. Work performed before the suspension must be safe to repeat.

## Groups

A group owns its ordered `members` list.

- `sequential` executes members in list order.
- `parallel` dispatches all members from the same group input.
- `serialize` releases an ordered array of member envelopes.
- `aggregate` releases a map keyed by member ID.

No group output is released until every required member reaches the group's completion barrier. Edges crossing a member boundary should route through the group node so a runtime target can preserve this barrier.

## Subgraphs

An executable subgraph requires `config.subgraph`:

```yaml
subgraph:
  ref: ladder://workflows/research-pass
  inputMap:
    request: /inputs/request
  outputMap:
    result: /results/research-pass
  checkpointer: inherit
```

Rules:

- `ref` is a `ladder://` catalog reference or a `host:` binding. HTTP references are rejected.
- `inputMap` keys are child input names and values are parent-state JSON Pointers.
- `outputMap` keys are child output names and values are parent-state JSON Pointers.
- Mappings are explicit and non-empty; shared field names are not inferred.
- The compiler never fetches a subgraph from the network.

Persistence modes are:

- `inherit`: inherit the parent execution's persistence for this invocation;
- `perInvocation`: isolate child state between calls while preserving it during one call;
- `perThread`: retain child state across calls in the same host thread;
- `stateless`: disable child persistence and reject child suspension.

An unresolved `host:` reference is a required binding. An unresolved `ladder://` reference is a compile error for executable targets.

## Failure policy

Targets must preserve `spec.policies.onFailure` as a declared host policy. If a target cannot implement the selected policy, it reports the policy as unsupported and blocks executable compilation. It must not substitute a framework default silently.

Join settlement and loop exhaustion behavior defined above take precedence where explicitly stated.

## Compatibility

Legacy v1alpha1 documents remain valid when their intent is unambiguous:

- missing condition `router` defaults to the condition node ID;
- missing loop `entry`/`exitNode` defaults to the first/last body item;
- data edges without mappings expose the complete source result by source node ID;
- a subgraph without configuration remains authorable but is not executable and produces `LG190`.

Warnings identify incomplete execution contracts. Errors identify ambiguous or contradictory contracts and block compilation for every target.
