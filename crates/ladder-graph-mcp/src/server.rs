use ladder_catalog::{
    AgentFormat, ArtifactFormat, Catalog, CatalogEntry, CatalogError, CatalogKind, CatalogScope,
    WorkflowFormat,
};
use rmcp::{
    ErrorData as McpError, RoleServer, ServerHandler,
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::*,
    schemars,
    service::RequestContext,
    tool, tool_handler, tool_router,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::path::PathBuf;

const PAGE_SIZE: usize = 50;

#[derive(Clone)]
pub struct LadderGraphServer {
    snapshot_path: PathBuf,
    #[allow(dead_code)]
    tool_router: ToolRouter<Self>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct SearchCatalogParams {
    /// Words that must appear in the catalog entry.
    #[serde(default)]
    query: String,
    /// Optional kind: workflow, agent-template, ontology, form, document, or workflow-bundle.
    kind: Option<String>,
    /// Optional scope: builtin or user.
    scope: Option<String>,
    /// Maximum summaries to return, from 1 to 100.
    limit: Option<usize>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct GetWorkflowParams {
    /// Stable workflow ID or ladder:// resource URI.
    identifier: String,
    /// source-yaml, normalized-yaml, json, markdown, or compiled.
    format: Option<String>,
    /// Required for compiled format: codex, claude, hermes, python, or typescript.
    target: Option<String>,
    /// Optional scope when identifier is an ID: builtin or user.
    scope: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct GetAgentParams {
    /// Stable agent-template ID or ladder:// resource URI.
    identifier: String,
    /// yaml, json, or markdown.
    format: Option<String>,
    /// Optional scope when identifier is an ID: builtin or user.
    scope: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct GetArtifactParams {
    /// Stable artifact ID or ladder:// resource URI.
    identifier: String,
    /// Optional kind: ontology, form, document, or workflow-bundle.
    kind: Option<String>,
    /// yaml or json.
    format: Option<String>,
    /// Optional scope when identifier is an ID: builtin or user.
    scope: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct WorkflowInputParams {
    /// Stable workflow ID or ladder:// resource URI. Supply this or source, not both.
    identifier: Option<String>,
    /// LGIR YAML supplied directly. Supply this or identifier, not both.
    source: Option<String>,
    /// Optional scope when identifier is an ID: builtin or user.
    scope: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct CompileWorkflowParams {
    /// Stable workflow ID or ladder:// resource URI. Supply this or source, not both.
    identifier: Option<String>,
    /// LGIR YAML supplied directly. Supply this or identifier, not both.
    source: Option<String>,
    /// codex, claude, hermes, python, or typescript.
    target: String,
    /// Optional scope when identifier is an ID: builtin or user.
    scope: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchResult<'a> {
    uri: String,
    id: &'a str,
    kind: CatalogKind,
    scope: CatalogScope,
    title: &'a str,
    description: &'a str,
    version: &'a str,
    tags: &'a [String],
    updated_at: &'a Option<String>,
    source_hash: &'a str,
}

impl LadderGraphServer {
    pub fn new(snapshot_path: PathBuf) -> Self {
        Self {
            snapshot_path,
            tool_router: Self::tool_router(),
        }
    }

    fn catalog(&self) -> Result<Catalog, CatalogError> {
        Catalog::load(Some(&self.snapshot_path))
    }

    fn workflow_source(
        &self,
        identifier: Option<&str>,
        source: Option<&str>,
        scope: Option<&str>,
    ) -> Result<String, CatalogError> {
        match (identifier, source) {
            (Some(_), Some(_)) | (None, None) => Err(CatalogError::InvalidSnapshot(
                "provide exactly one of identifier or source".into(),
            )),
            (_, Some(source)) => Ok(source.to_string()),
            (Some(identifier), None) => {
                let scope = parse_scope(scope)?;
                Ok(self
                    .catalog()?
                    .resolve(identifier, Some(CatalogKind::Workflow), scope)?
                    .content
                    .clone())
            }
        }
    }
}

#[tool_router]
impl LadderGraphServer {
    #[tool(
        description = "Search Ladder Graph workflows, agent templates, ontologies, forms, documents, and workflow bundles. Returns compact resource summaries, not full source bodies."
    )]
    fn search_catalog(
        &self,
        Parameters(params): Parameters<SearchCatalogParams>,
    ) -> CallToolResult {
        let result = (|| -> Result<Value, CatalogError> {
            let kind = parse_kind(params.kind.as_deref())?;
            let scope = parse_scope(params.scope.as_deref())?;
            let catalog = self.catalog()?;
            let entries = catalog.search(&params.query, kind, scope, params.limit.unwrap_or(20));
            Ok(serde_json::to_value(
                entries.into_iter().map(search_result).collect::<Vec<_>>(),
            )?)
        })();
        tool_result(result)
    }

    #[tool(
        description = "Get a Ladder Graph workflow as source YAML, normalized YAML, JSON, Markdown, or a compiled target."
    )]
    fn get_workflow(&self, Parameters(params): Parameters<GetWorkflowParams>) -> CallToolResult {
        let result = (|| -> Result<Value, CatalogError> {
            let catalog = self.catalog()?;
            let scope = parse_scope(params.scope.as_deref())?;
            let entry = catalog.resolve(&params.identifier, Some(CatalogKind::Workflow), scope)?;
            let format = WorkflowFormat::parse(params.format.as_deref())?;
            let (content, media_type) =
                catalog.render_workflow(entry, format, params.target.as_deref())?;
            Ok(json!({
                "uri": entry.uri(),
                "id": entry.id,
                "scope": entry.scope,
                "format": params.format.unwrap_or_else(|| "source-yaml".into()),
                "target": params.target,
                "mediaType": media_type,
                "sourceHash": entry.source_hash,
                "content": content,
            }))
        })();
        tool_result(result)
    }

    #[tool(description = "Get a Ladder Graph agent template as YAML, JSON, or Markdown.")]
    fn get_agent_template(&self, Parameters(params): Parameters<GetAgentParams>) -> CallToolResult {
        let result = (|| -> Result<Value, CatalogError> {
            let catalog = self.catalog()?;
            let scope = parse_scope(params.scope.as_deref())?;
            let entry =
                catalog.resolve(&params.identifier, Some(CatalogKind::AgentTemplate), scope)?;
            let format = AgentFormat::parse(params.format.as_deref())?;
            let (content, media_type) = catalog.render_agent(entry, format)?;
            Ok(json!({
                "uri": entry.uri(),
                "id": entry.id,
                "scope": entry.scope,
                "format": params.format.unwrap_or_else(|| "yaml".into()),
                "mediaType": media_type,
                "sourceHash": entry.source_hash,
                "content": content,
            }))
        })();
        tool_result(result)
    }

    #[tool(
        description = "Get a Ladder Graph ontology, form, document, or workflow bundle as YAML or JSON."
    )]
    fn get_artifact(&self, Parameters(params): Parameters<GetArtifactParams>) -> CallToolResult {
        let result = (|| -> Result<Value, CatalogError> {
            let catalog = self.catalog()?;
            let scope = parse_scope(params.scope.as_deref())?;
            let kind = parse_artifact_kind(params.kind.as_deref())?;
            let entry = catalog.resolve(&params.identifier, kind, scope)?;
            let format = ArtifactFormat::parse(params.format.as_deref())?;
            let (content, media_type) = catalog.render_artifact(entry, format)?;
            Ok(json!({
                "uri": entry.uri(),
                "id": entry.id,
                "kind": entry.kind,
                "scope": entry.scope,
                "format": params.format.unwrap_or_else(|| "yaml".into()),
                "mediaType": media_type,
                "sourceHash": entry.source_hash,
                "content": content,
            }))
        })();
        tool_result(result)
    }

    #[tool(
        description = "Validate supplied LGIR YAML or a catalog workflow and return Ladder Graph diagnostics."
    )]
    fn validate_workflow(
        &self,
        Parameters(params): Parameters<WorkflowInputParams>,
    ) -> CallToolResult {
        let result = (|| -> Result<Value, CatalogError> {
            let source = self.workflow_source(
                params.identifier.as_deref(),
                params.source.as_deref(),
                params.scope.as_deref(),
            )?;
            Ok(serde_json::to_value(lgir_core::analyze(&source, None))?)
        })();
        tool_result(result)
    }

    #[tool(
        description = "Compile supplied LGIR YAML or a catalog workflow for Codex, Claude, Hermes, Python, or TypeScript."
    )]
    fn compile_workflow(
        &self,
        Parameters(params): Parameters<CompileWorkflowParams>,
    ) -> CallToolResult {
        let result = (|| -> Result<Value, CatalogError> {
            let source = self.workflow_source(
                params.identifier.as_deref(),
                params.source.as_deref(),
                params.scope.as_deref(),
            )?;
            if !["codex", "claude", "hermes", "python", "typescript"]
                .contains(&params.target.as_str())
            {
                return Err(CatalogError::UnsupportedTarget(params.target));
            }
            Ok(serde_json::to_value(lgir_core::compile(
                &source,
                &params.target,
            ))?)
        })();
        tool_result(result)
    }
}

