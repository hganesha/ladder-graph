use std::collections::{BTreeMap, BTreeSet};

use serde_json::{Value, json};

use crate::diagnostic::{Diagnostic, diagnostic};
use crate::model::{ArtifactAnalysisResult, OntologySelection, OntologySliceResult};
use crate::parse::value_hash;
use crate::security::{MAX_ONTOLOGY_RELATIONSHIPS, MAX_ONTOLOGY_TYPES};

pub fn validate(ontology: &Value, diagnostics: &mut Vec<Diagnostic>) {
    let types = ontology.pointer("/spec/types").and_then(Value::as_array);
    let relationships = ontology
        .pointer("/spec/relationships")
        .and_then(Value::as_array);
    if types.is_none() {
        diagnostics.push(diagnostic(
            "LO100",
            "error",
            "/spec/types",
            "Ontology spec.types must be an array.",
        ));
        return;
    }
    if relationships.is_none() {
        diagnostics.push(diagnostic(
            "LO100",
            "error",
            "/spec/relationships",
            "Ontology spec.relationships must be an array.",
        ));
        return;
    }
    if types.is_some_and(|items| items.len() > MAX_ONTOLOGY_TYPES) {
        diagnostics.push(diagnostic(
            "LO100",
            "error",
            "/spec/types",
            format!("Ontologies are limited to {MAX_ONTOLOGY_TYPES} types."),
        ));
    }
    if relationships.is_some_and(|items| items.len() > MAX_ONTOLOGY_RELATIONSHIPS) {
        diagnostics.push(diagnostic(
            "LO100",
            "error",
            "/spec/relationships",
            format!("Ontologies are limited to {MAX_ONTOLOGY_RELATIONSHIPS} relationships."),
        ));
    }
    let mut type_ids = BTreeSet::new();
    let mut property_ids = BTreeSet::new();
    for (index, ontology_type) in types.unwrap().iter().enumerate() {
        let id = ontology_type
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if id.is_empty() || !type_ids.insert(id.to_owned()) {
            diagnostics.push(diagnostic(
                "LO101",
                "error",
                format!("/spec/types/{index}/id"),
                "Type IDs must be non-empty and unique.",
            ));
        }
        for (property_index, property) in ontology_type
            .get("properties")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .enumerate()
        {
            let property_id = property
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if property_id.is_empty() || !property_ids.insert(property_id.to_owned()) {
                diagnostics.push(diagnostic(
                    "LO102",
                    "error",
                    format!("/spec/types/{index}/properties/{property_index}/id"),
                    "Property IDs must be non-empty and globally unique.",
                ));
            }
        }
    }
    let mut relationship_ids = BTreeSet::new();
    for (index, relationship) in relationships.unwrap().iter().enumerate() {
        let id = relationship
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if id.is_empty() || !relationship_ids.insert(id.to_owned()) {
            diagnostics.push(diagnostic(
                "LO103",
                "error",
                format!("/spec/relationships/{index}/id"),
                "Relationship IDs must be non-empty and unique.",
            ));
        }
        for endpoint in ["sourceTypeId", "targetTypeId"] {
            let endpoint_id = relationship
                .get(endpoint)
                .and_then(Value::as_str)
                .unwrap_or_default();
            if !type_ids.contains(endpoint_id) {
                diagnostics.push(diagnostic(
                    "LO104",
                    "error",
                    format!("/spec/relationships/{index}/{endpoint}"),
                    format!("Missing endpoint type '{endpoint_id}'."),
                ));
            }
        }
    }
}

fn add_reason(
    reasons: &mut BTreeMap<String, BTreeSet<String>>,
    id: &str,
    reason: impl Into<String>,
) {
    reasons
        .entry(id.to_owned())
        .or_default()
        .insert(reason.into());
}

