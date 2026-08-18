mod bundle;
mod compile;
mod diagnostic;
mod document;
mod form;
mod model;
mod ontology;
mod parse;
mod security;

pub use model::{
    ArtifactAnalysisResult, BundleCompileResult, FormatResult, OntologySelection,
    OntologySliceResult,
};

use serde_json::Value;

use diagnostic::diagnostic;
use parse::{parse_value, value_hash, yaml};

const API_VERSION: &str = "ladder.dev/v1alpha1";

fn slug(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        && !value.starts_with('-')
        && !value.ends_with('-')
        && !value.contains("--")
}

pub fn analyze_artifact(source: &str) -> ArtifactAnalysisResult {
    let artifact = match parse_value(source) {
        Ok(value) => value,
        Err(error) => {
            return ArtifactAnalysisResult {
                ok: false,
                source_hash: String::new(),
                diagnostics: vec![error],
                normalized: None,
            };
        }
    };
    let mut diagnostics = vec![];
    if artifact.get("apiVersion").and_then(Value::as_str) != Some(API_VERSION) {
        diagnostics.push(diagnostic(
            "LA101",
            "error",
            "/apiVersion",
            format!("Expected apiVersion {API_VERSION}."),
        ));
    }
    let kind = artifact
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if !matches!(kind, "Ontology" | "Form" | "Document" | "WorkflowBundle") {
        diagnostics.push(diagnostic(
            "LA102",
            "error",
            "/kind",
            "kind must be Ontology, Form, Document, or WorkflowBundle.",
        ));
    }
    let name = artifact
        .pointer("/metadata/name")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if !slug(name) {
        diagnostics.push(diagnostic(
            "LA103",
            "error",
            "/metadata/name",
            "metadata.name must be a lowercase slug.",
        ));
    }
    if artifact
        .pointer("/metadata/version")
        .and_then(Value::as_str)
        .is_none()
    {
        diagnostics.push(diagnostic(
            "LA104",
            "warning",
            "/metadata/version",
            "Set a version so bundles can lock this artifact reproducibly.",
        ));
    }
    match kind {
        "Ontology" => ontology::validate(&artifact, &mut diagnostics),
        "Form" => form::validate(&artifact, &mut diagnostics),
        "Document" => document::validate(&artifact, &mut diagnostics),
        "WorkflowBundle" => bundle::validate(&artifact, &mut diagnostics),
        _ => {}
    }
    ArtifactAnalysisResult {
        ok: !diagnostics.iter().any(|item| item.severity == "error"),
        source_hash: value_hash(&artifact),
        diagnostics,
        normalized: Some(artifact),
    }
}

pub fn format_artifact(source: &str) -> FormatResult {
    let analysis = analyze_artifact(source);
    FormatResult {
        ok: analysis.ok,
        content: analysis.normalized.as_ref().map(yaml).unwrap_or_default(),
        diagnostics: analysis.diagnostics,
    }
}

pub fn slice_ontology(source: &str, selection_json: &str) -> OntologySliceResult {
    let analysis = analyze_artifact(source);
    let selection = serde_json::from_str(selection_json).unwrap_or_default();
    ontology::slice(analysis, selection)
}