#[tool_handler]
impl ServerHandler for LadderGraphServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(
            ServerCapabilities::builder()
                .enable_resources()
                .enable_tools()
                .build(),
        )
        .with_server_info(
            Implementation::new("ladder-graph-mcp", env!("CARGO_PKG_VERSION"))
                .with_title("Ladder Graph MCP"),
        )
        .with_instructions(
            "Discover Ladder Graph workflows, agent templates, ontologies, forms, documents, and workflow bundles as resources. Use search_catalog for compact discovery, then read a resource or call the matching getter. This server is read-only."
                .to_string(),
        )
    }

    async fn list_resources(
        &self,
        request: Option<PaginatedRequestParams>,
        _: RequestContext<RoleServer>,
    ) -> Result<ListResourcesResult, McpError> {
        let catalog = self.catalog().map_err(internal_error)?;
        let offset =
            cursor_offset(request.and_then(|value| value.cursor.as_deref().map(str::to_string)))?;
        let entries = catalog.entries();
        let resources = entries
            .iter()
            .skip(offset)
            .take(PAGE_SIZE)
            .map(resource_from_entry)
            .collect::<Vec<_>>();
        let mut result = ListResourcesResult::with_all_items(resources).with_ttl_ms(1_000);
        if offset + PAGE_SIZE < entries.len() {
            result.next_cursor = Some((offset + PAGE_SIZE).to_string());
        }
        Ok(result)
    }

    async fn list_resource_templates(
        &self,
        _request: Option<PaginatedRequestParams>,
        _: RequestContext<RoleServer>,
    ) -> Result<ListResourceTemplatesResult, McpError> {
        Ok(ListResourceTemplatesResult::with_all_items(vec![
            ResourceTemplate::new(
                "ladder://workflows/{scope}/{id}{?format,target}",
                "workflow-representation",
            )
            .with_title("Workflow representation")
            .with_description("Retrieve a workflow as source-yaml, normalized-yaml, json, markdown, or compiled output."),
            ResourceTemplate::new(
                "ladder://agents/{scope}/{id}{?format}",
                "agent-template-representation",
            )
            .with_title("Agent-template representation")
                .with_description("Retrieve an agent template as yaml, json, or markdown."),
            ResourceTemplate::new(
                "ladder://ontologies/{scope}/{id}{?format}",
                "ontology-representation",
            )
            .with_title("Ontology representation")
            .with_description("Retrieve a portable ontology as yaml or json."),
            ResourceTemplate::new("ladder://forms/{scope}/{id}{?format}", "form-representation")
                .with_title("Form representation")
                .with_description("Retrieve a first-class form contract as yaml or json."),
            ResourceTemplate::new(
                "ladder://documents/{scope}/{id}{?format}",
                "document-representation",
            )
            .with_title("Document representation")
            .with_description("Retrieve a supporting document contract as yaml or json."),
            ResourceTemplate::new("ladder://bundles/{scope}/{id}{?format}", "workflow-bundle-representation")
                .with_title("Workflow-bundle representation")
                .with_description("Retrieve a workflow bundle manifest as yaml or json."),
        ]))
    }

    async fn read_resource(
        &self,
        request: ReadResourceRequestParams,
        _: RequestContext<RoleServer>,
    ) -> Result<ReadResourceResponse, McpError> {
        let catalog = self.catalog().map_err(internal_error)?;
        let entry = catalog.resolve(&request.uri, None, None).map_err(|error| {
            McpError::resource_not_found(error.to_string(), Some(json!({ "uri": request.uri })))
        })?;
        let query = query_params(&request.uri);
        let rendered = match entry.kind {
            CatalogKind::Workflow => catalog.render_workflow(
                entry,
                WorkflowFormat::parse(query.get("format").map(String::as_str))
                    .map_err(invalid_params)?,
                query.get("target").map(String::as_str),
            ),
            CatalogKind::AgentTemplate => catalog.render_agent(
                entry,
                AgentFormat::parse(query.get("format").map(String::as_str))
                    .map_err(invalid_params)?,
            ),
            CatalogKind::Ontology
            | CatalogKind::Form
            | CatalogKind::Document
            | CatalogKind::WorkflowBundle => catalog.render_artifact(
                entry,
                ArtifactFormat::parse(query.get("format").map(String::as_str))
                    .map_err(invalid_params)?,
            ),
        }
        .map_err(invalid_params)?;
        Ok(ReadResourceResult::new(vec![
            ResourceContents::text(rendered.0, request.uri).with_mime_type(rendered.1),
        ])
        .with_ttl_ms(1_000)
        .into())
    }
}