pub fn slice(
    analysis: ArtifactAnalysisResult,
    selection: OntologySelection,
) -> OntologySliceResult {
    let mut diagnostics = analysis.diagnostics;
    let Some(mut ontology) = analysis.normalized else {
        return OntologySliceResult {
            ok: false,
            source_hash: analysis.source_hash,
            selection_hash: String::new(),
            ontology: None,
            included_type_ids: vec![],
            included_property_refs: vec![],
            included_relationship_ids: vec![],
            inclusion_reasons: BTreeMap::new(),
            diagnostics,
        };
    };
    if ontology.get("kind").and_then(Value::as_str) != Some("Ontology") {
        diagnostics.push(diagnostic(
            "LO200",
            "error",
            "/kind",
            "Ontology slicing requires an Ontology artifact.",
        ));
    }
    let source_types = ontology
        .pointer("/spec/types")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let source_relationships = ontology
        .pointer("/spec/relationships")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let types: BTreeMap<String, Value> = source_types
        .iter()
        .filter_map(|item| Some((item.get("id")?.as_str()?.to_owned(), item.clone())))
        .collect();
    let relationships: BTreeMap<String, Value> = source_relationships
        .iter()
        .filter_map(|item| Some((item.get("id")?.as_str()?.to_owned(), item.clone())))
        .collect();
    let mut properties: BTreeMap<String, (String, Value)> = BTreeMap::new();
    for (type_id, ontology_type) in &types {
        for property in ontology_type
            .get("properties")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if let Some(property_id) = property.get("id").and_then(Value::as_str) {
                properties.insert(property_id.to_owned(), (type_id.clone(), property.clone()));
            }
        }
    }
    let mut included_types = BTreeSet::new();
    let mut included_properties = BTreeSet::new();
    let mut included_relationships = BTreeSet::new();
    let mut reasons: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();

    let include_identity =
        |type_id: &str,
         reason: String,
         included_types: &mut BTreeSet<String>,
         included_properties: &mut BTreeSet<String>,
         reasons: &mut BTreeMap<String, BTreeSet<String>>| {
            let Some(ontology_type) = types.get(type_id) else {
                return;
            };
            included_types.insert(type_id.to_owned());
            add_reason(reasons, type_id, reason);
            for property in ontology_type
                .get("properties")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
            {
                if property
                    .get("required")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                    || property
                        .get("identifier")
                        .and_then(Value::as_bool)
                        .unwrap_or(false)
                {
                    if let Some(id) = property.get("id").and_then(Value::as_str) {
                        included_properties.insert(id.to_owned());
                        add_reason(
                            reasons,
                            id,
                            format!("Required identity/constraint for {type_id}"),
                        );
                    }
                }
            }
        };

    for type_id in BTreeSet::from_iter(selection.type_ids) {
        let Some(ontology_type) = types.get(&type_id) else {
            diagnostics.push(diagnostic(
                "LO201",
                "error",
                "/selection/typeIds",
                format!("Selected type '{type_id}' does not exist."),
            ));
            continue;
        };
        include_identity(
            &type_id,
            "Explicit type selection".into(),
            &mut included_types,
            &mut included_properties,
            &mut reasons,
        );
        for property in ontology_type
            .get("properties")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if let Some(id) = property.get("id").and_then(Value::as_str) {
                included_properties.insert(id.to_owned());
                add_reason(
                    &mut reasons,
                    id,
                    format!("Included with explicitly selected type {type_id}"),
                );
            }
        }
    }
    for property_ref in BTreeSet::from_iter(selection.property_refs) {
        let Some((owner, _)) = properties.get(&property_ref) else {
            diagnostics.push(diagnostic(
                "LO202",
                "error",
                "/selection/propertyRefs",
                format!("Selected property '{property_ref}' does not exist."),
            ));
            continue;
        };
        included_properties.insert(property_ref.clone());
        add_reason(&mut reasons, &property_ref, "Explicit property selection");
        include_identity(
            owner,
            format!("Owns selected property {property_ref}"),
            &mut included_types,
            &mut included_properties,
            &mut reasons,
        );
    }
    for relationship_id in BTreeSet::from_iter(selection.relationship_ids) {
        let Some(relationship) = relationships.get(&relationship_id) else {
            diagnostics.push(diagnostic(
                "LO203",
                "error",
                "/selection/relationshipIds",
                format!("Selected relationship '{relationship_id}' does not exist."),
            ));
            continue;
        };
        included_relationships.insert(relationship_id.clone());
        add_reason(
            &mut reasons,
            &relationship_id,
            "Explicit relationship selection",
        );
        for endpoint in ["sourceTypeId", "targetTypeId"] {
            if let Some(type_id) = relationship.get(endpoint).and_then(Value::as_str) {
                include_identity(
                    type_id,
                    format!("Endpoint of relationship {relationship_id}"),
                    &mut included_types,
                    &mut included_properties,
                    &mut reasons,
                );
            }
        }
    }

    let mut sliced_types = vec![];
    for type_id in &included_types {
        if let Some(mut ontology_type) = types.get(type_id).cloned() {
            if let Some(items) = ontology_type
                .get_mut("properties")
                .and_then(Value::as_array_mut)
            {
                items.retain(|property| {
                    property
                        .get("id")
                        .and_then(Value::as_str)
                        .is_some_and(|id| included_properties.contains(id))
                });
                items.sort_by_key(|property| {
                    property
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_owned()
                });
            }
            sliced_types.push(ontology_type);
        }
    }
    let sliced_relationships: Vec<Value> = included_relationships
        .iter()
        .filter_map(|id| relationships.get(id).cloned())
        .collect();
    if let Some(spec) = ontology.get_mut("spec").and_then(Value::as_object_mut) {
        spec.insert("types".into(), Value::Array(sliced_types));
        spec.insert("relationships".into(), Value::Array(sliced_relationships));
    }
    let selection_value = json!({
        "typeIds": included_types,
        "propertyRefs": included_properties,
        "relationshipIds": included_relationships,
    });
    let selection_hash = value_hash(&selection_value);
    if let Some(metadata) = ontology.get_mut("metadata").and_then(Value::as_object_mut) {
        let base_name = metadata
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("ontology")
            .to_owned();
        metadata.insert("name".into(), Value::String(format!("{base_name}-sliver")));
        metadata.insert(
            "description".into(),
            Value::String("Selected ontology context.".into()),
        );
    }
    let inclusion_reasons = reasons
        .into_iter()
        .map(|(id, values)| (id, values.into_iter().collect()))
        .collect();
    OntologySliceResult {
        ok: !diagnostics.iter().any(|item| item.severity == "error"),
        source_hash: analysis.source_hash,
        selection_hash,
        ontology: Some(ontology),
        included_type_ids: included_types.into_iter().collect(),
        included_property_refs: included_properties.into_iter().collect(),
        included_relationship_ids: included_relationships.into_iter().collect(),
        inclusion_reasons,
        diagnostics,
    }
}
