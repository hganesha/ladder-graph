use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::diagnostic::Diagnostic;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactAnalysisResult {
    pub ok: bool,
    pub source_hash: String,
    pub diagnostics: Vec<Diagnostic>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub normalized: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OntologySelection {
    #[serde(default)]
    pub type_ids: Vec<String>,
    #[serde(default)]
    pub property_refs: Vec<String>,
    #[serde(default)]
    pub relationship_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OntologySliceResult {
    pub ok: bool,
    pub source_hash: String,
    pub selection_hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ontology: Option<Value>,
    pub included_type_ids: Vec<String>,
    pub included_property_refs: Vec<String>,
    pub included_relationship_ids: Vec<String>,
    pub inclusion_reasons: std::collections::BTreeMap<String, Vec<String>>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedBundleAsset {
    pub r#ref: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompiledArtifact {
    pub path: String,
    pub mime_type: String,
    pub content: String,
    pub source_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleCapabilityReport {
    pub target: String,
    pub native: Vec<String>,
    pub instructional: Vec<String>,
    pub unsupported: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleCompileResult {
    pub ok: bool,
    pub artifacts: Vec<CompiledArtifact>,
    pub lockfile: Option<Value>,
    pub diagnostics: Vec<Diagnostic>,
    pub capability_report: BundleCapabilityReport,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatResult {
    pub ok: bool,
    pub content: String,
    pub diagnostics: Vec<Diagnostic>,
}
