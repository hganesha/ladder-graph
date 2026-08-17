use std::collections::{BTreeMap, BTreeSet};

use serde_json::{Map, Value, json};

use crate::analyze_artifact;
use crate::diagnostic::{Diagnostic, diagnostic};
use crate::model::{
    BundleCapabilityReport, BundleCompileResult, CompiledArtifact, OntologySelection,
    ResolvedBundleAsset,
};
use crate::parse::{value_hash, yaml};
use crate::slice_ontology;

fn report(target: &str) -> BundleCapabilityReport {
    BundleCapabilityReport {
        target: target.into(),
        native: vec![
            "workflow compilation".into(),
            "portable form contracts".into(),
            "deterministic ontology slivers".into(),
            "bundle lockfiles".into(),
        ],
        instructional: vec![
            "host-provided form rendering".into(),
            "host-provided workflow execution".into(),
        ],
        unsupported: vec![],
    }
}

fn failure(target: &str, diagnostics: Vec<Diagnostic>) -> BundleCompileResult {
    BundleCompileResult {
        ok: false,
        artifacts: vec![],
        lockfile: None,
        diagnostics,
        capability_report: report(target),
    }
}

fn collect_refs(bundle: &Value) -> BTreeSet<String> {
    let mut refs = BTreeSet::new();
    if let Some(value) = bundle.pointer("/spec/workflowRef").and_then(Value::as_str) {
        refs.insert(value.into());
    }
    if let Some(value) = bundle.pointer("/spec/ontology/ref").and_then(Value::as_str) {
        refs.insert(value.into());
    }
    for group in ["forms", "documents"] {
        for item in bundle
            .pointer(&format!("/spec/{group}"))
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if let Some(value) = item.get("ref").and_then(Value::as_str) {
                refs.insert(value.into());
            }
        }
    }
    refs
}

fn collect_property_refs(value: &Value, result: &mut BTreeSet<String>) {
    match value {
        Value::Array(items) => items
            .iter()
            .for_each(|item| collect_property_refs(item, result)),
        Value::Object(map) => {
            if let Some(reference) = map.get("ontologyPropertyRef").and_then(Value::as_str) {
                result.insert(reference.into());
            }
            map.values()
                .for_each(|item| collect_property_refs(item, result));
        }
        _ => {}
    }
}

fn fields(value: &Value) -> Vec<&Value> {
    match value.get("kind").and_then(Value::as_str) {
        Some("Form") => value
            .pointer("/spec/pages")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .flat_map(|page| {
                page.get("sections")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
            })
            .flat_map(|section| {
                section
                    .get("fields")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
            })
            .collect(),
        Some("Document") => value
            .pointer("/spec/fields")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .collect(),
        _ => vec![],
    }
}