fn search_result(entry: &CatalogEntry) -> SearchResult<'_> {
    SearchResult {
        uri: entry.uri(),
        id: &entry.id,
        kind: entry.kind,
        scope: entry.scope,
        title: &entry.title,
        description: &entry.description,
        version: &entry.version,
        tags: &entry.tags,
        updated_at: &entry.updated_at,
        source_hash: &entry.source_hash,
    }
}

fn resource_from_entry(entry: &CatalogEntry) -> Resource {
    let mut resource = Resource::new(entry.uri(), entry.id.clone())
        .with_title(entry.title.clone())
        .with_description(entry.description.clone())
        .with_mime_type(entry.media_type.clone())
        .with_size(entry.content.len() as u64);
    if let Some(updated_at) = &entry.updated_at {
        let mut annotations =
            Annotations::default().with_priority(if entry.scope == CatalogScope::User {
                0.9
            } else {
                0.7
            });
        annotations.last_modified = Some(updated_at.clone());
        resource.annotations = Some(annotations);
    }
    resource
}

fn parse_kind(value: Option<&str>) -> Result<Option<CatalogKind>, CatalogError> {
    match value {
        None => Ok(None),
        Some("workflow") => Ok(Some(CatalogKind::Workflow)),
        Some("agent-template") | Some("agent") => Ok(Some(CatalogKind::AgentTemplate)),
        Some("ontology") => Ok(Some(CatalogKind::Ontology)),
        Some("form") => Ok(Some(CatalogKind::Form)),
        Some("document") => Ok(Some(CatalogKind::Document)),
        Some("workflow-bundle") | Some("bundle") => Ok(Some(CatalogKind::WorkflowBundle)),
        Some(value) => Err(CatalogError::InvalidSnapshot(format!(
            "unsupported kind {value}"
        ))),
    }
}

