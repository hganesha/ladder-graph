use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use thiserror::Error;

include!(concat!(env!("OUT_DIR"), "/builtin_catalog.rs"));

pub const SNAPSHOT_SCHEMA_VERSION: u32 = 1;
pub const MAX_ENTRY_BYTES: usize = 2_000_000;
pub const MAX_SNAPSHOT_BYTES: usize = 32_000_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CatalogKind {
    Workflow,
    AgentTemplate,
}

impl CatalogKind {
    pub fn collection(self) -> &'static str {
        match self {
            Self::Workflow => "workflows",
            Self::AgentTemplate => "agents",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CatalogScope {
    Builtin,
    User,
}

impl CatalogScope {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Builtin => "builtin",
            Self::User => "user",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry {
    pub id: String,
    pub kind: CatalogKind,
    pub scope: CatalogScope,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub source_hash: String,
    #[serde(default = "yaml_media_type")]
    pub media_type: String,
    pub content: String,
}

fn yaml_media_type() -> String {
    "application/yaml".into()
}

impl CatalogEntry {
    pub fn uri(&self) -> String {
        format!(
            "ladder://{}/{}/{}",
            self.kind.collection(),
            self.scope.as_str(),
            self.id
        )
    }

    pub fn refresh_hash(&mut self) {
        self.source_hash = source_hash(&self.content);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSnapshot {
    pub schema_version: u32,
    pub installation_id: String,
    pub published_at: String,
    pub revision: String,
    pub entries: Vec<CatalogEntry>,
}

#[derive(Debug, Clone)]
pub struct Catalog {
    entries: Vec<CatalogEntry>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorkflowFormat {
    SourceYaml,
    NormalizedYaml,
    Json,
    Markdown,
    Compiled,
}

impl WorkflowFormat {
    pub fn parse(value: Option<&str>) -> Result<Self, CatalogError> {
        match value.unwrap_or("source-yaml") {
            "source-yaml" | "yaml" => Ok(Self::SourceYaml),
            "normalized-yaml" => Ok(Self::NormalizedYaml),
            "json" => Ok(Self::Json),
            "markdown" => Ok(Self::Markdown),
            "compiled" => Ok(Self::Compiled),
            value => Err(CatalogError::UnsupportedFormat(value.into())),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentFormat {
    Yaml,
    Json,
    Markdown,
}

impl AgentFormat {
    pub fn parse(value: Option<&str>) -> Result<Self, CatalogError> {
        match value.unwrap_or("yaml") {
            "yaml" | "source-yaml" => Ok(Self::Yaml),
            "json" => Ok(Self::Json),
            "markdown" => Ok(Self::Markdown),
            value => Err(CatalogError::UnsupportedFormat(value.into())),
        }
    }
}

#[derive(Debug, Error)]
pub enum CatalogError {
    #[error("catalog entry was not found: {0}")]
    NotFound(String),
    #[error("ambiguous catalog ID; specify a resource URI or scope: {0}")]
    Ambiguous(String),
    #[error("invalid catalog URI: {0}")]
    InvalidUri(String),
    #[error("unsupported output format: {0}")]
    UnsupportedFormat(String),
    #[error("compiled workflow format requires a target")]
    MissingTarget,
    #[error("unsupported compile target: {0}")]
    UnsupportedTarget(String),
    #[error("invalid snapshot: {0}")]
    InvalidSnapshot(String),
    #[error("catalog I/O failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("catalog JSON failed: {0}")]
    Json(#[from] serde_json::Error),
    #[error("catalog YAML failed: {0}")]
    Yaml(#[from] serde_yaml_ng::Error),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    workflows: Vec<ManifestWorkflow>,
    agents: Vec<ManifestAgent>,
}

#[derive(Debug, Deserialize)]
struct ManifestWorkflow {
    id: String,
    path: String,
    area: String,
    description: String,
}

#[derive(Debug, Deserialize)]
struct ManifestAgent {
    id: String,
    path: String,
}

impl Catalog {
    pub fn load(snapshot_path: Option<&Path>) -> Result<Self, CatalogError> {
        let mut entries = builtin_entries()?;
        if let Some(path) = snapshot_path
            && path.exists()
        {
            entries.extend(read_snapshot(path)?.entries);
        }
        entries.sort_by(|left, right| {
            (
                left.kind.collection(),
                left.scope.as_str(),
                left.title.to_lowercase(),
                &left.id,
            )
                .cmp(&(
                    right.kind.collection(),
                    right.scope.as_str(),
                    right.title.to_lowercase(),
                    &right.id,
                ))
        });
        Ok(Self { entries })
    }

    pub fn entries(&self) -> &[CatalogEntry] {
        &self.entries
    }

    pub fn search(
        &self,
        query: &str,
        kind: Option<CatalogKind>,
        scope: Option<CatalogScope>,
        limit: usize,
    ) -> Vec<&CatalogEntry> {
        let words = query
            .split_whitespace()
            .map(str::to_lowercase)
            .collect::<Vec<_>>();
        self.entries
            .iter()
            .filter(|entry| kind.is_none_or(|kind| entry.kind == kind))
            .filter(|entry| scope.is_none_or(|scope| entry.scope == scope))
            .filter(|entry| {
                let haystack = format!(
                    "{} {} {} {} {}",
                    entry.id,
                    entry.title,
                    entry.description,
                    entry.tags.join(" "),
                    entry.content
                )
                .to_lowercase();
                words.iter().all(|word| haystack.contains(word))
            })
            .take(limit.min(100))
            .collect()
    }

    pub fn resolve(
        &self,
        identifier: &str,
        expected_kind: Option<CatalogKind>,
        scope: Option<CatalogScope>,
    ) -> Result<&CatalogEntry, CatalogError> {
        if identifier.starts_with("ladder://") {
            let (kind, uri_scope, id) = parse_uri(identifier)?;
            if expected_kind.is_some_and(|expected| expected != kind) {
                return Err(CatalogError::NotFound(identifier.into()));
            }
            return self
                .entries
                .iter()
                .find(|entry| entry.kind == kind && entry.scope == uri_scope && entry.id == id)
                .ok_or_else(|| CatalogError::NotFound(identifier.into()));
        }

        let matches = self
            .entries
            .iter()
            .filter(|entry| expected_kind.is_none_or(|kind| entry.kind == kind))
            .filter(|entry| scope.is_none_or(|scope| entry.scope == scope))
            .filter(|entry| entry.id == identifier)
            .collect::<Vec<_>>();
        match matches.as_slice() {
            [entry] => Ok(entry),
            [] => Err(CatalogError::NotFound(identifier.into())),
            _ => Err(CatalogError::Ambiguous(identifier.into())),
        }
    }

    pub fn render_workflow(
        &self,
        entry: &CatalogEntry,
        format: WorkflowFormat,
        target: Option<&str>,
    ) -> Result<(String, String), CatalogError> {
        if entry.kind != CatalogKind::Workflow {
            return Err(CatalogError::NotFound(entry.id.clone()));
        }
        match format {
            WorkflowFormat::SourceYaml => Ok((entry.content.clone(), "application/yaml".into())),
            WorkflowFormat::NormalizedYaml => {
                let result = lgir_core::format(&entry.content);
                if !result.ok {
                    return Err(CatalogError::InvalidSnapshot(format!(
                        "workflow {} is invalid",
                        entry.id
                    )));
                }
                Ok((result.content, "application/yaml".into()))
            }
            WorkflowFormat::Json => Ok((yaml_to_json(&entry.content)?, "application/json".into())),
            WorkflowFormat::Markdown => {
                Ok((workflow_markdown(&entry.content)?, "text/markdown".into()))
            }
            WorkflowFormat::Compiled => {
                let target = target.ok_or(CatalogError::MissingTarget)?;
                if !["codex", "claude", "hermes", "python", "typescript"].contains(&target) {
                    return Err(CatalogError::UnsupportedTarget(target.into()));
                }
                let result = lgir_core::compile(&entry.content, target);
                if !result.ok {
                    return Err(CatalogError::InvalidSnapshot(format!(
                        "workflow {} is invalid",
                        entry.id
                    )));
                }
                Ok((result.content, result.mime_type))
            }
        }
    }

    pub fn render_agent(
        &self,
        entry: &CatalogEntry,
        format: AgentFormat,
    ) -> Result<(String, String), CatalogError> {
        if entry.kind != CatalogKind::AgentTemplate {
            return Err(CatalogError::NotFound(entry.id.clone()));
        }
        match format {
            AgentFormat::Yaml => Ok((entry.content.clone(), "application/yaml".into())),
            AgentFormat::Json => Ok((yaml_to_json(&entry.content)?, "application/json".into())),
            AgentFormat::Markdown => Ok((agent_markdown(&entry.content)?, "text/markdown".into())),
        }
    }
}

fn builtin_entries() -> Result<Vec<CatalogEntry>, CatalogError> {
    let manifest: Manifest = serde_json::from_str(BUILTIN_MANIFEST)?;
    let workflows = manifest
        .workflows
        .into_iter()
        .map(|item| (item.id.clone(), item))
        .collect::<BTreeMap<_, _>>();
    let agents = manifest
        .agents
        .into_iter()
        .map(|item| (item.id.clone(), item))
        .collect::<BTreeMap<_, _>>();
    let mut entries = Vec::with_capacity(BUILTIN_ASSETS.len());
    for (path, content) in BUILTIN_ASSETS {
        let id = Path::new(path)
            .file_stem()
            .and_then(|value| value.to_str())
            .ok_or_else(|| CatalogError::InvalidSnapshot(format!("invalid built-in path {path}")))?
            .to_string();
        let document: Value = serde_yaml_ng::from_str(content)?;
        let metadata = document.get("metadata").and_then(Value::as_object);
        let title = metadata
            .and_then(|value| value.get("title"))
            .and_then(Value::as_str)
            .unwrap_or(&id)
            .to_string();
        let version = metadata
            .and_then(|value| value.get("version"))
            .and_then(Value::as_str)
            .unwrap_or("1.0.0")
            .to_string();
        let (kind, description, tags) = if path.starts_with("workflows/") {
            let item = workflows.get(&id).ok_or_else(|| {
                CatalogError::InvalidSnapshot(format!("workflow {id} is missing from manifest"))
            })?;
            (
                CatalogKind::Workflow,
                item.description.clone(),
                tags_from_path(&item.path, Some(&item.area)),
            )
        } else {
            let item = agents.get(&id).ok_or_else(|| {
                CatalogError::InvalidSnapshot(format!("agent {id} is missing from manifest"))
            })?;
            let description = metadata
                .and_then(|value| value.get("description"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            (
                CatalogKind::AgentTemplate,
                description,
                tags_from_path(&item.path, None),
            )
        };
        entries.push(CatalogEntry {
            id,
            kind,
            scope: CatalogScope::Builtin,
            title,
            description,
            version,
            tags,
            updated_at: None,
            source_hash: source_hash(content),
            media_type: yaml_media_type(),
            content: (*content).into(),
        });
    }
    Ok(entries)
}

fn tags_from_path(path: &str, additional: Option<&str>) -> Vec<String> {
    let mut tags = path
        .split('/')
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    if let Some(value) = additional {
        tags.push(value.to_lowercase());
    }
    tags.sort();
    tags.dedup();
    tags
}

pub fn source_hash(content: &str) -> String {
    format!("sha256:{}", hex::encode(Sha256::digest(content.as_bytes())))
}

pub fn validate_snapshot(mut snapshot: CatalogSnapshot) -> Result<CatalogSnapshot, CatalogError> {
    if snapshot.schema_version != SNAPSHOT_SCHEMA_VERSION {
        return Err(CatalogError::InvalidSnapshot(format!(
            "expected schemaVersion {SNAPSHOT_SCHEMA_VERSION}"
        )));
    }
    if snapshot.installation_id.trim().is_empty() || snapshot.installation_id.len() > 128 {
        return Err(CatalogError::InvalidSnapshot(
            "installationId is required".into(),
        ));
    }
    if snapshot.entries.len() > 1_000 {
        return Err(CatalogError::InvalidSnapshot(
            "at most 1,000 user entries may be published".into(),
        ));
    }
    let mut identities = BTreeMap::new();
    for entry in &mut snapshot.entries {
        if entry.scope != CatalogScope::User {
            return Err(CatalogError::InvalidSnapshot(format!(
                "entry {} must have user scope",
                entry.id
            )));
        }
        if entry.id.is_empty()
            || entry.id.len() > 128
            || !entry
                .id
                .chars()
                .all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_' | '.'))
        {
            return Err(CatalogError::InvalidSnapshot(format!(
                "entry {} has an invalid ID",
                entry.id
            )));
        }
        if entry.content.len() > MAX_ENTRY_BYTES {
            return Err(CatalogError::InvalidSnapshot(format!(
                "entry {} exceeds 2 MB",
                entry.id
            )));
        }
        if identities
            .insert((entry.kind, entry.id.clone()), ())
            .is_some()
        {
            return Err(CatalogError::InvalidSnapshot(format!(
                "duplicate entry {}",
                entry.id
            )));
        }
        match entry.kind {
            CatalogKind::Workflow => {
                let analysis = lgir_core::analyze(&entry.content, None);
                if !analysis.ok {
                    return Err(CatalogError::InvalidSnapshot(format!(
                        "workflow {} failed LGIR validation",
                        entry.id
                    )));
                }
            }
            CatalogKind::AgentTemplate => {
                let document: Value = serde_yaml_ng::from_str(&entry.content)?;
                if document.get("kind").and_then(Value::as_str) != Some("AgentTemplate") {
                    return Err(CatalogError::InvalidSnapshot(format!(
                        "agent {} must have kind AgentTemplate",
                        entry.id
                    )));
                }
            }
        }
        entry.media_type = yaml_media_type();
        entry.refresh_hash();
    }
    snapshot.entries.sort_by(|left, right| {
        (left.kind.collection(), &left.id).cmp(&(right.kind.collection(), &right.id))
    });
    snapshot.revision = snapshot_revision(&snapshot.entries)?;
    Ok(snapshot)
}

fn snapshot_revision(entries: &[CatalogEntry]) -> Result<String, CatalogError> {
    let bytes = serde_json::to_vec(entries)?;
    Ok(format!("sha256:{}", hex::encode(Sha256::digest(bytes))))
}

pub fn read_snapshot(path: &Path) -> Result<CatalogSnapshot, CatalogError> {
    let metadata = fs::metadata(path)?;
    if metadata.len() > MAX_SNAPSHOT_BYTES as u64 {
        return Err(CatalogError::InvalidSnapshot(
            "snapshot exceeds 32 MB".into(),
        ));
    }
    validate_snapshot(serde_json::from_slice(&fs::read(path)?)?)
}

pub fn write_snapshot(
    path: &Path,
    snapshot: CatalogSnapshot,
) -> Result<CatalogSnapshot, CatalogError> {
    let snapshot = validate_snapshot(snapshot)?;
    let parent = path
        .parent()
        .ok_or_else(|| CatalogError::InvalidSnapshot("snapshot path has no parent".into()))?;
    fs::create_dir_all(parent)?;
    let temporary = temporary_path(path);
    let bytes = serde_json::to_vec_pretty(&snapshot)?;
    if bytes.len() > MAX_SNAPSHOT_BYTES {
        return Err(CatalogError::InvalidSnapshot(
            "snapshot exceeds 32 MB".into(),
        ));
    }
    let mut file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)?;
    file.write_all(&bytes)?;
    file.write_all(b"\n")?;
    file.sync_all()?;
    #[cfg(windows)]
    if path.exists() {
        fs::remove_file(path)?;
    }
    fs::rename(&temporary, path)?;
    if let Ok(directory) = fs::File::open(parent) {
        let _ = directory.sync_all();
    }
    Ok(snapshot)
}

fn temporary_path(path: &Path) -> PathBuf {
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("catalog.json");
    path.with_file_name(format!(".{filename}.{}.tmp", std::process::id()))
}

pub fn parse_uri(uri: &str) -> Result<(CatalogKind, CatalogScope, String), CatalogError> {
    let without_scheme = uri
        .strip_prefix("ladder://")
        .ok_or_else(|| CatalogError::InvalidUri(uri.into()))?;
    let without_query = without_scheme.split('?').next().unwrap_or(without_scheme);
    let parts = without_query.split('/').collect::<Vec<_>>();
    if parts.len() != 3 || parts[2].is_empty() {
        return Err(CatalogError::InvalidUri(uri.into()));
    }
    let kind = match parts[0] {
        "workflows" => CatalogKind::Workflow,
        "agents" => CatalogKind::AgentTemplate,
        _ => return Err(CatalogError::InvalidUri(uri.into())),
    };
    let scope = match parts[1] {
        "builtin" => CatalogScope::Builtin,
        "user" => CatalogScope::User,
        _ => return Err(CatalogError::InvalidUri(uri.into())),
    };
    Ok((kind, scope, parts[2].to_string()))
}

fn yaml_to_json(source: &str) -> Result<String, CatalogError> {
    let value: Value = serde_yaml_ng::from_str(source)?;
    Ok(serde_json::to_string_pretty(&value)?)
}

fn workflow_markdown(source: &str) -> Result<String, CatalogError> {
    let analysis = lgir_core::analyze(source, None);
    let workflow = analysis
        .normalized
        .ok_or_else(|| CatalogError::InvalidSnapshot("workflow failed LGIR validation".into()))?;
    let mut output = format!(
        "# {}\n\n{}\n\n## Objective\n\n{}\n\n## Nodes\n\n",
        if workflow.metadata.title.is_empty() {
            &workflow.metadata.name
        } else {
            &workflow.metadata.title
        },
        workflow.metadata.description,
        workflow.spec.objective,
    );
    for node in workflow.spec.nodes {
        output.push_str(&format!(
            "- `{}` — **{}** ({})",
            node.id, node.name, node.kind
        ));
        if !node.summary.is_empty() {
            output.push_str(&format!(": {}", node.summary));
        }
        output.push('\n');
    }
    Ok(output)
}

fn agent_markdown(source: &str) -> Result<String, CatalogError> {
    let document: Value = serde_yaml_ng::from_str(source)?;
    let title = document
        .pointer("/metadata/title")
        .and_then(Value::as_str)
        .unwrap_or("Agent template");
    let role = document
        .pointer("/spec/role")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let prompt = document
        .pointer("/spec/prompt")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let capabilities = document
        .pointer("/spec/capabilities")
        .cloned()
        .unwrap_or(Value::Null);
    Ok(format!(
        "# {title}\n\n**Role:** {role}\n\n## Instructions\n\n{prompt}\n\n## Capabilities\n\n```json\n{}\n```\n",
        serde_json::to_string_pretty(&capabilities)?
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embeds_the_active_builtin_catalog() {
        let catalog = Catalog::load(None).unwrap();
        assert_eq!(
            catalog
                .entries()
                .iter()
                .filter(|entry| entry.kind == CatalogKind::Workflow)
                .count(),
            29
        );
        assert_eq!(
            catalog
                .entries()
                .iter()
                .filter(|entry| entry.kind == CatalogKind::AgentTemplate)
                .count(),
            119
        );
        assert!(
            catalog
                .resolve(
                    "refinement",
                    Some(CatalogKind::Workflow),
                    Some(CatalogScope::Builtin)
                )
                .is_ok()
        );
    }

    #[test]
    fn validates_and_atomically_round_trips_a_user_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("catalog-v1.json");
        let builtin = Catalog::load(None)
            .unwrap()
            .resolve(
                "refinement",
                Some(CatalogKind::Workflow),
                Some(CatalogScope::Builtin),
            )
            .unwrap()
            .clone();
        let snapshot = CatalogSnapshot {
            schema_version: 1,
            installation_id: "installation-test".into(),
            published_at: "2026-08-16T00:00:00Z".into(),
            revision: String::new(),
            entries: vec![CatalogEntry {
                id: "user-workflow".into(),
                scope: CatalogScope::User,
                ..builtin
            }],
        };
        let written = write_snapshot(&path, snapshot).unwrap();
        assert!(written.revision.starts_with("sha256:"));
        let loaded = Catalog::load(Some(&path)).unwrap();
        assert!(
            loaded
                .resolve(
                    "user-workflow",
                    Some(CatalogKind::Workflow),
                    Some(CatalogScope::User)
                )
                .is_ok()
        );
    }

    #[test]
    fn renders_workflow_representations() {
        let catalog = Catalog::load(None).unwrap();
        let entry = catalog
            .resolve(
                "refinement",
                Some(CatalogKind::Workflow),
                Some(CatalogScope::Builtin),
            )
            .unwrap();
        assert!(
            catalog
                .render_workflow(entry, WorkflowFormat::Json, None)
                .unwrap()
                .0
                .contains("Draft, critique, revise")
        );
        assert!(
            catalog
                .render_workflow(entry, WorkflowFormat::Markdown, None)
                .unwrap()
                .0
                .contains("## Nodes")
        );
        assert!(
            catalog
                .render_workflow(entry, WorkflowFormat::Compiled, Some("codex"))
                .unwrap()
                .0
                .contains("ladder-target: codex")
        );
    }
}
