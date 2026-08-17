use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::diagnostic::{Diagnostic, diagnostic};
use crate::security::validate_source;

pub fn parse_value(source: &str) -> Result<Value, Diagnostic> {
    validate_source(source)?;
    serde_yaml_ng::from_str(source).map_err(|error| {
        diagnostic(
            "LA003",
            "error",
            "/",
            format!("YAML could not be parsed: {error}"),
        )
    })
}

pub fn value_hash(value: &Value) -> String {
    let bytes = serde_json::to_vec(value).unwrap_or_default();
    hex::encode(Sha256::digest(bytes))
}

pub fn yaml(value: &Value) -> String {
    serde_yaml_ng::to_string(value).unwrap_or_default()
}