fn parse_artifact_kind(value: Option<&str>) -> Result<Option<CatalogKind>, CatalogError> {
    let kind = parse_kind(value)?;
    if matches!(
        kind,
        Some(CatalogKind::Workflow | CatalogKind::AgentTemplate)
    ) {
        return Err(CatalogError::InvalidSnapshot(
            "get_artifact kind must be ontology, form, document, or workflow-bundle".into(),
        ));
    }
    Ok(kind)
}

fn parse_scope(value: Option<&str>) -> Result<Option<CatalogScope>, CatalogError> {
    match value {
        None => Ok(None),
        Some("builtin") => Ok(Some(CatalogScope::Builtin)),
        Some("user") => Ok(Some(CatalogScope::User)),
        Some(value) => Err(CatalogError::InvalidSnapshot(format!(
            "unsupported scope {value}"
        ))),
    }
}

fn tool_result(result: Result<Value, CatalogError>) -> CallToolResult {
    match result {
        Ok(value) => CallToolResult::structured(value),
        Err(error) => CallToolResult::structured_error(json!({
            "error": "catalog_error",
            "message": error.to_string(),
        })),
    }
}

fn cursor_offset(cursor: Option<String>) -> Result<usize, McpError> {
    cursor
        .map(|value| {
            value.parse::<usize>().map_err(|_| {
                McpError::invalid_params(
                    "cursor must be a non-negative integer",
                    Some(json!({ "cursor": value })),
                )
            })
        })
        .transpose()
        .map(|value| value.unwrap_or(0))
}

