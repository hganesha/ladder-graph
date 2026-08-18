use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, VecDeque};

const API_VERSION: &str = "ladder.dev/v1alpha1";
const COMPILER_VERSION: &str = env!("CARGO_PKG_VERSION");
const DOCS_AS_OF: &str = "2026-08-15";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workflow {
    pub api_version: String,
    pub kind: String,
    pub metadata: Metadata,
    pub spec: WorkflowSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    pub name: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowSpec {
    #[serde(default)]
    pub objective: String,
    #[serde(default)]
    pub inputs: BTreeMap<String, Value>,
    #[serde(default)]
    pub outputs: BTreeMap<String, Value>,
    #[serde(default)]
    pub policies: Policies,
    #[serde(default)]
    pub nodes: Vec<Node>,
    #[serde(default)]
    pub edges: Vec<Edge>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Policies {
    #[serde(default = "default_concurrency")]
    pub max_concurrency: u32,
    #[serde(default = "default_failure")]
    pub on_failure: String,
    #[serde(default)]
    pub require_approval_for: Vec<String>,
}

fn default_concurrency() -> u32 { 4 }
fn default_failure() -> String { "stop".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    pub id: String,
    pub kind: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub template_ref: String,
    #[serde(default)]
    pub inline_role: bool,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub prompt: String,
    #[serde(default)]
    pub input_schema: Value,
    #[serde(default)]
    pub output_schema: Value,
    #[serde(default)]
    pub form_refs: Vec<String>,
    #[serde(default)]
    pub capabilities: Capabilities,
    #[serde(default)]
    pub config: NodeConfig,
    #[serde(default)]
    pub position: Position,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub tools: Vec<String>,
    #[serde(default)]
    pub connectors: Vec<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub customizations: BTreeMap<String, CapabilityCustomization>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityCustomization {
    #[serde(default)]
    pub template: String,
    #[serde(default)]
    pub instructions: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeConfig {
    #[serde(default)]
    pub operation: String,
    #[serde(default)]
    pub expression: String,
    #[serde(default)]
    pub branches: Vec<Branch>,
    #[serde(default)]
    pub join: String,
    #[serde(default)]
    pub aggregation: String,
    #[serde(default)]
    pub teacher_model: String,
    #[serde(default)]
    pub feedback_mode: String,
    #[serde(default)]
    pub working_directory: String,
    #[serde(default)]
    pub body: Vec<String>,
    #[serde(default)]
    pub exit_condition: String,
    #[serde(default)]
    pub max_iterations: u32,
    #[serde(default)]
    pub on_exhausted: String,
    #[serde(default)]
    pub carry: BTreeMap<String, String>,
    #[serde(default)]
    pub threshold: Option<f64>,
    #[serde(default)]
    pub members: Vec<String>,
    #[serde(default)]
    pub execution: String,
    #[serde(default)]
    pub exit: String,
    #[serde(default)]
    pub router: String,
    #[serde(default)]
    pub default_branch: String,
    #[serde(default)]
    pub entry: String,
    #[serde(default)]
    pub exit_node: String,
    #[serde(default)]
    pub subgraph: Option<SubgraphConfig>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubgraphConfig {
    #[serde(default)]
    pub r#ref: String,
    #[serde(default)]
    pub input_map: BTreeMap<String, String>,
    #[serde(default)]
    pub output_map: BTreeMap<String, String>,
    #[serde(default = "default_subgraph_checkpointer")]
    pub checkpointer: String,
}

fn default_subgraph_checkpointer() -> String { "inherit".into() }

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub when: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Edge {
    pub id: String,
    pub from: String,
    pub to: String,
    #[serde(default = "default_edge_kind")]
    pub kind: String,
    #[serde(default)]
    pub contract: String,
    #[serde(default)]
    pub condition: String,
    #[serde(default)]
    pub source_path: String,
    #[serde(default)]
    pub target_path: String,
}

fn default_edge_kind() -> String { "dependency".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub code: String,
    pub severity: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edge_id: Option<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capability: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fix: Option<Fix>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fix {
    pub label: String,
    pub path: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    pub ok: bool,
    pub source_hash: String,
    pub diagnostics: Vec<Diagnostic>,
    pub normalized: Option<Workflow>,
    pub node_order: Vec<String>,
    pub stats: Stats,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub nodes: usize,
    pub edges: usize,
    pub agents: usize,
    pub loops: usize,
    pub max_parallelism: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityReport {
    pub target: String,
    pub native: Vec<String>,
    pub instructional: Vec<String>,
    pub unsupported: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileResult {
    pub ok: bool,
    pub content: String,
    pub suggested_filename: String,
    pub mime_type: String,
    pub source_hash: String,
    pub compiler_version: String,
    pub adapter_version: String,
    pub capability_report: CapabilityReport,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatResult {
    pub ok: bool,
    pub content: String,
    pub diagnostics: Vec<Diagnostic>,
}

fn diag(code: &str, severity: &str, path: impl Into<String>, message: impl Into<String>) -> Diagnostic {
    Diagnostic {
        code: code.into(), severity: severity.into(), path: path.into(), node_id: None,
        edge_id: None, message: message.into(), capability: None, fix: None,
    }
}

fn node_diag(code: &str, severity: &str, index: usize, node: &Node, message: impl Into<String>) -> Diagnostic {
    let mut d = diag(code, severity, format!("/spec/nodes/{index}"), message);
    d.node_id = Some(node.id.clone());
    d
}

fn hash_workflow(workflow: &Workflow) -> String {
    let canonical = serde_json::to_vec(workflow).unwrap_or_default();
    hex::encode(Sha256::digest(canonical))
}

fn valid_state_path(path: &str) -> bool {
    path.starts_with('/') && !path.split('/').skip(1).any(|segment| {
        let bytes = segment.as_bytes();
        bytes.iter().enumerate().any(|(index, byte)| {
            *byte == b'~' && bytes.get(index + 1).is_none_or(|next| !matches!(next, b'0' | b'1'))
        })
    })
}

fn parse(source: &str) -> Result<Workflow, Diagnostic> {
    if source.len() > 2_000_000 {
        return Err(diag("LG001", "error", "/", "LGIR source exceeds the 2 MB import limit."));
    }
    if source.contains("!!") || source.contains("!<") {
        return Err(diag("LG002", "error", "/", "Custom YAML tags are not supported."));
    }
    if source.lines().any(|line| {
        let trimmed = line.trim_start();
        trimmed.starts_with('&') || trimmed.starts_with('*') || line.contains(": &")
            || line.contains(": *") || line.contains("- &") || line.contains("- *")
    }) {
        return Err(diag("LG004", "error", "/", "YAML anchors and aliases are not supported."));
    }
    if source.lines().any(|line| {
        let compact = line.trim().replace('"', "").replace('\'', "");
        compact.starts_with("$ref: http://") || compact.starts_with("$ref: https://")
            || compact.starts_with("$ref: //")
    }) {
        return Err(diag("LG005", "error", "/", "External schema references are not supported."));
    }
    serde_yaml_ng::from_str(source).map_err(|error| {
        diag("LG003", "error", "/", format!("YAML could not be parsed: {error}"))
    })
}

fn topological_order(workflow: &Workflow) -> (Vec<String>, bool, usize) {
    let ids: BTreeSet<String> = workflow.spec.nodes.iter().map(|n| n.id.clone()).collect();
    let mut indegree: BTreeMap<String, usize> = ids.iter().map(|id| (id.clone(), 0)).collect();
    let mut outgoing: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let groups: BTreeMap<&str, &Node> = workflow.spec.nodes.iter().filter(|node| node.kind == "group").map(|node| (node.id.as_str(), node)).collect();
    let mut scheduling_edges: Vec<(String, String)> = Vec::new();
    for edge in &workflow.spec.edges {
        if let Some(group) = groups.get(edge.from.as_str()) {
            let members: Vec<&String> = group.config.members.iter().filter(|id| ids.contains(*id)).collect();
            if members.is_empty() { scheduling_edges.push((edge.from.clone(), edge.to.clone())); }
            else { scheduling_edges.extend(members.into_iter().map(|member| (member.clone(), edge.to.clone()))); }
        } else {
            scheduling_edges.push((edge.from.clone(), edge.to.clone()));
        }
    }
    for group in groups.values() {
        let members: Vec<&String> = group.config.members.iter().filter(|id| ids.contains(*id)).collect();
        if group.config.execution == "sequential" {
            if let Some(first) = members.first() { scheduling_edges.push((group.id.clone(), (*first).clone())); }
            for pair in members.windows(2) { scheduling_edges.push((pair[0].clone(), pair[1].clone())); }
        } else {
            scheduling_edges.extend(members.into_iter().map(|member| (group.id.clone(), member.clone())));
        }
    }
    let mut seen_edges = BTreeSet::new();
    for (from, to) in scheduling_edges {
        if ids.contains(&from) && ids.contains(&to) && seen_edges.insert((from.clone(), to.clone())) {
            *indegree.entry(to.clone()).or_default() += 1;
            outgoing.entry(from).or_default().push(to);
        }
    }
    for values in outgoing.values_mut() { values.sort(); }
    let mut queue: VecDeque<String> = indegree.iter().filter(|(_, d)| **d == 0).map(|(id, _)| id.clone()).collect();
    let mut order = Vec::new();
    let mut max_parallel = queue.len();
    while !queue.is_empty() {
        max_parallel = max_parallel.max(queue.len());
        let id = queue.pop_front().expect("queue is non-empty");
        order.push(id.clone());
        if let Some(next) = outgoing.get(&id) {
            for target in next {
                if let Some(value) = indegree.get_mut(target) {
                    *value -= 1;
                    if *value == 0 { queue.push_back(target.clone()); }
                }
            }
        }
    }
    let cyclic = order.len() != ids.len();
    (order, cyclic, max_parallel)
}

fn validate(workflow: &Workflow, target: Option<&str>) -> (Vec<Diagnostic>, Vec<String>, Stats) {
    let mut diagnostics = Vec::new();
    if workflow.api_version != API_VERSION {
        diagnostics.push(diag("LG100", "error", "/apiVersion", format!("Expected apiVersion {API_VERSION}.")));
    }
    if workflow.kind != "Workflow" {
        diagnostics.push(diag("LG101", "error", "/kind", "kind must be Workflow."));
    }
    if workflow.metadata.name.is_empty() || !workflow.metadata.name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        diagnostics.push(diag("LG102", "error", "/metadata/name", "metadata.name must be a non-empty lowercase slug."));
    }
    if workflow.spec.objective.trim().is_empty() {
        diagnostics.push(diag("LG103", "warning", "/spec/objective", "Add an objective so the generated workflow has a clear completion condition."));
    }
    if workflow.spec.nodes.len() > 1_000 {
        diagnostics.push(diag("LG104", "error", "/spec/nodes", "Workflows are limited to 1,000 nodes."));
    }

    let allowed_kinds: BTreeSet<&str> = ["input", "output", "agent", "tool", "transform", "condition", "evaluate", "teacher", "approval", "join", "aggregator", "loop", "group", "subgraph"].into_iter().collect();
    let allowed_transforms: BTreeSet<&str> = ["select", "rename", "merge", "filter", "deduplicate", "sort", "slice"].into_iter().collect();
    let allowed_aggregations: BTreeSet<&str> = ["collect", "merge", "concat", "vote"].into_iter().collect();
    let allowed_feedback_modes: BTreeSet<&str> = ["critique", "score", "rubric"].into_iter().collect();
    let mut ids = BTreeSet::new();
    let mut input_count = 0;
    let mut output_count = 0;
    for (index, node) in workflow.spec.nodes.iter().enumerate() {
        if !ids.insert(node.id.clone()) {
            diagnostics.push(node_diag("LG110", "error", index, node, format!("Duplicate node id '{}'.", node.id)));
        }
        if !allowed_kinds.contains(node.kind.as_str()) {
            diagnostics.push(node_diag("LG111", "error", index, node, format!("Unsupported node kind '{}'.", node.kind)));
        }
        if node.kind == "input" { input_count += 1; }
        if node.kind == "output" { output_count += 1; }
        if ["agent", "evaluate", "teacher"].contains(&node.kind.as_str()) && node.prompt.trim().is_empty() {
            diagnostics.push(node_diag("LG112", "error", index, node, "Agent, evaluator, and teacher nodes require a prompt."));
        }
        if node.kind == "agent" && node.role.trim().is_empty() {
            diagnostics.push(node_diag("LG113", "warning", index, node, "Add a role to make this agent's responsibility explicit."));
        }
        if node.kind == "tool" && node.capabilities.tools.is_empty() {
            diagnostics.push(node_diag("LG114", "warning", index, node, "Tool requirement has no declared tool identifier."));
        }
        if node.kind == "transform" && !allowed_transforms.contains(node.config.operation.as_str()) {
            diagnostics.push(node_diag("LG115", "error", index, node, "Transform operation must be select, rename, merge, filter, deduplicate, sort, or slice."));
        }
        if node.kind == "teacher" {
            if node.config.teacher_model.trim().is_empty() {
                diagnostics.push(node_diag("LG116", "error", index, node, "Teacher model requires a host-resolved teacherModel reference."));
            }
            if !allowed_feedback_modes.contains(node.config.feedback_mode.as_str()) {
                diagnostics.push(node_diag("LG117", "error", index, node, "Teacher feedbackMode must be critique, score, or rubric."));
            }
        }
        if node.kind == "aggregator" && !allowed_aggregations.contains(node.config.aggregation.as_str()) {
            diagnostics.push(node_diag("LG118", "error", index, node, "Aggregation strategy must be collect, merge, concat, or vote."));
        }
        let unique_form_refs: BTreeSet<&String> = node.form_refs.iter().collect();
        if unique_form_refs.len() != node.form_refs.len()
            || node.form_refs.iter().any(|form_ref| form_ref.strip_prefix("ladder://forms/").is_none_or(str::is_empty))
        {
            diagnostics.push(node_diag("LG196", "error", index, node, "Attached forms must be unique, non-empty ladder://forms/ references."));
        }
        if node.kind == "condition" {
            if node.config.branches.is_empty() {
                diagnostics.push(node_diag("LG160", "error", index, node, "Condition nodes require at least one declared branch token."));
            }
            let mut tokens = BTreeSet::new();
            for branch in &node.config.branches {
                if branch.label.trim().is_empty() || branch.when.trim().is_empty() {
                    diagnostics.push(node_diag("LG161", "error", index, node, "Condition branch labels and tokens must be non-empty."));
                } else if !tokens.insert(branch.when.as_str()) {
                    diagnostics.push(node_diag("LG161", "error", index, node, format!("Condition branch token '{}' is duplicated.", branch.when)));
                }
            }
            if !node.config.default_branch.is_empty() && !tokens.contains(node.config.default_branch.as_str()) {
                diagnostics.push(node_diag("LG162", "error", index, node, format!("defaultBranch '{}' must name a declared branch token.", node.config.default_branch)));
            }
        }
        if node.kind == "loop" {
            if node.config.max_iterations == 0 || node.config.max_iterations > 100 {
                let mut d = node_diag("LG120", "error", index, node, "Loop maxIterations must be between 1 and 100.");
                d.fix = Some(Fix { label: "Set a safe three-iteration bound".into(), path: format!("/spec/nodes/{index}/config/maxIterations"), value: json!(3) });
                diagnostics.push(d);
            }
            if node.config.exit_condition.trim().is_empty() {
                diagnostics.push(node_diag("LG121", "error", index, node, "Loop requires an exitCondition referencing a condition or evaluator result."));
            }
            if node.config.body.is_empty() {
                diagnostics.push(node_diag("LG122", "error", index, node, "Loop body must reference at least one node."));
            }
            let mut body_ids = BTreeSet::new();
            for body_id in &node.config.body {
                if !workflow.spec.nodes.iter().any(|candidate| candidate.id == *body_id) {
                    diagnostics.push(node_diag("LG123", "error", index, node, format!("Loop body references missing node '{body_id}'.")));
                }
                if body_id == &node.id || !body_ids.insert(body_id) {
                    diagnostics.push(node_diag("LG170", "error", index, node, "Loop bodies cannot contain the loop node or duplicate member IDs."));
                }
            }
            let entry = if node.config.entry.is_empty() { node.config.body.first() } else { Some(&node.config.entry) };
            let exit = if node.config.exit_node.is_empty() { node.config.body.last() } else { Some(&node.config.exit_node) };
            if entry.is_some_and(|id| !body_ids.contains(id)) {
                diagnostics.push(node_diag("LG171", "error", index, node, "Loop entry must identify a node in the loop body."));
            }
            if exit.is_some_and(|id| !body_ids.contains(id)) {
                diagnostics.push(node_diag("LG172", "error", index, node, "Loop exitNode must identify a node in the loop body."));
            }
            for (slot, source_path) in &node.config.carry {
                if slot.is_empty()
                    || !slot.chars().next().is_some_and(|character| character.is_ascii_alphabetic())
                    || !slot.chars().all(|character| character.is_ascii_alphanumeric() || character == '_' || character == '-')
                {
                    diagnostics.push(node_diag("LG177", "error", index, node, format!("Loop carry slot '{slot}' must start with a letter and contain only letters, digits, underscores, or hyphens.")));
                }
                if !valid_state_path(source_path) {
                    diagnostics.push(node_diag("LG178", "error", index, node, format!("Loop carry source '{source_path}' must be a valid state JSON Pointer.")));
                }
            }
        }
        if node.kind != "loop" && !node.config.carry.is_empty() {
            diagnostics.push(node_diag("LG179", "error", index, node, "Loop carry state is valid only on loop nodes."));
        }
        if node.kind == "join" && !["all", "allSettled", "first"].contains(&node.config.join.as_str()) {
            diagnostics.push(node_diag("LG124", "error", index, node, "Join policy must be all, allSettled, or first."));
        }
        if node.kind == "group" {
            if node.config.members.is_empty() {
                diagnostics.push(node_diag("LG125", "warning", index, node, "Group has no member nodes yet."));
            }
            if !["sequential", "parallel"].contains(&node.config.execution.as_str()) {
                diagnostics.push(node_diag("LG126", "error", index, node, "Group execution must be sequential or parallel."));
            }
            if !["aggregate", "serialize"].contains(&node.config.exit.as_str()) {
                diagnostics.push(node_diag("LG127", "error", index, node, "Group exit must aggregate or serialize member outputs."));
            }
            let unique: BTreeSet<&String> = node.config.members.iter().collect();
            if unique.len() != node.config.members.len() {
                diagnostics.push(node_diag("LG128", "error", index, node, "Group member IDs must be unique."));
            }
            for member_id in &node.config.members {
                match workflow.spec.nodes.iter().find(|candidate| candidate.id == *member_id) {
                    None => diagnostics.push(node_diag("LG129", "error", index, node, format!("Group references missing member '{member_id}'."))),
                    Some(member) if member.id == node.id || member.kind == "group" => diagnostics.push(node_diag("LG132", "error", index, node, "Groups cannot contain themselves or another group.")),
                    _ => {}
                }
            }
        }
        if node.kind == "subgraph" {
            match &node.config.subgraph {
                None => diagnostics.push(node_diag("LG190", "warning", index, node, "Subgraph has no executable ref or parent/child state mapping.")),
                Some(subgraph) => {
                    let valid_ref = subgraph.r#ref.strip_prefix("ladder://").is_some_and(|value| !value.is_empty())
                        || subgraph.r#ref.strip_prefix("host:").is_some_and(|value| !value.is_empty());
                    if !valid_ref {
                        diagnostics.push(node_diag("LG191", "error", index, node, "Subgraph ref must be a non-empty ladder:// or host: reference."));
                    }
                    if subgraph.input_map.is_empty() {
                        diagnostics.push(node_diag("LG192", "error", index, node, "Subgraph inputMap must map at least one child input to a parent state path."));
                    }
                    if subgraph.output_map.is_empty() {
                        diagnostics.push(node_diag("LG193", "error", index, node, "Subgraph outputMap must map at least one child output to a parent state path."));
                    }
                    if subgraph.input_map.values().chain(subgraph.output_map.values()).any(|path| !valid_state_path(path)) {
                        diagnostics.push(node_diag("LG194", "error", index, node, "Subgraph state mappings must use valid JSON Pointer paths."));
                    }
                    if !["inherit", "perInvocation", "perThread", "stateless"].contains(&subgraph.checkpointer.as_str()) {
                        diagnostics.push(node_diag("LG195", "error", index, node, "Subgraph checkpointer must be inherit, perInvocation, perThread, or stateless."));
                    }
                }
            }
        }
        if let Some(target) = target {
            if node.kind == "approval" || node.kind == "loop" || node.kind == "group" || node.kind == "teacher" {
                let mut d = node_diag("LG200", "info", index, node, format!("{} expresses '{}' as explicit instructions rather than a hard runtime guarantee.", title_case(target), node.kind));
                d.capability = Some("instructional".into());
                diagnostics.push(d);
            }
            if !node.capabilities.connectors.is_empty() || node.capabilities.tools.iter().any(|tool| tool.starts_with("mcp:")) {
                let mut d = node_diag("LG201", "warning", index, node, "Connector requirements are documented but not invoked by this compiler.");
                d.capability = Some("instructional".into());
                diagnostics.push(d);
            }
        }
    }
    if input_count == 0 { diagnostics.push(diag("LG130", "warning", "/spec/nodes", "Workflow has no input node.")); }
    if output_count == 0 {
        let has_terminal_agent = workflow.spec.nodes.iter().any(|node| {
            node.kind == "agent" && !workflow.spec.edges.iter().any(|edge| edge.from == node.id)
        });
        diagnostics.push(diag(
            "LG131",
            if has_terminal_agent { "warning" } else { "error" },
            "/spec/nodes",
            if has_terminal_agent {
                "Workflow uses its terminal agent as the implicit output."
            } else {
                "Workflow requires an output or terminal agent node."
            },
        ));
    }

    let known: BTreeSet<String> = workflow.spec.nodes.iter().map(|node| node.id.clone()).collect();
    let mut membership: BTreeMap<String, String> = BTreeMap::new();
    for group in workflow.spec.nodes.iter().filter(|node| node.kind == "group") {
        for member_id in &group.config.members {
            if let Some(existing) = membership.insert(member_id.clone(), group.id.clone()) {
                if existing != group.id {
                    diagnostics.push(diag("LG133", "error", "/spec/nodes", format!("Node '{member_id}' belongs to more than one group.")));
                }
            }
        }
    }
    let mut edge_ids = BTreeSet::new();
    for (index, edge) in workflow.spec.edges.iter().enumerate() {
        let mut edge_error = |code: &str, message: String| {
            let mut d = diag(code, "error", format!("/spec/edges/{index}"), message);
            d.edge_id = Some(edge.id.clone());
            diagnostics.push(d);
        };
        if !edge_ids.insert(edge.id.clone()) { edge_error("LG140", format!("Duplicate edge id '{}'.", edge.id)); }
        if !known.contains(&edge.from) { edge_error("LG141", format!("Edge source '{}' does not exist.", edge.from)); }
        if !known.contains(&edge.to) { edge_error("LG142", format!("Edge target '{}' does not exist.", edge.to)); }
        if !["data", "dependency", "control"].contains(&edge.kind.as_str()) { edge_error("LG143", format!("Unsupported edge kind '{}'.", edge.kind)); }
        if edge.from == edge.to { edge_error("LG144", "Self edges are not allowed; use a structured loop node.".into()); }
        let has_source_path = !edge.source_path.is_empty();
        let has_target_path = !edge.target_path.is_empty();
        if has_source_path != has_target_path {
            edge_error("LG183", "Data mappings require both sourcePath and targetPath.".into());
        }
        if (has_source_path && !valid_state_path(&edge.source_path)) || (has_target_path && !valid_state_path(&edge.target_path)) {
            edge_error("LG184", "sourcePath and targetPath must be valid JSON Pointer paths.".into());
        }
        if (has_source_path || has_target_path) && edge.kind != "data" {
            edge_error("LG185", "Only data edges can declare sourcePath and targetPath.".into());
        }
        if edge.kind == "control" && edge.condition.trim().is_empty() {
            edge_error("LG186", "Control edges require a non-empty branch token in condition.".into());
        }
        let source_group = membership.get(&edge.from);
        let target_group = membership.get(&edge.to);
        if source_group.is_some() && source_group != target_group {
            diagnostics.push(diag("LG145", "warning", format!("/spec/edges/{index}"), format!("Route member '{}' output through group '{}' before crossing its boundary.", edge.from, source_group.expect("checked"))));
        }
        if target_group.is_some() && source_group != target_group {
            diagnostics.push(diag("LG146", "warning", format!("/spec/edges/{index}"), format!("Route external input through group '{}' instead of directly to member '{}'.", target_group.expect("checked"), edge.to)));
        }
    }
    let mut mapped_targets = BTreeSet::new();
    for (index, edge) in workflow.spec.edges.iter().enumerate().filter(|(_, edge)| edge.kind == "data" && !edge.target_path.is_empty()) {
        if !mapped_targets.insert((edge.to.as_str(), edge.target_path.as_str())) {
            let mut d = diag("LG187", "error", format!("/spec/edges/{index}"), format!("Multiple data edges map to targetPath '{}' on node '{}'.", edge.target_path, edge.to));
            d.edge_id = Some(edge.id.clone());
            diagnostics.push(d);
        }
    }
    for (index, node) in workflow.spec.nodes.iter().enumerate().filter(|(_, node)| node.kind == "condition") {
        let branch_tokens: BTreeSet<&str> = node.config.branches.iter().map(|branch| branch.when.as_str()).collect();
        let outgoing: Vec<&Edge> = workflow.spec.edges.iter().filter(|edge| edge.from == node.id && edge.kind == "control").collect();
        if outgoing.is_empty() {
            diagnostics.push(node_diag("LG165", "error", index, node, "Condition requires at least one outgoing control edge."));
        }
        let outgoing_tokens: BTreeSet<&str> = outgoing.iter().map(|edge| edge.condition.as_str()).collect();
        for edge in outgoing {
            if !branch_tokens.contains(edge.condition.as_str()) {
                let mut d = node_diag("LG163", "error", index, node, format!("Control edge '{}' uses undeclared branch token '{}'.", edge.id, edge.condition));
                d.edge_id = Some(edge.id.clone());
                diagnostics.push(d);
            }
        }
        for token in branch_tokens.difference(&outgoing_tokens) {
            diagnostics.push(node_diag("LG164", "warning", index, node, format!("Declared branch token '{token}' has no outgoing control edge.")));
        }
    }
    for (index, node) in workflow.spec.nodes.iter().enumerate().filter(|(_, node)| node.kind == "loop") {
        let outgoing: Vec<&Edge> = workflow.spec.edges.iter().filter(|edge| edge.from == node.id).collect();
        if outgoing.is_empty() {
            diagnostics.push(node_diag("LG173", "error", index, node, "Loop requires at least one outgoing exit edge."));
        } else if !outgoing.iter().any(|edge| edge.condition == "loop_exit") {
            diagnostics.push(node_diag("LG174", "warning", index, node, "Loop exit edges should use the canonical 'loop_exit' condition token."));
        }
        let has_exhausted_edge = outgoing.iter().any(|edge| edge.condition == "loop_exhausted");
        if ["continue", "warn"].contains(&node.config.on_exhausted.as_str()) && !has_exhausted_edge {
            diagnostics.push(node_diag("LG175", "error", index, node, "continue and warn exhaustion policies require a 'loop_exhausted' outgoing edge."));
        }
        if node.config.on_exhausted == "stop" && has_exhausted_edge {
            diagnostics.push(node_diag("LG176", "warning", index, node, "A stop exhaustion policy never follows a 'loop_exhausted' edge."));
        }
    }
    for (index, node) in workflow.spec.nodes.iter().enumerate().filter(|(_, node)| node.kind == "join") {
        let inbound = workflow.spec.edges.iter().filter(|edge| edge.to == node.id && known.contains(&edge.from)).count();
        let outbound = workflow.spec.edges.iter().filter(|edge| edge.from == node.id && known.contains(&edge.to)).count();
        if inbound < 2 {
            diagnostics.push(node_diag("LG180", "error", index, node, "Join nodes require at least two distinct upstream edges."));
        }
        if outbound == 0 {
            diagnostics.push(node_diag("LG181", "error", index, node, "Join nodes require at least one downstream edge."));
        }
    }
    for (index, node) in workflow.spec.nodes.iter().enumerate().filter(|(_, node)| node.kind == "aggregator") {
        let inbound = workflow.spec.edges.iter().filter(|edge| edge.to == node.id && known.contains(&edge.from)).count();
        if inbound < 2 {
            diagnostics.push(node_diag("LG134", "warning", index, node, "Aggregator should receive outputs from at least two nodes."));
        }
    }
    let (order, cyclic, max_parallelism) = topological_order(workflow);
    if cyclic { diagnostics.push(diag("LG150", "error", "/spec/edges", "Arbitrary cycles are not allowed. Place repeated work inside a structured loop node.")); }

    let stats = Stats {
        nodes: workflow.spec.nodes.len(),
        edges: workflow.spec.edges.len(),
        agents: workflow.spec.nodes.iter().filter(|n| n.kind == "agent" || n.kind == "evaluate" || n.kind == "teacher").count(),
        loops: workflow.spec.nodes.iter().filter(|n| n.kind == "loop").count(),
        max_parallelism,
    };
    (diagnostics, order, stats)
}

fn title_case(target: &str) -> &str {
    match target { "codex" => "Codex", "claude" => "Claude", "hermes" => "Hermes Agent", "python" => "Python", "typescript" => "TypeScript", other => other }
}

fn dependencies<'a>(workflow: &'a Workflow, id: &str) -> Vec<&'a Edge> {
    workflow.spec.edges.iter().filter(|edge| edge.to == id).collect()
}

fn list_or_none(values: &[String]) -> String {
    if values.is_empty() { "None declared".into() } else { values.join(", ") }
}

fn aggregation_instruction(strategy: &str) -> &str {
    match strategy {
        "merge" => "merge object fields and report key collisions instead of overwriting them",
        "concat" => "concatenate array items without changing their order",
        "vote" => "tally identical scalar or category values and preserve every tied winner",
        _ => "collect results into an ordered array of { source, value } entries",
    }
}

fn render_node(workflow: &Workflow, node: &Node, ordinal: usize) -> String {
    let deps = dependencies(workflow, &node.id);
    let dep_text = if deps.is_empty() { "Starts when the workflow begins".into() } else {
        deps.iter().map(|edge| format!("`{}` via {} edge{}", edge.from, edge.kind, if edge.contract.is_empty() { "".into() } else { format!(" carrying `{}`", edge.contract) })).collect::<Vec<_>>().join("; ")
    };
    let mut output = format!("\n### {ordinal}. {} (`{}`)\n\n- **Kind:** `{}`\n- **Depends on:** {}\n- **Purpose:** {}\n", if node.name.is_empty() { &node.id } else { &node.name }, node.id, node.kind, dep_text, if node.summary.is_empty() { "No summary provided." } else { &node.summary });
    if !node.config.working_directory.trim().is_empty() {
        output.push_str(&format!("- **Working directory:** `{}`\n", node.config.working_directory.trim()));
    }
    if !node.form_refs.is_empty() {
        output.push_str(&format!("- **Attached forms:** {}\n", node.form_refs.iter().map(|form_ref| format!("`{form_ref}`")).collect::<Vec<_>>().join(", ")));
    }
    match node.kind.as_str() {
        "agent" | "evaluate" | "teacher" => {
            output.push_str(&format!("- **Role:** {}\n- **Required skills:** {}\n- **Required connectors:** {}\n- **Required tools:** {}\n- **Permissions:** {}\n\n**Task instructions**\n\n{}\n", if node.role.is_empty() { "Focused workflow specialist" } else { &node.role }, list_or_none(&node.capabilities.skills), list_or_none(&node.capabilities.connectors), list_or_none(&node.capabilities.tools), list_or_none(&node.capabilities.permissions), node.prompt));
            if node.kind == "teacher" {
                output.push_str(&format!("\nUse teacher model reference `{}` in `{}` mode. Return feedback only; do not expose hidden chain-of-thought or silently replace the candidate.\n", node.config.teacher_model, node.config.feedback_mode));
            }
            let selected = node.capabilities.skills.iter().chain(node.capabilities.connectors.iter());
            let customized: Vec<(&String, &CapabilityCustomization)> = selected.filter_map(|id| node.capabilities.customizations.get(id).map(|value| (id, value))).collect();
            if !customized.is_empty() {
                output.push_str("\n**Capability templates**\n\n");
                for (id, value) in customized {
                    output.push_str(&format!("- `{}` from `{}`: {}\n", id, value.template, value.instructions));
                }
            }
            if node.output_schema != Value::Null { output.push_str(&format!("\n**Expected output contract**\n\n```json\n{}\n```\n", serde_json::to_string_pretty(&node.output_schema).unwrap_or_default())); }
        }
        "condition" => output.push_str(&format!("\nEvaluate `{}` and follow exactly one declared control edge.\n", node.config.expression)),
        "transform" => output.push_str(&format!("\nApply the declarative `{}` operation using `{}`. Do not execute arbitrary code.\n", node.config.operation, node.config.expression)),
        "join" => output.push_str(&format!("\nWait using the `{}` join policy. Release the available branch outputs unchanged; use an aggregator when they must be combined.\n", node.config.join)),
        "aggregator" => output.push_str(&format!("\nAfter every declared dependency is available, {}. Preserve each source node ID and do not invent missing results.\n", aggregation_instruction(&node.config.aggregation))),
        "approval" => output.push_str("\nPause and request explicit user approval before continuing. State what will happen next.\n"),
        "loop" => {
            output.push_str(&format!("\nRepeat nodes {} until `{}` is true, for at most {} iterations. On exhaustion: `{}`. Never exceed the bound.\n", node.config.body.iter().map(|id| format!("`{id}`")).collect::<Vec<_>>().join(", "), node.config.exit_condition, node.config.max_iterations, if node.config.on_exhausted.is_empty() { "stop" } else { &node.config.on_exhausted }));
            if !node.config.carry.is_empty() {
                let mappings = node.config.carry.iter().map(|(slot, path)| format!("`{slot}` from `{path}`")).collect::<Vec<_>>().join(", ");
                output.push_str(&format!("Before each subsequent iteration, snapshot {mappings} into `/loopState/{}/<slot>` and expose that loop state to every body handler. A missing source is a runtime contract error.\n", node.id));
            }
        }
        "group" => output.push_str(&format!("\nAccept the group input, run {} in `{}` mode, then `{}` every member output before releasing any group output. The group is complete only after all members finish.\n", node.config.members.iter().map(|id| format!("`{id}`")).collect::<Vec<_>>().join(", "), node.config.execution, node.config.exit)),
        "tool" => output.push_str(&format!("\nThis node documents required tools ({}) and connectors ({}). Use only capabilities already available and permitted in the current environment.\n", list_or_none(&node.capabilities.tools), list_or_none(&node.capabilities.connectors))),
        "subgraph" => output.push_str("\nTreat this as a named phase boundary. Complete its referenced child work before continuing.\n"),
        "input" => {
            output.push_str("\nCapture only inputs that satisfy the declared contract. Treat media values as host-provided references; do not assume the compiler uploaded, fetched, or authorized an asset.\n");
            if node.input_schema != Value::Null { output.push_str(&format!("\n**Expected input contract**\n\n```json\n{}\n```\n", serde_json::to_string_pretty(&node.input_schema).unwrap_or_default())); }
        }
        "output" => output.push_str("\nReturn the final deliverable, unresolved risks, and a concise account of validation performed.\n"),
        _ => {}
    }
    output
}

fn compile_workflow(workflow: &Workflow, target: &str, order: &[String]) -> String {
    let title = if workflow.metadata.title.is_empty() { &workflow.metadata.name } else { &workflow.metadata.title };
    let source_description = if workflow.metadata.description.is_empty() { "Execute this Ladder Graph workflow deterministically." } else { workflow.metadata.description.trim() };
    let hermes_description = if source_description.ends_with('.') { source_description.to_string() } else { format!("{source_description}.") };
    let description = if target == "hermes" {
        if hermes_description.len() > 60 { "Run this structured agent workflow.".to_string() } else { hermes_description }
    } else { source_description.to_string() };
    let source_hash = hash_workflow(workflow);
    let metadata = if target == "hermes" {
        format!("version: 1.0.0\nmetadata:\n  hermes:\n    tags: [ladder-graph, workflow, orchestration]\n    category: orchestration\n  ladder-target: {target}\n  ladder-source-hash: {source_hash}\n  ladder-compiler: {COMPILER_VERSION}\n  target-docs-as-of: {DOCS_AS_OF}")
    } else {
        format!("metadata:\n  ladder-target: {target}\n  ladder-source-hash: {source_hash}\n  ladder-compiler: {COMPILER_VERSION}\n  target-docs-as-of: {DOCS_AS_OF}")
    };
    let hermes_setup = if target == "hermes" {
        format!("\n\n## Hermes setup\n\nSave this document as `~/.hermes/skills/ladder-graph/{}/SKILL.md`. Before use, confirm every named toolset and MCP server is enabled for the active Hermes profile. Configure OpenRouter separately; never place provider credentials in this skill.\n", workflow.metadata.name)
    } else { String::new() };
    let mut content = format!("---\nname: {}\ndescription: {}\n{}\n---\n\n# {}\n\n> Compiled by Ladder Graph for {}. This file is instruction-only: it does not grant permissions, execute tools, or contact a model provider.{}\n\n## Objective\n\n{}\n\n## Operating rules\n\n1. Respect the dependency order and pass only the named outputs required by downstream work.\n2. Run independent ready nodes in parallel when the current client supports it; otherwise preserve their independence while running them sequentially.\n3. Treat schemas, approvals, and loop bounds as mandatory instructions. Stop and explain any capability the environment cannot provide.\n4. Do not broaden tool permissions. Never execute code embedded in this workflow definition.\n5. On failure, follow `{}` and preserve useful completed outputs. Maximum concurrency is {}.\n\n## Workflow\n", workflow.metadata.name, yaml_scalar(&description), metadata, title, title_case(target), hermes_setup, workflow.spec.objective, workflow.spec.policies.on_failure, workflow.spec.policies.max_concurrency);
    let skill_location = match target { "codex" => ".agents/skills/", "claude" => ".claude/skills/", "hermes" => "~/.hermes/skills/", _ => "configured skills" };
    let connector_rule = if target == "hermes" { "Confirm required Hermes toolsets with `hermes tools`, and use only configured MCP servers or OpenRouter profiles." } else { "Use only configured connectors." };
    content = content.replacen("\n\n## Workflow\n", &format!("\n6. Resolve named skills from the active {} catalog (including `{}`). {} If a required skill or connector is unavailable, stop that node and report the missing capability.\n\n## Workflow\n", title_case(target), skill_location, connector_rule), 1);
    let by_id: BTreeMap<&str, &Node> = workflow.spec.nodes.iter().map(|node| (node.id.as_str(), node)).collect();
    for (index, id) in order.iter().enumerate() {
        if let Some(node) = by_id.get(id.as_str()) { content.push_str(&render_node(workflow, node, index + 1)); }
    }
    content.push_str("\n## Completion contract\n\n- Confirm that every reachable output dependency completed or was explicitly reported as unavailable.\n- Report loop iteration counts and whether each exit condition passed.\n- Separate verified results from assumptions or incomplete work.\n- Return the workflow's declared output and no hidden chain-of-thought.\n");
    content
}

fn capability_manifest(workflow: &Workflow) -> Value {
    let mut manifest = BTreeMap::new();
    for node in &workflow.spec.nodes {
        let make_entry = |id: &String, kind: &str| {
            let customization = node.capabilities.customizations.get(id);
            json!({
                "id": id,
                "template": customization.map(|value| value.template.as_str()).filter(|value| !value.is_empty()).unwrap_or(id),
                "instructions": customization.map(|value| value.instructions.clone()).filter(|value| !value.is_empty()).unwrap_or_else(|| {
                    if kind == "skill" {
                        format!("Apply the '{id}' skill only within this node contract and return the declared output.")
                    } else {
                        format!("Use '{id}' only when explicitly provided by the host; never broaden its permissions.")
                    }
                })
            })
        };
        manifest.insert(node.id.clone(), json!({
            "skills": node.capabilities.skills.iter().map(|id| make_entry(id, "skill")).collect::<Vec<_>>(),
            "connectors": node.capabilities.connectors.iter().map(|id| make_entry(id, "connector")).collect::<Vec<_>>(),
            "tools": node.capabilities.tools,
            "permissions": node.capabilities.permissions,
        }));
    }
    json!(manifest)
}

fn code_manifest(workflow: &Workflow, target: &str, order: &[String]) -> Value {
    let dependencies: BTreeMap<String, Vec<String>> = order.iter().map(|id| {
        let mut values: Vec<String> = workflow.spec.edges.iter().filter(|edge| edge.to == *id).map(|edge| edge.from.clone()).collect();
        values.sort();
        (id.clone(), values)
    }).collect();
    json!({
        "metadata": {
            "target": target,
            "sourceHash": hash_workflow(workflow),
            "compilerVersion": COMPILER_VERSION,
            "adapterVersion": format!("{target}-data-v1"),
            "deterministic": true,
        },
        "workflow": workflow,
        "nodeOrder": order,
        "dependencies": dependencies,
        "capabilities": capability_manifest(workflow),
    })
}

fn python_literal(value: &Value, depth: usize) -> String {
    let indent = "    ".repeat(depth);
    let child_indent = "    ".repeat(depth + 1);
    match value {
        Value::Null => "None".into(),
        Value::Bool(value) => if *value { "True".into() } else { "False".into() },
        Value::Number(value) => value.to_string(),
        Value::String(value) => serde_json::to_string(value).unwrap_or_else(|_| "\"\"".into()),
        Value::Array(values) => {
            if values.is_empty() { return "[]".into(); }
            let body = values.iter().map(|item| format!("{}{},", child_indent, python_literal(item, depth + 1))).collect::<Vec<_>>().join("\n");
            format!("[\n{body}\n{indent}]")
        }
        Value::Object(values) => {
            if values.is_empty() { return "{}".into(); }
            let mut entries: Vec<(&String, &Value)> = values.iter().collect();
            entries.sort_by(|left, right| left.0.cmp(right.0));
            let body = entries.iter().map(|(key, item)| {
                let encoded_key = serde_json::to_string(key).unwrap_or_else(|_| "\"\"".into());
                format!("{}{}: {},", child_indent, encoded_key, python_literal(item, depth + 1))
            }).collect::<Vec<_>>().join("\n");
            format!("{{\n{body}\n{indent}}}")
        }
    }
}

fn compile_python(workflow: &Workflow, order: &[String]) -> String {
    let manifest = python_literal(&code_manifest(workflow, "python", order), 0);
    format!(r#""""Deterministic Ladder Graph workflow data.

Generated code performs no network, connector, agent, or model calls. Supply any
runtime handlers explicitly in the host application after validating capability
templates and permissions.
"""

from __future__ import annotations

from typing import Any, Final, Iterable


LADDER_GRAPH: Final[dict[str, Any]] = {manifest}
WORKFLOW: Final[dict[str, Any]] = LADDER_GRAPH["workflow"]
NODE_ORDER: Final[tuple[str, ...]] = tuple(LADDER_GRAPH["nodeOrder"])
DEPENDENCIES: Final[dict[str, list[str]]] = LADDER_GRAPH["dependencies"]
CAPABILITY_TEMPLATES: Final[dict[str, dict[str, Any]]] = LADDER_GRAPH["capabilities"]


def ready_nodes(completed: Iterable[str]) -> tuple[str, ...]:
    """Return ready node IDs in the compiler's stable topological order."""
    completed_ids = frozenset(completed)
    return tuple(
        node_id
        for node_id in NODE_ORDER
        if node_id not in completed_ids
        and all(dependency in completed_ids for dependency in DEPENDENCIES[node_id])
    )


def capability_contract(node_id: str) -> dict[str, Any]:
    """Return a node's declarative templates without invoking them."""
    if node_id not in CAPABILITY_TEMPLATES:
        raise KeyError(f"Unknown Ladder Graph node: {{node_id}}")
    return CAPABILITY_TEMPLATES[node_id]
"#)
}

fn compile_typescript(workflow: &Workflow, order: &[String]) -> String {
    let manifest = serde_json::to_string_pretty(&code_manifest(workflow, "typescript", order)).unwrap_or_else(|_| "{}".into());
    format!(r#"/**
 * Deterministic Ladder Graph workflow data.
 *
 * Generated code performs no network, connector, agent, or model calls. Supply
 * runtime handlers explicitly after validating capability templates and permissions.
 */

export const LADDER_GRAPH = {manifest} as const;

export type LadderGraphData = typeof LADDER_GRAPH;
export type LadderNodeId = LadderGraphData["nodeOrder"][number];

export const WORKFLOW = LADDER_GRAPH.workflow;
export const NODE_ORDER = LADDER_GRAPH.nodeOrder;
export const DEPENDENCIES = LADDER_GRAPH.dependencies;
export const CAPABILITY_TEMPLATES = LADDER_GRAPH.capabilities;

/** Return ready node IDs in the compiler's stable topological order. */
export function readyNodes(completed: ReadonlySet<string>): readonly LadderNodeId[] {{
  return NODE_ORDER.filter(
    (nodeId) => !completed.has(nodeId) && DEPENDENCIES[nodeId].every((dependency) => completed.has(dependency)),
  );
}}

/** Return a node's declarative templates without invoking them. */
export function capabilityContract(nodeId: LadderNodeId) {{
  return CAPABILITY_TEMPLATES[nodeId];
}}
"#)
}

fn yaml_scalar(value: &str) -> String {
    if value.contains(':') || value.contains('#') || value.contains('\n') || value.starts_with(['-', '?', '!', '&', '*', '{', '[']) {
        format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', " "))
    } else { value.to_string() }
}

fn analyze_inner(source: &str, target: Option<&str>) -> AnalysisResult {
    match parse(source) {
        Ok(workflow) => {
            let hash = hash_workflow(&workflow);
            let (diagnostics, order, stats) = validate(&workflow, target);
            let ok = !diagnostics.iter().any(|d| d.severity == "error");
            AnalysisResult { ok, source_hash: hash, diagnostics, normalized: Some(workflow), node_order: order, stats }
        }
        Err(error) => AnalysisResult { ok: false, source_hash: String::new(), diagnostics: vec![error], normalized: None, node_order: vec![], stats: Stats::default() }
    }
}

fn capability_report(workflow: &Workflow, target: &str) -> CapabilityReport {
    let has_multimodal_input = workflow.spec.nodes.iter().any(|n| {
        n.kind == "input" && n.input_schema.get("x-ladder-input-mode").and_then(Value::as_str).map(|mode| mode != "text").unwrap_or(false)
    });
    if target == "python" || target == "typescript" {
        let mut instructional = vec!["typed data contracts".into()];
        if has_multimodal_input { instructional.push("multimodal input contracts".into()); }
        if workflow.spec.nodes.iter().any(|n| n.kind == "loop") { instructional.push("bounded loops".into()); }
        if workflow.spec.nodes.iter().any(|n| n.kind == "approval") { instructional.push("human approval gates".into()); }
        if workflow.spec.nodes.iter().any(|n| n.kind == "group") { instructional.push("bounded group orchestration".into()); }
        if workflow.spec.nodes.iter().any(|n| n.kind == "aggregator") { instructional.push("multi-output aggregation".into()); }
        if workflow.spec.nodes.iter().any(|n| n.kind == "teacher") { instructional.push("teacher-model feedback".into()); }
        if workflow.spec.nodes.iter().any(|n| !n.config.working_directory.trim().is_empty()) { instructional.push("per-node working directories".into()); }
        if workflow.spec.nodes.iter().any(|n| !n.capabilities.connectors.is_empty()) { instructional.push("declared connector availability".into()); }
        if workflow.spec.nodes.iter().any(|n| !n.form_refs.is_empty()) { instructional.push("attached form contracts".into()); }
        return CapabilityReport {
            target: target.into(),
            native: vec!["typed workflow data".into(), "stable topological order".into(), "dependency map".into(), "pure readiness helper".into(), "capability templates".into()],
            instructional,
            unsupported: vec![],
        };
    }
    let mut native = vec!["ordered instructions".into(), "parallel delegation guidance".into(), "copy/paste workflow".into()];
    let mut instructional = vec!["typed data contracts".into()];
    if has_multimodal_input { instructional.push("multimodal input contracts".into()); }
    if workflow.spec.nodes.iter().any(|n| n.kind == "loop") { instructional.push("bounded loops".into()); }
    if workflow.spec.nodes.iter().any(|n| n.kind == "approval") { instructional.push("human approval gates".into()); }
    if workflow.spec.nodes.iter().any(|n| n.kind == "group") { instructional.push("bounded group orchestration".into()); }
    if workflow.spec.nodes.iter().any(|n| n.kind == "aggregator") { instructional.push("multi-output aggregation".into()); }
    if workflow.spec.nodes.iter().any(|n| n.kind == "teacher") { instructional.push("teacher-model feedback".into()); }
    if workflow.spec.nodes.iter().any(|n| !n.config.working_directory.trim().is_empty()) { instructional.push("per-node working directories".into()); }
    if workflow.spec.nodes.iter().any(|n| !n.capabilities.connectors.is_empty()) { instructional.push("declared connector availability".into()); }
    if workflow.spec.nodes.iter().any(|n| !n.form_refs.is_empty()) { instructional.push("attached form contracts".into()); }
    if target == "codex" { native.push("Agent Skills frontmatter".into()); }
    if target == "claude" { native.push("Claude Code skill frontmatter".into()); }
    if target == "hermes" {
        native.push("Hermes Agent SKILL.md metadata".into());
        native.push("Hermes toolset guidance".into());
    }
    CapabilityReport { target: target.into(), native, instructional, unsupported: vec![] }
}

pub fn analyze(source: &str, target: Option<&str>) -> AnalysisResult {
    analyze_inner(source, target)
}

pub fn format(source: &str) -> FormatResult {
    match parse(source) {
        Ok(workflow) => FormatResult {
            ok: true,
            content: serde_yaml_ng::to_string(&workflow).unwrap_or_default(),
            diagnostics: vec![],
        },
        Err(error) => FormatResult { ok: false, content: source.into(), diagnostics: vec![error] },
    }
}

pub fn compile(source: &str, target: &str) -> CompileResult {
    if !["codex", "claude", "hermes", "python", "typescript"].contains(&target) {
        return CompileResult {
            ok: false, content: String::new(), suggested_filename: String::new(), mime_type: "text/markdown".into(), source_hash: String::new(), compiler_version: COMPILER_VERSION.into(), adapter_version: "v1".into(),
            capability_report: CapabilityReport { target: target.into(), native: vec![], instructional: vec![], unsupported: vec!["unknown target".into()] },
            diagnostics: vec![diag("LG300", "error", "/target", "Target must be codex, claude, hermes, python, or typescript.")],
        };
    }
    let analysis = analyze_inner(source, Some(target));
    if !analysis.ok {
        return CompileResult { ok: false, content: String::new(), suggested_filename: String::new(), mime_type: "text/markdown".into(), source_hash: analysis.source_hash, compiler_version: COMPILER_VERSION.into(), adapter_version: "v1".into(), capability_report: CapabilityReport { target: target.into(), native: vec![], instructional: vec![], unsupported: vec!["invalid LGIR".into()] }, diagnostics: analysis.diagnostics };
    }
    let workflow = analysis.normalized.expect("valid analysis includes workflow");
    let is_python = target == "python";
    let is_typescript = target == "typescript";
    let content = if is_python { compile_python(&workflow, &analysis.node_order) } else if is_typescript { compile_typescript(&workflow, &analysis.node_order) } else { compile_workflow(&workflow, target, &analysis.node_order) };
    CompileResult {
        ok: true,
        content,
        suggested_filename: if is_python { format!("{}.ladder.py", workflow.metadata.name) } else if is_typescript { format!("{}.ladder.ts", workflow.metadata.name) } else { format!("{}.{}.md", workflow.metadata.name, target) },
        mime_type: if is_python { "text/x-python".into() } else if is_typescript { "text/typescript".into() } else { "text/markdown".into() },
        source_hash: analysis.source_hash,
        compiler_version: COMPILER_VERSION.into(),
        adapter_version: if is_python || is_typescript { format!("{target}-data-v1") } else { format!("{target}-skill-v1") },
        capability_report: capability_report(&workflow, target),
        diagnostics: analysis.diagnostics,
    }
}

pub fn migrate(source: &str, to_version: &str) -> FormatResult {
    if to_version != API_VERSION {
        return FormatResult {
            ok: false,
            content: source.into(),
            diagnostics: vec![diag("LG400", "error", "/apiVersion", format!("No migration path exists to {to_version}."))],
        };
    }
    match parse(source) {
        Ok(mut workflow) => {
            workflow.api_version = API_VERSION.into();
            FormatResult { ok: true, content: serde_yaml_ng::to_string(&workflow).unwrap_or_default(), diagnostics: vec![] }
        }
        Err(error) => FormatResult { ok: false, content: source.into(), diagnostics: vec![error] },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = r#"
apiVersion: ladder.dev/v1alpha1
kind: Workflow
metadata:
  name: smoke-test
  title: Smoke test
spec:
  objective: Produce a reviewed answer.
  nodes:
    - id: input
      kind: input
      name: Request
    - id: writer
      kind: agent
      name: Writer
      role: Writer
      prompt: Draft the answer.
    - id: output
      kind: output
      name: Answer
  edges:
    - id: e1
      from: input
      to: writer
      kind: dependency
    - id: e2
      from: writer
      to: output
      kind: dependency
"#;

    #[test]
    fn validates_and_compiles_deterministically() {
        let analysis = analyze_inner(VALID, Some("codex"));
        assert!(analysis.ok, "{:?}", analysis.diagnostics);
        let first = compile(VALID, "codex");
        let second = compile(VALID, "codex");
        assert_eq!(first.content, second.content);
        assert!(first.content.contains("ladder-source-hash"));
    }

    #[test]
    fn validates_and_compiles_attached_form_contracts() {
        let source = VALID.replace("      name: Request", "      name: Request\n      formRefs: [ladder://forms/user/request]");
        let analysis = analyze_inner(&source, Some("codex"));
        assert!(analysis.ok, "{:?}", analysis.diagnostics);
        let output = compile(&source, "codex");
        assert!(output.content.contains("**Attached forms:** `ladder://forms/user/request`"));
        assert!(output.capability_report.instructional.contains(&"attached form contracts".into()));

        let invalid = source.replace("ladder://forms/user/request", "ladder://forms/");
        assert!(analyze_inner(&invalid, None).diagnostics.iter().any(|diagnostic| diagnostic.code == "LG196"));
    }

    #[test]
    fn validates_and_compiles_aggregation_with_teacher_feedback() {
        let source = r#"
apiVersion: ladder.dev/v1alpha1
kind: Workflow
metadata:
  name: teacher-feedback
spec:
  objective: Aggregate two drafts and request teacher feedback.
  nodes:
    - id: first
      kind: agent
      name: First draft
      role: Writer
      prompt: Produce the first draft.
    - id: second
      kind: agent
      name: Second draft
      role: Writer
      prompt: Produce the second draft.
    - id: combined
      kind: aggregator
      name: Combined drafts
      config:
        aggregation: collect
    - id: teacher
      kind: teacher
      name: Teacher feedback
      role: Teacher
      prompt: Provide actionable feedback.
      config:
        teacherModel: host:teacher
        feedbackMode: critique
        workingDirectory: packages/reviewer
    - id: output
      kind: output
      name: Feedback
  edges:
    - { id: e1, from: first, to: combined, kind: data }
    - { id: e2, from: second, to: combined, kind: data }
    - { id: e3, from: combined, to: teacher, kind: data }
    - { id: e4, from: teacher, to: output, kind: data }
"#;
        let analysis = analyze_inner(source, Some("codex"));
        assert!(analysis.ok, "{:?}", analysis.diagnostics);
        assert_eq!(analysis.stats.agents, 3);
        let output = compile(source, "codex");
        assert!(output.content.contains("ordered array of { source, value } entries"));
        assert!(output.content.contains("teacher model reference `host:teacher` in `critique` mode"));
        assert!(output.content.contains("**Working directory:** `packages/reviewer`"));
        assert!(output.capability_report.instructional.contains(&"per-node working directories".into()));
        assert!(output.capability_report.instructional.contains(&"multi-output aggregation".into()));
        assert!(output.capability_report.instructional.contains(&"teacher-model feedback".into()));
    }

    #[test]
    fn compiles_deterministic_code_targets() {
        let python_first = compile(VALID, "python");
        let python_second = compile(VALID, "python");
        let typescript = compile(VALID, "typescript");
        assert_eq!(python_first.content, python_second.content);
        assert_eq!(python_first.suggested_filename, "smoke-test.ladder.py");
        assert!(python_first.content.contains("def ready_nodes"));
        assert_eq!(typescript.suggested_filename, "smoke-test.ladder.ts");
        assert!(typescript.content.contains("export function readyNodes"));
        assert!(typescript.content.contains("capability templates"));
    }

    #[test]
    fn compiles_hermes_agent_skill() {
        let first = compile(VALID, "hermes");
        let second = compile(VALID, "hermes");
        assert_eq!(first.content, second.content);
        assert_eq!(first.suggested_filename, "smoke-test.hermes.md");
        assert!(first.content.contains("ladder-target: hermes"));
        assert!(first.capability_report.native.contains(&"Hermes Agent SKILL.md metadata".into()));
        assert!(first.content.contains("~/.hermes/skills/ladder-graph/smoke-test/SKILL.md"));
        assert_eq!(first.adapter_version, "hermes-skill-v1");
    }

    #[test]
    fn rejects_arbitrary_cycles() {
        let cyclic = VALID.replace("from: writer\n      to: output", "from: writer\n      to: input");
        let analysis = analyze_inner(&cyclic, None);
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG150"));
    }

    #[test]
    fn requires_bounded_loops() {
        let loop_source = VALID.replace("    - id: output", "    - id: revise\n      kind: loop\n      name: Revise\n      config:\n        body: [writer]\n        exitCondition: score >= 0.8\n        maxIterations: 0\n    - id: output");
        let analysis = analyze_inner(&loop_source, Some("claude"));
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG120"));
    }

    #[test]
    fn compiles_declared_connectors() {
        let with_connector = VALID.replace("prompt: Draft the answer.", "prompt: Draft the answer.\n      capabilities:\n        skills: [implementation]\n        connectors: [mcp:github]");
        let analysis = analyze_inner(&with_connector, Some("codex"));
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG201"));
        let output = compile(&with_connector, "codex");
        assert!(output.content.contains("**Required connectors:** mcp:github"));
        assert!(output.content.contains(".agents/skills/"));
    }

    #[test]
    fn compiles_multimodal_input_contracts() {
        let with_image = VALID.replace(
            "name: Request",
            "name: Request\n      inputSchema:\n        type: object\n        required: [asset]\n        properties:\n          asset:\n            type: string\n            contentMediaType: image/*\n        x-ladder-input-mode: image",
        );
        let output = compile(&with_image, "codex");
        assert!(output.content.contains("Expected input contract"));
        assert!(output.content.contains("contentMediaType"));
        assert!(output.capability_report.instructional.contains(&"multimodal input contracts".into()));
    }

    #[test]
    fn rejects_aliases_and_external_references() {
        let alias = VALID.replace("title: Smoke test", "title: &shared Smoke test");
        let external = VALID.replace("prompt: Draft the answer.", "outputSchema:\n        $ref: https://example.com/schema.json\n      prompt: Draft the answer.");
        assert_eq!(parse(&alias).unwrap_err().code, "LG004");
        assert_eq!(parse(&external).unwrap_err().code, "LG005");
    }

    #[test]
    fn validates_executable_condition_contracts() {
        let source = VALID.replace(
            "    - id: output",
            "    - id: route\n      kind: condition\n      name: Route\n      config:\n        expression: result.status\n        router: host:status-router\n        defaultBranch: default\n        branches:\n          - { label: Pass, when: pass }\n          - { label: Default, when: default }\n    - id: output",
        ).replace(
            "from: writer\n      to: output\n      kind: dependency",
            "from: writer\n      to: route\n      kind: dependency\n    - id: e3\n      from: route\n      to: output\n      kind: control\n      condition: unknown",
        );
        let analysis = analyze_inner(&source, None);
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG163" && d.edge_id.as_deref() == Some("e3")));
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG164"));
    }

    #[test]
    fn validates_loop_boundaries_and_data_mappings() {
        let source = VALID.replace(
            "    - id: output",
            "    - id: revise\n      kind: loop\n      name: Revise\n      config:\n        body: [writer]\n        entry: missing\n        exitNode: writer\n        exitCondition: score >= 0.8\n        maxIterations: 3\n        onExhausted: warn\n    - id: output",
        ).replace(
            "    - id: e2",
            "    - id: map\n      from: input\n      to: writer\n      kind: data\n      sourcePath: /request\n    - id: loop-exit\n      from: revise\n      to: output\n      kind: control\n      condition: loop_exit\n    - id: e2",
        );
        let analysis = analyze_inner(&source, None);
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG171"));
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG175"));
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG183" && d.edge_id.as_deref() == Some("map")));
    }

    #[test]
    fn validates_and_compiles_loop_carry_state() {
        let source = VALID.replace(
            "    - id: output",
            "    - id: debate-loop\n      kind: loop\n      name: Debate rounds\n      config:\n        body: [writer]\n        entry: writer\n        exitNode: writer\n        exitCondition: moderator.consensusReached\n        maxIterations: 3\n        onExhausted: stop\n        carry:\n          moderator: /results/writer\n    - id: output",
        ).replace(
            "    - id: e2",
            "    - id: loop-exit\n      from: debate-loop\n      to: output\n      kind: control\n      condition: loop_exit\n    - id: e2",
        );
        let analysis = analyze_inner(&source, None);
        assert!(!analysis.diagnostics.iter().any(|d| d.code == "LG177" || d.code == "LG178"));
        let output = compile(&source, "codex");
        assert!(output.content.contains("`moderator` from `/results/writer`"));
        assert!(output.content.contains("`/loopState/debate-loop/<slot>`"));

        let invalid = source.replace("moderator: /results/writer", "'bad slot': not-a-pointer");
        let analysis = analyze_inner(&invalid, None);
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG177"));
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG178"));

        let misplaced = VALID.replace("prompt: Draft the answer.", "prompt: Draft the answer.\n      config:\n        carry:\n          review: /results/writer");
        let analysis = analyze_inner(&misplaced, None);
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG179"));
    }

    #[test]
    fn accepts_explicit_subgraph_state_contract() {
        let source = VALID.replace(
            "kind: agent\n      name: Writer\n      role: Writer\n      prompt: Draft the answer.",
            "kind: subgraph\n      name: Writer graph\n      config:\n        subgraph:\n          ref: ladder://workflows/writer\n          inputMap:\n            request: /inputs/request\n          outputMap:\n            result: /results/writer\n          checkpointer: inherit",
        );
        let analysis = analyze_inner(&source, None);
        assert!(!analysis.diagnostics.iter().any(|d| d.code.starts_with("LG19") && d.severity == "error"), "{:?}", analysis.diagnostics);
    }
}