fn schema_for(value: &Value) -> Value {
    let source_fields = fields(value);
    let required: Vec<Value> = source_fields
        .iter()
        .filter(|field| {
            field
                .get("required")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .filter_map(|field| {
            field
                .get("name")
                .and_then(Value::as_str)
                .map(|name| Value::String(name.into()))
        })
        .collect();
    let mut properties = Map::new();
    for field in source_fields {
        let Some(name) = field.get("name").and_then(Value::as_str) else {
            continue;
        };
        let source_type = field
            .get("dataType")
            .and_then(Value::as_str)
            .unwrap_or("string");
        let data_type = match source_type {
            "date" | "datetime" => "string",
            other => other,
        };
        let mut property = Map::from_iter([("type".into(), Value::String(data_type.into()))]);
        if let Some(label) = field.get("label").cloned() {
            property.insert("title".into(), label);
        }
        if source_type == "date" {
            property.insert("format".into(), Value::String("date".into()));
        } else if source_type == "datetime" {
            property.insert("format".into(), Value::String("date-time".into()));
        }
        properties.insert(name.into(), Value::Object(property));
    }
    json!({ "type": "object", "additionalProperties": false, "required": required, "properties": properties })
}

pub fn compile(source: &str, resolved_assets_json: &str, target: &str) -> BundleCompileResult {
    let bundle_analysis = analyze_artifact(source);
    let mut diagnostics = bundle_analysis.diagnostics.clone();
    let Some(bundle) = bundle_analysis.normalized else {
        return failure(target, diagnostics);
    };
    if bundle.get("kind").and_then(Value::as_str) != Some("WorkflowBundle") {
        diagnostics.push(diagnostic(
            "LB200",
            "error",
            "/kind",
            "Bundle compilation requires a WorkflowBundle artifact.",
        ));
        return failure(target, diagnostics);
    }
    let resolved: Vec<ResolvedBundleAsset> = match serde_json::from_str(resolved_assets_json) {
        Ok(value) => value,
        Err(error) => {
            diagnostics.push(diagnostic(
                "LB201",
                "error",
                "/resolvedAssets",
                format!("Resolved assets JSON is invalid: {error}"),
            ));
            return failure(target, diagnostics);
        }
    };
    let sources: BTreeMap<String, String> = resolved
        .into_iter()
        .map(|asset| (asset.r#ref, asset.source))
        .collect();
    let workflow_ref = bundle
        .pointer("/spec/workflowRef")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let mut parsed_assets = BTreeMap::new();
    let mut source_hashes = BTreeMap::new();
    for reference in collect_refs(&bundle) {
        let Some(asset_source) = sources.get(&reference) else {
            diagnostics.push(diagnostic(
                "LB202",
                "error",
                "/spec",
                format!("Resolved source is missing for '{reference}'."),
            ));
            continue;
        };
        if reference == workflow_ref {
            let analysis = lgir_core::analyze(asset_source, Some(target));
            for item in analysis.diagnostics {
                diagnostics.push(diagnostic(
                    &item.code,
                    &item.severity,
                    format!("{reference}{}", item.path),
                    item.message,
                ));
            }
            if let Some(workflow) = analysis.normalized {
                parsed_assets.insert(
                    reference.clone(),
                    serde_json::to_value(workflow).unwrap_or(Value::Null),
                );
            }
            source_hashes.insert(reference, analysis.source_hash);
        } else {
            let analysis = analyze_artifact(asset_source);
            for item in &analysis.diagnostics {
                diagnostics.push(diagnostic(
                    &item.code,
                    &item.severity,
                    format!("{reference}{}", item.path),
                    &item.message,
                ));
            }
            if let Some(value) = analysis.normalized {
                parsed_assets.insert(reference.clone(), value);
            }
            source_hashes.insert(reference, analysis.source_hash);
        }
    }
    for binding in bundle
        .pointer("/spec/bindings")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        for endpoint in ["source", "target"] {
            let reference = binding
                .pointer(&format!("/{endpoint}/ref"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            let pointer = binding
                .pointer(&format!("/{endpoint}/path"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            if parsed_assets
                .get(reference)
                .and_then(|value| value.pointer(pointer))
                .is_none()
            {
                diagnostics.push(diagnostic(
                    "LB210",
                    "error",
                    "/spec/bindings",
                    format!("{endpoint} pointer '{pointer}' does not exist in '{reference}'."),
                ));
            }
        }
    }
    if diagnostics.iter().any(|item| item.severity == "error") {
        return failure(target, diagnostics);
    }

    let workflow_source = sources
        .get(workflow_ref)
        .expect("validated workflow source");
    let workflow_output = lgir_core::compile(workflow_source, target);
    let mut artifacts = vec![CompiledArtifact {
        path: format!("workflow/{}", workflow_output.suggested_filename),
        mime_type: workflow_output.mime_type,
        content: workflow_output.content,
        source_hash: workflow_output.source_hash,
    }];
    if let Some(ontology_ref) = bundle.pointer("/spec/ontology/ref").and_then(Value::as_str) {
        let mode = bundle
            .pointer("/spec/ontology/mode")
            .and_then(Value::as_str)
            .unwrap_or("full");
        let ontology_source = sources
            .get(ontology_ref)
            .expect("validated ontology source");
        let mut output = parsed_assets
            .get(ontology_ref)
            .cloned()
            .unwrap_or(Value::Null);
        if mode == "sliver" {
            let mut selection: OntologySelection = serde_json::from_value(
                bundle
                    .pointer("/spec/ontology/selection")
                    .cloned()
                    .unwrap_or_else(|| json!({})),
            )
            .unwrap_or_default();
            let mut property_refs = BTreeSet::from_iter(selection.property_refs);
            collect_property_refs(&bundle, &mut property_refs);
            for asset in parsed_assets.values() {
                collect_property_refs(asset, &mut property_refs);
            }
            selection.property_refs = property_refs.into_iter().collect();
            let selection_json = serde_json::to_string(&selection).unwrap_or_else(|_| "{}".into());
            let sliver = slice_ontology(ontology_source, &selection_json);
            diagnostics.extend(sliver.diagnostics.clone());
            let Some(ontology) = sliver.ontology else {
                return failure(target, diagnostics);
            };
            output = ontology;
            let reasons = json!({ "selectionHash": sliver.selection_hash, "inclusionReasons": sliver.inclusion_reasons });
            artifacts.push(CompiledArtifact {
                path: "ontology/insurance-sliver.reasons.json".into(),
                mime_type: "application/json".into(),
                content: format!(
                    "{}\n",
                    serde_json::to_string_pretty(&reasons).unwrap_or_default()
                ),
                source_hash: value_hash(&reasons),
            });
        }
        let name = output
            .pointer("/metadata/name")
            .and_then(Value::as_str)
            .unwrap_or("ontology");
        artifacts.push(CompiledArtifact {
            path: format!("ontology/{name}.yaml"),
            mime_type: "application/yaml".into(),
            content: yaml(&output),
            source_hash: value_hash(&output),
        });
    }
    for (reference, value) in &parsed_assets {
        let kind = value
            .get("kind")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if !matches!(kind, "Form" | "Document") {
            continue;
        }
        let name = value
            .pointer("/metadata/name")
            .and_then(Value::as_str)
            .unwrap_or("artifact");
        let contract = schema_for(value);
        let directory = if kind == "Form" { "forms" } else { "documents" };
        artifacts.push(CompiledArtifact {
            path: format!("{directory}/{name}.schema.json"),
            mime_type: "application/schema+json".into(),
            content: format!(
                "{}\n",
                serde_json::to_string_pretty(&contract).unwrap_or_default()
            ),
            source_hash: value_hash(&contract),
        });
        if kind == "Form" {
            let ui = json!({ "role": value.pointer("/spec/role"), "sourceRef": reference });
            artifacts.push(CompiledArtifact {
                path: format!("forms/{name}.ui.json"),
                mime_type: "application/json".into(),
                content: format!(
                    "{}\n",
                    serde_json::to_string_pretty(&ui).unwrap_or_default()
                ),
                source_hash: value_hash(&ui),
            });
        }
    }
    artifacts.push(CompiledArtifact {
        path: "bundle.yaml".into(),
        mime_type: "application/yaml".into(),
        content: yaml(&bundle),
        source_hash: bundle_analysis.source_hash.clone(),
    });
    let lock_assets: Vec<Value> = parsed_assets
        .iter()
        .map(|(reference, value)| {
            json!({
                "ref": reference,
                "kind": value.get("kind").and_then(Value::as_str).unwrap_or("Unknown"),
                "name": value.pointer("/metadata/name").and_then(Value::as_str).unwrap_or("unknown"),
                "version": value.pointer("/metadata/version").and_then(Value::as_str).unwrap_or("unversioned"),
                "sourceHash": source_hashes.get(reference).cloned().unwrap_or_default(),
            })
        })
        .collect();
    let lockfile = json!({
        "lockVersion": 1,
        "bundle": bundle.pointer("/metadata/name").and_then(Value::as_str).unwrap_or("bundle"),
        "target": target,
        "sourceHash": bundle_analysis.source_hash,
        "assets": lock_assets,
    });
    artifacts.push(CompiledArtifact {
        path: "ladder.lock.json".into(),
        mime_type: "application/json".into(),
        content: format!(
            "{}\n",
            serde_json::to_string_pretty(&lockfile).unwrap_or_default()
        ),
        source_hash: value_hash(&lockfile),
    });
    artifacts.sort_by(|left, right| left.path.cmp(&right.path));
    BundleCompileResult {
        ok: !diagnostics.iter().any(|item| item.severity == "error"),
        artifacts,
        lockfile: Some(lockfile),
        diagnostics,
        capability_report: report(target),
    }
}
