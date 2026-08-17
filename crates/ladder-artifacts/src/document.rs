use std::collections::BTreeSet;

use serde_json::Value;

use crate::diagnostic::{Diagnostic, diagnostic};

pub fn validate(document: &Value, diagnostics: &mut Vec<Diagnostic>) {
    if document
        .pointer("/spec/documentType")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .is_empty()
    {
        diagnostics.push(diagnostic(
            "LD100",
            "error",
            "/spec/documentType",
            "Documents require a documentType.",
        ));
    }
    let mut ids = BTreeSet::new();
    for field in document
        .pointer("/spec/fields")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let id = field.get("id").and_then(Value::as_str).unwrap_or_default();
        if id.is_empty() || !ids.insert(id.to_owned()) {
            diagnostics.push(diagnostic(
                "LD101",
                "error",
                "/spec/fields",
                "Document field IDs must be non-empty and unique.",
            ));
        }
    }
    for section in document
        .pointer("/spec/sections")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        for field_id in section
            .get("fieldIds")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
        {
            if !ids.contains(field_id) {
                diagnostics.push(diagnostic(
                    "LD102",
                    "error",
                    "/spec/sections",
                    format!("Section references missing field '{field_id}'."),
                ));
            }
        }
    }
}
