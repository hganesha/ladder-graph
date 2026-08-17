use std::collections::BTreeSet;

use serde_json::Value;

use crate::diagnostic::{Diagnostic, diagnostic};

pub fn validate(form: &Value, diagnostics: &mut Vec<Diagnostic>) {
    let roles = [
        "start",
        "clarification",
        "review",
        "approval",
        "exception",
        "completion",
    ];
    let role = form
        .pointer("/spec/role")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if !roles.contains(&role) {
        diagnostics.push(diagnostic(
            "LF100",
            "error",
            "/spec/role",
            "Unsupported form role.",
        ));
    }
    let mut ids = BTreeSet::new();
    let mut names = BTreeSet::new();
    for page in form
        .pointer("/spec/pages")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        for section in page
            .get("sections")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            for field in section
                .get("fields")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
            {
                let id = field.get("id").and_then(Value::as_str).unwrap_or_default();
                let name = field
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if id.is_empty() || !ids.insert(id.to_owned()) {
                    diagnostics.push(diagnostic(
                        "LF101",
                        "error",
                        "/spec/pages",
                        "Form field IDs must be non-empty and unique.",
                    ));
                }
                if name.is_empty() || !names.insert(name.to_owned()) {
                    diagnostics.push(diagnostic(
                        "LF102",
                        "error",
                        "/spec/pages",
                        "Form field names must be non-empty and unique.",
                    ));
                }
            }
        }
    }
}
