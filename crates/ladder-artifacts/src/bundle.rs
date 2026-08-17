use std::collections::BTreeSet;

use serde_json::Value;

use crate::diagnostic::{Diagnostic, diagnostic};

pub fn validate(bundle: &Value, diagnostics: &mut Vec<Diagnostic>) {
    let workflow_ref = bundle
        .pointer("/spec/workflowRef")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if !workflow_ref.starts_with("ladder://") {
        diagnostics.push(diagnostic(
            "LB100",
            "error",
            "/spec/workflowRef",
            "workflowRef must be a ladder:// URI.",
        ));
    }
    let mut binding_ids = BTreeSet::new();
    for binding in bundle
        .pointer("/spec/bindings")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let id = binding
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if id.is_empty() || !binding_ids.insert(id.to_owned()) {
            diagnostics.push(diagnostic(
                "LB101",
                "error",
                "/spec/bindings",
                "Binding IDs must be non-empty and unique.",
            ));
        }
        for endpoint in ["source", "target"] {
            let path = binding
                .pointer(&format!("/{endpoint}/path"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            if !path.starts_with('/') {
                diagnostics.push(diagnostic(
                    "LB102",
                    "error",
                    "/spec/bindings",
                    "Binding endpoints require JSON Pointer paths.",
                ));
            }
        }
    }
}