fn query_params(uri: &str) -> std::collections::BTreeMap<String, String> {
    uri.split_once('?')
        .map(|(_, query)| {
            query
                .split('&')
                .filter_map(|part| part.split_once('='))
                .map(|(key, value)| (key.to_string(), value.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

fn internal_error(error: CatalogError) -> McpError {
    McpError::internal_error(error.to_string(), None)
}

fn invalid_params(error: CatalogError) -> McpError {
    McpError::invalid_params(error.to_string(), None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_searches_and_renders_builtin_catalog() {
        let server = LadderGraphServer::new(PathBuf::from("/path/that/does/not/exist"));
        let result = server.search_catalog(Parameters(SearchCatalogParams {
            query: "critique revise".into(),
            kind: Some("workflow".into()),
            scope: Some("builtin".into()),
            limit: Some(5),
        }));
        assert_eq!(result.is_error, Some(false));
        assert!(
            result
                .structured_content
                .unwrap()
                .as_array()
                .unwrap()
                .iter()
                .any(|entry| entry["id"] == "refinement")
        );
    }

    #[test]
    fn server_searches_and_renders_portable_artifacts() {
        let server = LadderGraphServer::new(PathBuf::from("/path/that/does/not/exist"));
        let search = server.search_catalog(Parameters(SearchCatalogParams {
            query: "manufacturing line qualification".into(),
            kind: Some("workflow-bundle".into()),
            scope: Some("builtin".into()),
            limit: Some(5),
        }));
        assert_eq!(search.is_error, Some(false));
        assert!(
            search
                .structured_content
                .unwrap()
                .as_array()
                .unwrap()
                .iter()
                .any(|entry| entry["id"] == "manufacturing-line-qualification")
        );

        let artifact = server.get_artifact(Parameters(GetArtifactParams {
            identifier: "manufacturing".into(),
            kind: Some("ontology".into()),
            format: Some("json".into()),
            scope: Some("builtin".into()),
        }));
        assert_eq!(artifact.is_error, Some(false));
        assert!(
            artifact.structured_content.unwrap()["content"]
                .as_str()
                .unwrap()
                .contains("Manufacturing Ontology")
        );
    }
}
