use crate::diagnostic::{Diagnostic, diagnostic};

pub const MAX_SOURCE_BYTES: usize = 2_000_000;
pub const MAX_ONTOLOGY_TYPES: usize = 1_000;
pub const MAX_ONTOLOGY_RELATIONSHIPS: usize = 2_000;

pub fn validate_source(source: &str) -> Result<(), Diagnostic> {
    if source.len() > MAX_SOURCE_BYTES {
        return Err(diagnostic(
            "LA001",
            "error",
            "/",
            "Artifact source exceeds the 2 MB import limit.",
        ));
    }
    if source.contains("!!") || source.contains("!<") {
        return Err(diagnostic(
            "LA002",
            "error",
            "/",
            "Custom YAML tags are not supported.",
        ));
    }
    if source.lines().any(|line| {
        let trimmed = line.trim_start();
        trimmed.starts_with('&')
            || trimmed.starts_with('*')
            || line.contains(": &")
            || line.contains(": *")
            || line.contains("- &")
            || line.contains("- *")
    }) {
        return Err(diagnostic(
            "LA004",
            "error",
            "/",
            "YAML anchors and aliases are not supported.",
        ));
    }
    if source.lines().any(|line| {
        let compact = line.trim().replace(['"', '\''], "");
        compact.starts_with("$ref: http://")
            || compact.starts_with("$ref: https://")
            || compact.starts_with("$ref: //")
    }) {
        return Err(diagnostic(
            "LA005",
            "error",
            "/",
            "External schema references are not supported.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_oversized_sources() {
        let source = "x".repeat(MAX_SOURCE_BYTES + 1);
        assert_eq!(validate_source(&source).unwrap_err().code, "LA001");
    }

    #[test]
    fn rejects_executable_yaml_features_and_remote_references() {
        for (source, code) in [
            ("value: !!python/object:example {}", "LA002"),
            ("value: &shared {}\ncopy: *shared", "LA004"),
            ("schema:\n  $ref: https://example.com/schema.json", "LA005"),
        ] {
            assert_eq!(validate_source(source).unwrap_err().code, code);
        }
    }
}
