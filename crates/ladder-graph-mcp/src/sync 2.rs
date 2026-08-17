use crate::paths::{AppPaths, set_private_permissions};
use anyhow::{Context, Result};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post, put},
};
use chrono::{Duration, Utc};
use ladder_catalog::{Catalog, CatalogSnapshot, write_snapshot};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs, net::SocketAddr, sync::Arc};
use subtle::ConstantTimeEq;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct SyncState {
    paths: AppPaths,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PairingRecord {
    code_hash: String,
    expires_at: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthStore {
    tokens: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PairRequest {
    code: String,
    installation_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PairResponse {
    token: String,
    installation_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublishResponse {
    revision: String,
    published_at: String,
    entries: usize,
}

pub async fn serve(paths: AppPaths, bind: SocketAddr, allowed_origins: Vec<String>) -> Result<()> {
    paths.ensure()?;
    let state = Arc::new(SyncState { paths });
    let cors = cors_layer(&allowed_origins)?;
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/v1/pair", post(pair))
        .route("/api/v1/catalog/user", put(publish))
        .with_state(state)
        .layer(DefaultBodyLimit::max(ladder_catalog::MAX_SNAPSHOT_BYTES))
        .layer(cors);
    let listener = tokio::net::TcpListener::bind(bind)
        .await
        .with_context(|| format!("bind loopback sync service to {bind}"))?;
    tracing::info!(%bind, "Ladder Graph sync service started");
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}

pub fn create_pairing_code(paths: &AppPaths) -> Result<String> {
    paths.ensure()?;
    let mut bytes = [0_u8; 8];
    rand::rng().fill_bytes(&mut bytes);
    let raw = hex::encode_upper(bytes);
    let code = raw
        .as_bytes()
        .chunks(4)
        .map(|chunk| std::str::from_utf8(chunk).expect("hex is UTF-8"))
        .collect::<Vec<_>>()
        .join("-");
    let record = PairingRecord {
        code_hash: hash_secret(&normalize_code(&code)),
        expires_at: (Utc::now() + Duration::minutes(5)).to_rfc3339(),
    };
    write_private_json(&paths.pairing, &record)?;
    Ok(code)
}

pub fn revoke(paths: &AppPaths) -> Result<()> {
    if paths.auth.exists() {
        fs::remove_file(&paths.auth).with_context(|| format!("remove {}", paths.auth.display()))?;
    }
    if paths.pairing.exists() {
        fs::remove_file(&paths.pairing)
            .with_context(|| format!("remove {}", paths.pairing.display()))?;
    }
    Ok(())
}

pub fn status(paths: &AppPaths) -> Result<serde_json::Value> {
    let catalog = Catalog::load(Some(&paths.snapshot))?;
    let user_entries = catalog
        .entries()
        .iter()
        .filter(|entry| entry.scope == ladder_catalog::CatalogScope::User)
        .count();
    let paired_installations = read_auth_store(paths)?.tokens.len();
    Ok(json!({
        "dataDirectory": paths.data_dir,
        "snapshot": paths.snapshot,
        "userEntries": user_entries,
        "builtinEntries": catalog.entries().len() - user_entries,
        "pairedInstallations": paired_installations,
    }))
}

async fn health(State(state): State<Arc<SyncState>>) -> impl IntoResponse {
    let details = Catalog::load(Some(&state.paths.snapshot))
        .map(|catalog| {
            let user_entries = catalog
                .entries()
                .iter()
                .filter(|entry| entry.scope == ladder_catalog::CatalogScope::User)
                .count();
            json!({
                "userEntries": user_entries,
                "builtinEntries": catalog.entries().len() - user_entries,
                "paired": state.paths.auth.exists(),
            })
        })
        .unwrap_or_else(|error| json!({ "error": error.to_string() }));
    Json(json!({ "ok": true, "service": "ladder-graph-mcp", "details": details }))
}

async fn pair(State(state): State<Arc<SyncState>>, Json(request): Json<PairRequest>) -> Response {
    match pair_inner(&state.paths, request) {
        Ok(response) => (StatusCode::OK, Json(response)).into_response(),
        Err(error) => api_error(StatusCode::UNAUTHORIZED, error),
    }
}

fn pair_inner(paths: &AppPaths, request: PairRequest) -> Result<PairResponse> {
    if request.installation_id.is_empty() || request.installation_id.len() > 128 {
        anyhow::bail!("installationId is required");
    }
    let bytes =
        fs::read(&paths.pairing).context("no active pairing code; run ladder-graph-mcp pair")?;
    let record: PairingRecord = serde_json::from_slice(&bytes)?;
    let expires_at = chrono::DateTime::parse_from_rfc3339(&record.expires_at)?;
    if expires_at < Utc::now() {
        let _ = fs::remove_file(&paths.pairing);
        anyhow::bail!("pairing code expired; generate a new code");
    }
    let candidate = hash_secret(&normalize_code(&request.code));
    if !constant_time_eq(&candidate, &record.code_hash) {
        anyhow::bail!("pairing code is invalid");
    }
    fs::remove_file(&paths.pairing)?;

    let mut token_bytes = [0_u8; 32];
    rand::rng().fill_bytes(&mut token_bytes);
    let token = hex::encode(token_bytes);
    let mut store = read_auth_store(paths)?;
    store
        .tokens
        .insert(request.installation_id.clone(), hash_secret(&token));
    write_private_json(&paths.auth, &store)?;
    Ok(PairResponse {
        token,
        installation_id: request.installation_id,
    })
}

async fn publish(
    State(state): State<Arc<SyncState>>,
    headers: HeaderMap,
    Json(snapshot): Json<CatalogSnapshot>,
) -> Response {
    match publish_inner(&state.paths, &headers, snapshot) {
        Ok(response) => (StatusCode::OK, Json(response)).into_response(),
        Err(error) => {
            let status = if error
                .downcast_ref::<ladder_catalog::CatalogError>()
                .is_some()
            {
                StatusCode::BAD_REQUEST
            } else {
                StatusCode::UNAUTHORIZED
            };
            api_error(status, error)
        }
    }
}

fn publish_inner(
    paths: &AppPaths,
    headers: &HeaderMap,
    snapshot: CatalogSnapshot,
) -> Result<PublishResponse> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .context("missing bearer token")?;
    let store = read_auth_store(paths)?;
    let expected = store
        .tokens
        .get(&snapshot.installation_id)
        .context("browser installation is not paired")?;
    if !constant_time_eq(&hash_secret(token), expected) {
        anyhow::bail!("bearer token is invalid");
    }
    let snapshot = write_snapshot(&paths.snapshot, snapshot)?;
    set_private_permissions(&paths.snapshot)?;
    Ok(PublishResponse {
        revision: snapshot.revision,
        published_at: snapshot.published_at,
        entries: snapshot.entries.len(),
    })
}

fn read_auth_store(paths: &AppPaths) -> Result<AuthStore> {
    if !paths.auth.exists() {
        return Ok(AuthStore::default());
    }
    Ok(serde_json::from_slice(&fs::read(&paths.auth)?)?)
}

fn write_private_json(path: &std::path::Path, value: &impl Serialize) -> Result<()> {
    fs::write(path, serde_json::to_vec_pretty(value)?)?;
    set_private_permissions(path)?;
    Ok(())
}

fn normalize_code(code: &str) -> String {
    code.chars()
        .filter(|value| value.is_ascii_hexdigit())
        .flat_map(char::to_uppercase)
        .collect()
}

fn hash_secret(secret: &str) -> String {
    hex::encode(Sha256::digest(secret.as_bytes()))
}

fn constant_time_eq(left: &str, right: &str) -> bool {
    left.as_bytes().ct_eq(right.as_bytes()).into()
}

fn cors_layer(origins: &[String]) -> Result<CorsLayer> {
    let origins = origins
        .iter()
        .map(|origin| {
            HeaderValue::from_str(origin)
                .with_context(|| format!("invalid allowed origin {origin}"))
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]))
}

fn api_error(status: StatusCode, error: anyhow::Error) -> Response {
    (
        status,
        Json(json!({ "ok": false, "error": error.to_string() })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use ladder_catalog::{CatalogEntry, CatalogKind, CatalogScope};

    #[test]
    fn normalizes_human_pairing_codes() {
        assert_eq!(normalize_code("ab12-CD34 ef56"), "AB12CD34EF56");
    }

    #[test]
    fn pairing_authorizes_an_atomic_user_publish() {
        let directory = tempfile::tempdir().unwrap();
        let data_dir = directory.path().to_path_buf();
        let paths = AppPaths {
            snapshot: data_dir.join("catalog-v1.json"),
            pairing: data_dir.join("pairing-v1.json"),
            auth: data_dir.join("auth-v1.json"),
            data_dir,
        };
        let code = create_pairing_code(&paths).unwrap();
        let installation_id = "browser-installation".to_string();
        let paired = pair_inner(
            &paths,
            PairRequest {
                code,
                installation_id: installation_id.clone(),
            },
        )
        .unwrap();
        let builtin = Catalog::load(None)
            .unwrap()
            .resolve(
                "refinement",
                Some(CatalogKind::Workflow),
                Some(CatalogScope::Builtin),
            )
            .unwrap()
            .clone();
        let mut headers = HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", paired.token)).unwrap(),
        );
        let response = publish_inner(
            &paths,
            &headers,
            CatalogSnapshot {
                schema_version: 1,
                installation_id,
                published_at: Utc::now().to_rfc3339(),
                revision: String::new(),
                entries: vec![CatalogEntry {
                    id: "local-project".into(),
                    scope: CatalogScope::User,
                    ..builtin
                }],
            },
        )
        .unwrap();
        assert_eq!(response.entries, 1);
        assert!(response.revision.starts_with("sha256:"));
        assert!(
            Catalog::load(Some(&paths.snapshot))
                .unwrap()
                .resolve(
                    "local-project",
                    Some(CatalogKind::Workflow),
                    Some(CatalogScope::User)
                )
                .is_ok()
        );
    }
}
