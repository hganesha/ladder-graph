use serde::Serialize;
use wasm_bindgen::prelude::*;

fn to_json<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|error| {
        serde_json::json!({ "ok": false, "error": error.to_string() }).to_string()
    })
}

#[wasm_bindgen]
pub fn analyze(source: &str, target: Option<String>) -> String {
    to_json(&lgir_core::analyze(source, target.as_deref()))
}

#[wasm_bindgen]
pub fn format(source: &str) -> String {
    to_json(&lgir_core::format(source))
}

#[wasm_bindgen]
pub fn compile(source: &str, target: &str) -> String {
    to_json(&lgir_core::compile(source, target))
}

#[wasm_bindgen]
pub fn migrate(source: &str, to_version: &str) -> String {
    to_json(&lgir_core::migrate(source, to_version))
}

#[wasm_bindgen]
pub fn analyze_artifact(source: &str, _target: Option<String>) -> String {
    to_json(&ladder_artifacts::analyze_artifact(source))
}

#[wasm_bindgen]
pub fn format_artifact(source: &str) -> String {
    to_json(&ladder_artifacts::format_artifact(source))
}

#[wasm_bindgen]
pub fn compile_bundle(source: &str, resolved_assets_json: &str, target: &str) -> String {
    to_json(&ladder_artifacts::compile_bundle(
        source,
        resolved_assets_json,
        target,
    ))
}

#[wasm_bindgen]
pub fn slice_ontology(source: &str, selection_json: &str) -> String {
    to_json(&ladder_artifacts::slice_ontology(source, selection_json))
}
