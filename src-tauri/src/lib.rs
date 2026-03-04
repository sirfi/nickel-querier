use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
pub enum AppError {
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("Query error: {0}")]
    Query(String),
    #[error("Connection error: {0}")]
    Connection(String),
    #[error("JSON error: {0}")]
    Json(String),
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Http(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Json(e.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub tls: bool,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        Self {
            host: "localhost".to_string(),
            port: 8093,
            username: "Administrator".to_string(),
            password: "password".to_string(),
            tls: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryRequest {
    pub statement: String,
    pub timeout: Option<String>,
    pub scan_consistency: Option<String>,
    pub parameters: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryResult {
    pub results: Vec<serde_json::Value>,
    pub status: String,
    pub metrics: QueryMetrics,
    pub warnings: Vec<serde_json::Value>,
    pub errors: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryMetrics {
    pub elapsed_time: String,
    pub execution_time: String,
    pub result_count: u64,
    pub result_size: u64,
    pub mutation_count: u64,
    pub error_count: u64,
    pub warning_count: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BucketInfo {
    pub name: String,
    pub bucket_type: String,
    pub quota_used: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SchemaField {
    pub name: String,
    pub field_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollectionSchema {
    pub bucket: String,
    pub scope: String,
    pub collection: String,
    pub fields: Vec<SchemaField>,
}

/// Build the base URL for the Query Service
fn query_url(config: &ConnectionConfig) -> String {
    let scheme = if config.tls { "https" } else { "http" };
    format!("{}://{}:{}/query/service", scheme, config.host, config.port)
}

/// Build the base URL for the Management API
fn mgmt_url(config: &ConnectionConfig, path: &str) -> String {
    let scheme = if config.tls { "https" } else { "http" };
    let port = if config.tls { 18091 } else { 8091 };
    format!("{}://{}:{}{}", scheme, config.host, port, path)
}

fn build_client(config: &ConnectionConfig) -> Result<reqwest::Client, AppError> {
    let builder = reqwest::Client::builder();
    let builder = if config.tls {
        builder.danger_accept_invalid_certs(true)
    } else {
        builder
    };
    builder
        .build()
        .map_err(|e| AppError::Connection(e.to_string()))
}

#[tauri::command]
async fn execute_query(
    config: ConnectionConfig,
    request: QueryRequest,
) -> Result<QueryResult, AppError> {
    let client = build_client(&config)?;

    let mut body = serde_json::json!({
        "statement": request.statement,
    });

    if let Some(timeout) = &request.timeout {
        body["timeout"] = serde_json::Value::String(timeout.clone());
    }
    if let Some(scan_consistency) = &request.scan_consistency {
        body["scan_consistency"] = serde_json::Value::String(scan_consistency.clone());
    }
    if let Some(params) = &request.parameters {
        body["args"] = params.clone();
    }

    let response = client
        .post(&query_url(&config))
        .basic_auth(&config.username, Some(&config.password))
        .json(&body)
        .send()
        .await?;

    let raw: serde_json::Value = response.json().await?;

    let status = raw["status"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    let results = raw["results"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let warnings = raw["warnings"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let errors = raw["errors"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let metrics_raw = &raw["metrics"];
    let metrics = QueryMetrics {
        elapsed_time: metrics_raw["elapsedTime"]
            .as_str()
            .unwrap_or("0ms")
            .to_string(),
        execution_time: metrics_raw["executionTime"]
            .as_str()
            .unwrap_or("0ms")
            .to_string(),
        result_count: metrics_raw["resultCount"].as_u64().unwrap_or(0),
        result_size: metrics_raw["resultSize"].as_u64().unwrap_or(0),
        mutation_count: metrics_raw["mutationCount"].as_u64().unwrap_or(0),
        error_count: metrics_raw["errorCount"].as_u64().unwrap_or(0),
        warning_count: metrics_raw["warningCount"].as_u64().unwrap_or(0),
    };

    if !errors.is_empty() && status != "success" {
        let msg = errors
            .iter()
            .filter_map(|e| e["msg"].as_str())
            .collect::<Vec<_>>()
            .join("; ");
        return Err(AppError::Query(msg));
    }

    Ok(QueryResult {
        results,
        status,
        metrics,
        warnings,
        errors,
    })
}

#[tauri::command]
async fn get_explain_plan(
    config: ConnectionConfig,
    statement: String,
) -> Result<serde_json::Value, AppError> {
    let explain_stmt = format!("EXPLAIN {}", statement);
    let result = execute_query(
        config,
        QueryRequest {
            statement: explain_stmt,
            timeout: Some("30s".to_string()),
            scan_consistency: None,
            parameters: None,
        },
    )
    .await?;

    Ok(result
        .results
        .into_iter()
        .next()
        .unwrap_or(serde_json::Value::Null))
}

#[tauri::command]
async fn list_buckets(config: ConnectionConfig) -> Result<Vec<BucketInfo>, AppError> {
    let client = build_client(&config)?;
    let url = mgmt_url(&config, "/pools/default/buckets");

    let response = client
        .get(&url)
        .basic_auth(&config.username, Some(&config.password))
        .send()
        .await?;

    let buckets: Vec<serde_json::Value> = response.json().await?;

    Ok(buckets
        .iter()
        .map(|b| BucketInfo {
            name: b["name"].as_str().unwrap_or("").to_string(),
            bucket_type: b["bucketType"].as_str().unwrap_or("couchbase").to_string(),
            quota_used: b["basicStats"]["quotaPercentUsed"].as_u64(),
        })
        .collect())
}

#[tauri::command]
async fn get_keyspace_metadata(
    config: ConnectionConfig,
    bucket: String,
) -> Result<Vec<CollectionSchema>, AppError> {
    // Use system:keyspaces to enumerate scopes/collections
    let stmt = format!(
        "SELECT `datastore-id`, `id`, `name`, `namespace`, `path` \
         FROM system:keyspaces WHERE `namespace` = '{}'",
        bucket
    );
    let result = execute_query(
        config.clone(),
        QueryRequest {
            statement: stmt,
            timeout: Some("10s".to_string()),
            scan_consistency: None,
            parameters: None,
        },
    )
    .await;

    // Fallback: return a single schema entry for the bucket
    match result {
        Ok(r) => {
            let schemas = r
                .results
                .iter()
                .map(|row| CollectionSchema {
                    bucket: bucket.clone(),
                    scope: row["path"]
                        .as_str()
                        .and_then(|p| p.split('.').nth(1))
                        .unwrap_or("_default")
                        .to_string(),
                    collection: row["name"]
                        .as_str()
                        .unwrap_or("_default")
                        .to_string(),
                    fields: vec![],
                })
                .collect();
            Ok(schemas)
        }
        Err(_) => Ok(vec![CollectionSchema {
            bucket: bucket.clone(),
            scope: "_default".to_string(),
            collection: "_default".to_string(),
            fields: vec![],
        }]),
    }
}

#[tauri::command]
async fn infer_schema(
    config: ConnectionConfig,
    keyspace: String,
) -> Result<Vec<SchemaField>, AppError> {
    let stmt = format!(
        "INFER `{}` WITH {{\"sample_size\": 100, \"num_sample_values\": 5}}",
        keyspace
    );
    let result = execute_query(
        config,
        QueryRequest {
            statement: stmt,
            timeout: Some("30s".to_string()),
            scan_consistency: None,
            parameters: None,
        },
    )
    .await;

    match result {
        Ok(r) => {
            let fields = r
                .results
                .iter()
                .flat_map(|schema| {
                    schema
                        .as_array()
                        .cloned()
                        .unwrap_or_default()
                        .into_iter()
                        .flat_map(|entry| {
                            entry["properties"]
                                .as_object()
                                .cloned()
                                .unwrap_or_default()
                                .into_iter()
                                .map(|(name, val)| SchemaField {
                                    name,
                                    field_type: val["type"]
                                        .as_str()
                                        .unwrap_or("any")
                                        .to_string(),
                                })
                                .collect::<Vec<_>>()
                        })
                })
                .collect();
            Ok(fields)
        }
        Err(_) => Ok(vec![]),
    }
}

#[tauri::command]
async fn test_connection(config: ConnectionConfig) -> Result<bool, AppError> {
    let request = QueryRequest {
        statement: "SELECT 1 AS connected".to_string(),
        timeout: Some("5s".to_string()),
        scan_consistency: None,
        parameters: None,
    };
    execute_query(config, request).await?;
    Ok(true)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            execute_query,
            get_explain_plan,
            list_buckets,
            get_keyspace_metadata,
            infer_schema,
            test_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> ConnectionConfig {
        ConnectionConfig {
            host: "localhost".to_string(),
            port: 8093,
            username: "Administrator".to_string(),
            password: "password".to_string(),
            tls: false,
        }
    }

    fn tls_config() -> ConnectionConfig {
        ConnectionConfig {
            host: "cb.example.com".to_string(),
            port: 18093,
            username: "dev".to_string(),
            password: "s3cr3t".to_string(),
            tls: true,
        }
    }

    // --- ConnectionConfig::default ---

    #[test]
    fn connection_config_default_values() {
        let cfg = ConnectionConfig::default();
        assert_eq!(cfg.host, "localhost");
        assert_eq!(cfg.port, 8093);
        assert_eq!(cfg.username, "Administrator");
        assert!(!cfg.tls);
    }

    // --- query_url ---

    #[test]
    fn query_url_http() {
        let cfg = test_config();
        assert_eq!(query_url(&cfg), "http://localhost:8093/query/service");
    }

    #[test]
    fn query_url_https() {
        let cfg = tls_config();
        assert_eq!(
            query_url(&cfg),
            "https://cb.example.com:18093/query/service"
        );
    }

    // --- mgmt_url ---

    #[test]
    fn mgmt_url_http() {
        let cfg = test_config();
        assert_eq!(
            mgmt_url(&cfg, "/pools/default/buckets"),
            "http://localhost:8091/pools/default/buckets"
        );
    }

    #[test]
    fn mgmt_url_https() {
        let cfg = tls_config();
        assert_eq!(
            mgmt_url(&cfg, "/pools/default/buckets"),
            "https://cb.example.com:18091/pools/default/buckets"
        );
    }

    // --- build_client ---

    #[test]
    fn build_client_succeeds_for_plain_http() {
        let cfg = test_config();
        assert!(build_client(&cfg).is_ok());
    }

    #[test]
    fn build_client_succeeds_for_tls() {
        let cfg = tls_config();
        assert!(build_client(&cfg).is_ok());
    }

    // --- AppError Display ---

    #[test]
    fn app_error_display_http() {
        let e = AppError::Http("timeout".to_string());
        assert_eq!(e.to_string(), "HTTP error: timeout");
    }

    #[test]
    fn app_error_display_query() {
        let e = AppError::Query("syntax error".to_string());
        assert_eq!(e.to_string(), "Query error: syntax error");
    }

    #[test]
    fn app_error_display_connection() {
        let e = AppError::Connection("refused".to_string());
        assert_eq!(e.to_string(), "Connection error: refused");
    }

    #[test]
    fn app_error_display_json() {
        let e = AppError::Json("invalid token".to_string());
        assert_eq!(e.to_string(), "JSON error: invalid token");
    }

    // --- From<serde_json::Error> ---

    #[test]
    fn app_error_from_serde_json_error() {
        let json_err: serde_json::Error =
            serde_json::from_str::<serde_json::Value>("not_json{").unwrap_err();
        let app_err = AppError::from(json_err);
        assert!(matches!(app_err, AppError::Json(_)));
    }
}