pub fn compile_bundle(
    source: &str,
    resolved_assets_json: &str,
    target: &str,
) -> BundleCompileResult {
    compile::compile(source, resolved_assets_json, target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    const ONTOLOGY: &str = include_str!("../../../catalog/ontologies/insurance.yaml");
    const FORM: &str = include_str!("../../../catalog/forms/first-notice-of-loss.yaml");
    const DECISION_FORM: &str = include_str!("../../../catalog/forms/claim-review-decision.yaml");
    const DOCUMENT: &str = include_str!("../../../catalog/documents/insurance-claim-file.yaml");
    const BUNDLE: &str = include_str!("../../../catalog/bundles/insurance-claim-review.yaml");
    const WORKFLOW: &str = include_str!("../../../catalog/workflows/wf-insr-01.yaml");

    #[derive(Deserialize)]
    struct ParityFixture {
        cases: Vec<ParityCase>,
    }

    #[derive(Deserialize)]
    struct ParityCase {
        id: String,
        source: String,
    }

    #[test]
    fn parses_all_artifact_kinds() {
        for source in [ONTOLOGY, FORM, DOCUMENT, BUNDLE] {
            let result = analyze_artifact(source);
            assert!(result.ok, "{:?}", result.diagnostics);
            assert!(!result.source_hash.is_empty());
        }
    }

    #[test]
    fn shared_parity_fixtures_have_stable_results() {
        let fixtures: ParityFixture =
            serde_json::from_str(include_str!("../../../fixtures/artifacts/parity.json")).unwrap();
        let expected = [
            ("valid-minimal-ontology", true, Vec::<&str>::new()),
            ("unsupported-api-version", false, vec!["LA101"]),
            ("yaml-anchor-rejected", false, vec!["LA004"]),
            ("remote-reference-rejected", false, vec!["LA005"]),
        ];
        for (case, (id, ok, codes)) in fixtures.cases.iter().zip(expected) {
            assert_eq!(case.id, id);
            let result = analyze_artifact(&case.source);
            assert_eq!(result.ok, ok, "{}", case.id);
            assert_eq!(
                result
                    .diagnostics
                    .iter()
                    .map(|diagnostic| diagnostic.code.as_str())
                    .collect::<Vec<_>>(),
                codes,
                "{}",
                case.id
            );
        }
    }

    #[test]
    fn enforces_ontology_collection_limits() {
        let types = (0..=security::MAX_ONTOLOGY_TYPES)
            .map(|index| serde_json::json!({ "id": format!("type-{index}"), "label": format!("Type {index}"), "properties": [] }))
            .collect::<Vec<_>>();
        let source = serde_yaml_ng::to_string(&serde_json::json!({
            "apiVersion": API_VERSION,
            "kind": "Ontology",
            "metadata": { "name": "oversized-ontology", "version": "1.0.0" },
            "spec": { "types": types, "relationships": [] }
        }))
        .unwrap();
        let result = analyze_artifact(&source);
        assert!(result.diagnostics.iter().any(|item| item.code == "LO100"));
    }

    #[test]
    fn slices_deterministically() {
        let selection = r#"{"propertyRefs":["insurance_claim.claim_number","loss_event.loss_date"],"relationshipIds":["arises_from"]}"#;
        let first = slice_ontology(ONTOLOGY, selection);
        let second = slice_ontology(ONTOLOGY, selection);
        assert!(first.ok, "{:?}", first.diagnostics);
        assert_eq!(first.selection_hash, second.selection_hash);
        assert_eq!(
            first.included_type_ids,
            vec!["insurance_claim", "loss_event"]
        );
        assert_eq!(first.included_relationship_ids, vec!["arises_from"]);
    }

    #[test]
    fn rejects_unknown_sliver_seed() {
        let result = slice_ontology(ONTOLOGY, r#"{"propertyRefs":["claim.unknown"]}"#);
        assert!(!result.ok);
        assert!(result.diagnostics.iter().any(|item| item.code == "LO202"));
    }

    #[test]
    fn compiles_insurance_bundle() {
        let assets = serde_json::json!([
            { "ref": "ladder://workflows/builtin/wf-insr-01", "source": WORKFLOW },
            { "ref": "ladder://ontologies/builtin/insurance", "source": ONTOLOGY },
            { "ref": "ladder://forms/builtin/first-notice-of-loss", "source": FORM },
            { "ref": "ladder://forms/builtin/claim-review-decision", "source": DECISION_FORM },
            { "ref": "ladder://documents/builtin/insurance-claim-file", "source": DOCUMENT }
        ]);
        let result = compile_bundle(BUNDLE, &serde_json::to_string(&assets).unwrap(), "codex");
        assert!(result.ok, "{:?}", result.diagnostics);
        assert!(
            result
                .artifacts
                .iter()
                .any(|item| item.path == "ladder.lock.json")
        );
        assert!(
            result
                .artifacts
                .iter()
                .any(|item| item.path == "ontology/insurance-sliver.yaml")
        );
        let ontology = result
            .artifacts
            .iter()
            .find(|item| item.path == "ontology/insurance-sliver.yaml")
            .unwrap();
        let ontology_value: Value = serde_yaml_ng::from_str(&ontology.content).unwrap();
        assert!(ontology_value.pointer("/metadata/source").is_none());
        assert!(!ontology.content.contains("sourcePath:"));
        assert_eq!(
            result.lockfile.unwrap()["assets"].as_array().unwrap().len(),
            5
        );
    }
}
