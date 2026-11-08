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

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct QueryRequest {
    pub statement: String,
    #[serde(default)]
    pub timeout: Option<String>,
    #[serde(default)]
    pub scan_consistency: Option<String>,
    /// Positional parameters (`$1`, `$2`, …) sent as `args`.
    #[serde(default)]
    pub parameters: Option<serde_json::Value>,
    /// Named parameters (`$name`); keys may be given with or without `$`.
    #[serde(default)]
    pub named_parameters: Option<serde_json::Map<String, serde_json::Value>>,
    /// Identifier used to cancel the request via `system:active_requests`.
    #[serde(default)]
    pub client_context_id: Option<String>,
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
    let builder = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        // Generous upper bound; the per-query timeout is enforced by the server.
        .timeout(std::time::Duration::from_secs(15 * 60));
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

    let body = build_query_body(&request);

    let response = client
        .post(query_url(&config))
        .basic_auth(&config.username, Some(&config.password))
        .json(&body)
        .send()
        .await?;

    let http_status = response.status().as_u16();
    let text = response.text().await?;
    parse_query_response(http_status, &text)
}

/// Build the JSON body for a Query Service request.
fn build_query_body(request: &QueryRequest) -> serde_json::Value {
    let mut body = serde_json::json!({ "statement": request.statement });
    if let Some(timeout) = &request.timeout {
        body["timeout"] = serde_json::Value::String(timeout.clone());
    }
    if let Some(sc) = &request.scan_consistency {
        body["scan_consistency"] = serde_json::Value::String(sc.clone());
    }
    if let Some(params) = &request.parameters {
        if params.as_array().map(|a| !a.is_empty()).unwrap_or(true) {
            body["args"] = params.clone();
        }
    }
    if let Some(named) = &request.named_parameters {
        for (k, v) in named {
            let key = if k.starts_with('$') { k.clone() } else { format!("${}", k) };
            body[key] = v.clone();
        }
    }
    if let Some(id) = &request.client_context_id {
        body["client_context_id"] = serde_json::Value::String(id.clone());
    }
    body
}

/// Format the `errors` array of a Query Service response as `[code] msg; …`.
fn format_query_errors(errors: &[serde_json::Value]) -> String {
    let parts: Vec<String> = errors
        .iter()
        .map(|e| {
            let msg = e["msg"]
                .as_str()
                .map(str::to_string)
                .unwrap_or_else(|| e.to_string());
            match e["code"].as_u64() {
                Some(code) => format!("[{}] {}", code, msg),
                None => msg,
            }
        })
        .collect();
    if parts.is_empty() {
        "unknown error".to_string()
    } else {
        parts.join("; ")
    }
}

fn truncate_body(body: &str) -> String {
    const MAX: usize = 500;
    let trimmed = body.trim();
    if trimmed.chars().count() > MAX {
        format!("{}…", trimmed.chars().take(MAX).collect::<String>())
    } else {
        trimmed.to_string()
    }
}

/// Parse a Query Service HTTP response into a `QueryResult` (or an error).
fn parse_query_response(http_status: u16, body: &str) -> Result<QueryResult, AppError> {
    let raw: serde_json::Value = match serde_json::from_str(body) {
        Ok(v) => v,
        Err(e) => {
            return Err(match http_status {
                401 => AppError::Connection(
                    "Authentication failed (HTTP 401): check username and password".to_string(),
                ),
                200..=299 => AppError::Json(format!("Invalid response from server: {}", e)),
                _ => AppError::Http(format!("HTTP {}: {}", http_status, truncate_body(body))),
            })
        }
    };

    let status = raw["status"].as_str().unwrap_or("unknown").to_string();
    let results = raw["results"].as_array().cloned().unwrap_or_default();
    let warnings = raw["warnings"].as_array().cloned().unwrap_or_default();
    let errors = raw["errors"].as_array().cloned().unwrap_or_default();

    let metrics_raw = &raw["metrics"];
    let metrics = QueryMetrics {
        elapsed_time: metrics_raw["elapsedTime"].as_str().unwrap_or("0ms").to_string(),
        execution_time: metrics_raw["executionTime"].as_str().unwrap_or("0ms").to_string(),
        result_count: metrics_raw["resultCount"]
            .as_u64()
            .unwrap_or(results.len() as u64),
        result_size: metrics_raw["resultSize"].as_u64().unwrap_or(0),
        mutation_count: metrics_raw["mutationCount"].as_u64().unwrap_or(0),
        error_count: metrics_raw["errorCount"].as_u64().unwrap_or(errors.len() as u64),
        warning_count: metrics_raw["warningCount"].as_u64().unwrap_or(warnings.len() as u64),
    };

    let failed = status != "success" && (!errors.is_empty() || !(200..300).contains(&http_status));
    if failed {
        if errors.is_empty() {
            return Err(AppError::Http(format!(
                "HTTP {} (status: {})",
                http_status, status
            )));
        }
        return Err(AppError::Query(format_query_errors(&errors)));
    }

    Ok(QueryResult {
        results,
        status,
        metrics,
        warnings,
        errors,
    })
}

/// Prefix a statement with EXPLAIN unless it already has one.
fn build_explain_statement(statement: &str) -> String {
    let trimmed = statement.trim();
    let first_word = trimmed
        .split(|c: char| c.is_whitespace())
        .next()
        .unwrap_or("");
    if first_word.eq_ignore_ascii_case("EXPLAIN") {
        trimmed.to_string()
    } else {
        format!("EXPLAIN {}", trimmed)
    }
}

/// Quote a single N1QL identifier with backticks.
fn quote_identifier(name: &str) -> String {
    format!("`{}`", name.replace('`', "``"))
}

/// Build a quoted keyspace path; `_default._default` collapses to the bucket.
fn keyspace_path(bucket: &str, scope: &str, collection: &str) -> String {
    if scope == "_default" && collection == "_default" {
        quote_identifier(bucket)
    } else {
        format!(
            "{}.{}.{}",
            quote_identifier(bucket),
            quote_identifier(scope),
            quote_identifier(collection)
        )
    }
}

/// Turn a management API error response into a readable error.
fn mgmt_error(http_status: u16, body: &str) -> AppError {
    match http_status {
        401 => AppError::Connection(
            "Authentication failed (HTTP 401): check username and password".to_string(),
        ),
        403 => AppError::Connection(
            "Permission denied (HTTP 403): the user cannot read cluster metadata".to_string(),
        ),
        _ => AppError::Http(format!("HTTP {}: {}", http_status, truncate_body(body))),
    }
}

/// Parse `/pools/default/buckets/{bucket}/scopes` into collection entries.
fn parse_scopes(bucket: &str, raw: &serde_json::Value) -> Vec<CollectionSchema> {
    let mut out: Vec<CollectionSchema> = raw["scopes"]
        .as_array()
        .map(|scopes| {
            scopes
                .iter()
                .flat_map(|scope| {
                    let scope_name = scope["name"].as_str().unwrap_or("_default").to_string();
                    scope["collections"]
                        .as_array()
                        .cloned()
                        .unwrap_or_default()
                        .into_iter()
                        .filter_map(move |c| {
                            c["name"].as_str().map(|name| CollectionSchema {
                                bucket: bucket.to_string(),
                                scope: scope_name.clone(),
                                collection: name.to_string(),
                                fields: vec![],
                            })
                        })
                })
                .collect()
        })
        .unwrap_or_default();
    // Default collection first, then alphabetical.
    out.sort_by(|a, b| {
        let a_def = a.scope == "_default" && a.collection == "_default";
        let b_def = b.scope == "_default" && b.collection == "_default";
        b_def
            .cmp(&a_def)
            .then_with(|| a.scope.cmp(&b.scope))
            .then_with(|| a.collection.cmp(&b.collection))
    });
    out
}

fn infer_type_name(v: &serde_json::Value) -> String {
    match &v["type"] {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(types) => types
            .iter()
            .filter_map(|t| t.as_str())
            .collect::<Vec<_>>()
            .join("|"),
        _ => "any".to_string(),
    }
}

fn collect_properties(
    props: &serde_json::Map<String, serde_json::Value>,
    prefix: &str,
    depth: usize,
    out: &mut Vec<SchemaField>,
) {
    for (name, val) in props {
        let path = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{}.{}", prefix, name)
        };
        if !out.iter().any(|f| f.name == path) {
            out.push(SchemaField {
                name: path.clone(),
                field_type: infer_type_name(val),
            });
        }
        if depth < 4 {
            if let Some(nested) = val["properties"].as_object() {
                collect_properties(nested, &path, depth + 1, out);
            }
        }
    }
}

/// Flatten the result of INFER (one or more "flavors") into a field list,
/// including nested object fields as dotted paths (`address.city`).
fn parse_infer_fields(results: &[serde_json::Value]) -> Vec<SchemaField> {
    let mut out = Vec::new();
    for schema in results {
        let flavors = match schema.as_array() {
            Some(arr) => arr.clone(),
            None => vec![schema.clone()],
        };
        for flavor in flavors {
            if let Some(props) = flavor["properties"].as_object() {
                collect_properties(props, "", 0, &mut out);
            }
        }
    }
    out
}

#[tauri::command]
async fn get_explain_plan(
    config: ConnectionConfig,
    statement: String,
) -> Result<serde_json::Value, AppError> {
    let explain_stmt = build_explain_statement(&statement);
    let result = execute_query(
        config,
        QueryRequest {
            statement: explain_stmt,
            timeout: Some("30s".to_string()),
            ..Default::default()
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

    let http_status = response.status();
    let text = response.text().await?;
    if !http_status.is_success() {
        return Err(mgmt_error(http_status.as_u16(), &text));
    }
    let buckets: Vec<serde_json::Value> = serde_json::from_str(&text)?;

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
    let default_only = || {
        vec![CollectionSchema {
            bucket: bucket.clone(),
            scope: "_default".to_string(),
            collection: "_default".to_string(),
            fields: vec![],
        }]
    };

    let client = build_client(&config)?;
    let mut url = reqwest::Url::parse(&mgmt_url(&config, "/"))
        .map_err(|e| AppError::Connection(e.to_string()))?;
    url.path_segments_mut()
        .map_err(|_| AppError::Connection("invalid management URL".to_string()))?
        .clear()
        .extend(["pools", "default", "buckets", bucket.as_str(), "scopes"]);

    let response = client
        .get(url)
        .basic_auth(&config.username, Some(&config.password))
        .send()
        .await?;
    let http_status = response.status();
    let text = response.text().await?;

    // Pre-7.0 clusters have no scopes endpoint: fall back to the bucket itself.
    if http_status.as_u16() == 404 {
        return Ok(default_only());
    }
    if !http_status.is_success() {
        return Err(mgmt_error(http_status.as_u16(), &text));
    }
    let raw: serde_json::Value = serde_json::from_str(&text)?;
    let schemas = parse_scopes(&bucket, &raw);
    Ok(if schemas.is_empty() { default_only() } else { schemas })
}

#[tauri::command]
async fn infer_schema(
    config: ConnectionConfig,
    bucket: String,
    scope: String,
    collection: String,
) -> Result<Vec<SchemaField>, AppError> {
    let stmt = format!(
        "INFER {} WITH {{\"sample_size\": 1000, \"num_sample_values\": 3}}",
        keyspace_path(&bucket, &scope, &collection)
    );
    let result = execute_query(
        config,
        QueryRequest {
            statement: stmt,
            timeout: Some("30s".to_string()),
            ..Default::default()
        },
    )
    .await?;
    Ok(parse_infer_fields(&result.results))
}

/// Cancel a running request started with the given `client_context_id`.
#[tauri::command]
async fn cancel_query(
    config: ConnectionConfig,
    client_context_id: String,
) -> Result<bool, AppError> {
    let result = execute_query(
        config,
        QueryRequest {
            statement: "DELETE FROM system:active_requests WHERE clientContextID = $1".to_string(),
            timeout: Some("10s".to_string()),
            parameters: Some(serde_json::json!([client_context_id])),
            ..Default::default()
        },
    )
    .await?;
    Ok(result.metrics.mutation_count > 0)
}

#[tauri::command]
async fn test_connection(config: ConnectionConfig) -> Result<bool, AppError> {
    let request = QueryRequest {
        statement: "SELECT 1 AS connected".to_string(),
        timeout: Some("5s".to_string()),
        ..Default::default()
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
            cancel_query,
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

    // --- parse_query_response ---

    #[test]
    fn parse_success_response() {
        let body = r#"{"status":"success","results":[{"a":1}],
            "metrics":{"elapsedTime":"2ms","executionTime":"1ms","resultCount":1,"resultSize":7}}"#;
        let r = parse_query_response(200, body).unwrap();
        assert_eq!(r.status, "success");
        assert_eq!(r.results.len(), 1);
        assert_eq!(r.metrics.result_count, 1);
        assert_eq!(r.metrics.elapsed_time, "2ms");
    }

    #[test]
    fn parse_error_response_includes_code_and_message() {
        let body = r#"{"status":"fatal","errors":[{"code":3000,"msg":"syntax error - at end of input"}]}"#;
        match parse_query_response(400, body) {
            Err(AppError::Query(m)) => assert_eq!(m, "[3000] syntax error - at end of input"),
            other => panic!("unexpected: {:?}", other),
        }
    }

    #[test]
    fn parse_error_without_msg_does_not_return_empty_message() {
        let body = r#"{"status":"errors","errors":[{"code":12003}]}"#;
        match parse_query_response(500, body) {
            Err(AppError::Query(m)) => assert!(m.starts_with("[12003] ")),
            other => panic!("unexpected: {:?}", other),
        }
    }

    #[test]
    fn parse_non_json_401_is_an_auth_error() {
        match parse_query_response(401, "Unauthorized") {
            Err(AppError::Connection(m)) => assert!(m.contains("401")),
            other => panic!("unexpected: {:?}", other),
        }
    }

    #[test]
    fn parse_non_json_502_reports_status_and_body() {
        match parse_query_response(502, "<html>Bad Gateway</html>") {
            Err(AppError::Http(m)) => {
                assert!(m.contains("502"));
                assert!(m.contains("Bad Gateway"));
            }
            other => panic!("unexpected: {:?}", other),
        }
    }

    #[test]
    fn parse_http_error_without_errors_array_is_an_error() {
        assert!(parse_query_response(503, r#"{"status":"stopped"}"#).is_err());
    }

    #[test]
    fn parse_result_count_falls_back_to_result_length() {
        let r = parse_query_response(200, r#"{"status":"success","results":[1,2,3]}"#).unwrap();
        assert_eq!(r.metrics.result_count, 3);
    }

    #[test]
    fn parse_success_with_warnings_is_ok() {
        let body = r#"{"status":"success","results":[],"warnings":[{"code":1,"msg":"w"}]}"#;
        let r = parse_query_response(200, body).unwrap();
        assert_eq!(r.warnings.len(), 1);
    }

    // --- build_explain_statement ---

    #[test]
    fn explain_is_prefixed_once() {
        assert_eq!(build_explain_statement(" SELECT 1 "), "EXPLAIN SELECT 1");
        assert_eq!(build_explain_statement("explain SELECT 1"), "explain SELECT 1");
        assert_eq!(build_explain_statement("EXPLAIN\nSELECT 1"), "EXPLAIN\nSELECT 1");
    }

    // --- keyspace_path ---

    #[test]
    fn keyspace_path_quotes_each_part() {
        assert_eq!(
            keyspace_path("travel-sample", "inventory", "airline"),
            "`travel-sample`.`inventory`.`airline`"
        );
    }

    #[test]
    fn keyspace_path_default_collection_is_bucket() {
        assert_eq!(keyspace_path("beer.sample", "_default", "_default"), "`beer.sample`");
    }

    #[test]
    fn quote_identifier_escapes_backticks() {
        assert_eq!(quote_identifier("a`b"), "`a``b`");
    }

    // --- parse_scopes ---

    #[test]
    fn parse_scopes_lists_all_collections_default_first() {
        let raw = serde_json::json!({
            "scopes": [
                {"name": "inventory", "collections": [{"name": "route"}, {"name": "airline"}]},
                {"name": "_default", "collections": [{"name": "_default"}]}
            ]
        });
        let s = parse_scopes("travel-sample", &raw);
        let names: Vec<String> = s.iter().map(|c| format!("{}.{}", c.scope, c.collection)).collect();
        assert_eq!(names, vec!["_default._default", "inventory.airline", "inventory.route"]);
        assert!(s.iter().all(|c| c.bucket == "travel-sample"));
    }

    #[test]
    fn parse_scopes_handles_missing_field() {
        assert!(parse_scopes("b", &serde_json::json!({})).is_empty());
    }

    // --- parse_infer_fields ---

    #[test]
    fn parse_infer_fields_flattens_nested_and_merges_flavors() {
        let results = vec![serde_json::json!([
            {
                "properties": {
                    "name": {"type": "string"},
                    "geo": {"type": "object", "properties": {"lat": {"type": "number"}}},
                    "tags": {"type": ["array", "null"]}
                }
            },
            { "properties": { "name": {"type": "string"}, "extra": {"type": "boolean"} } }
        ])];
        let f = parse_infer_fields(&results);
        let get = |n: &str| f.iter().find(|x| x.name == n).map(|x| x.field_type.clone());
        assert_eq!(get("name").as_deref(), Some("string"));
        assert_eq!(get("geo.lat").as_deref(), Some("number"));
        assert_eq!(get("tags").as_deref(), Some("array|null"));
        assert_eq!(get("extra").as_deref(), Some("boolean"));
        assert_eq!(f.iter().filter(|x| x.name == "name").count(), 1);
    }

    // --- mgmt_error ---

    #[test]
    fn mgmt_error_maps_auth_statuses() {
        assert!(matches!(mgmt_error(401, ""), AppError::Connection(_)));
        assert!(matches!(mgmt_error(403, ""), AppError::Connection(_)));
        assert!(matches!(mgmt_error(500, "boom"), AppError::Http(_)));
    }

    // --- build_query_body ---

    #[test]
    fn query_body_contains_all_options() {
        let mut named = serde_json::Map::new();
        named.insert("city".to_string(), serde_json::json!("Paris"));
        named.insert("$limit".to_string(), serde_json::json!(5));
        let body = build_query_body(&QueryRequest {
            statement: "SELECT 1".to_string(),
            timeout: Some("60s".to_string()),
            scan_consistency: Some("request_plus".to_string()),
            parameters: Some(serde_json::json!([1, "a"])),
            named_parameters: Some(named),
            client_context_id: Some("ctx-1".to_string()),
        });
        assert_eq!(body["statement"], "SELECT 1");
        assert_eq!(body["timeout"], "60s");
        assert_eq!(body["scan_consistency"], "request_plus");
        assert_eq!(body["args"], serde_json::json!([1, "a"]));
        assert_eq!(body["$city"], "Paris");
        assert_eq!(body["$limit"], 5);
        assert_eq!(body["client_context_id"], "ctx-1");
    }

    #[test]
    fn query_body_omits_empty_args() {
        let body = build_query_body(&QueryRequest {
            statement: "SELECT 1".to_string(),
            parameters: Some(serde_json::json!([])),
            ..Default::default()
        });
        assert!(body.get("args").is_none());
        assert!(body.get("client_context_id").is_none());
    }

    #[test]
    fn query_request_deserializes_without_optional_fields() {
        let r: QueryRequest = serde_json::from_str(r#"{"statement":"SELECT 1"}"#).unwrap();
        assert!(r.named_parameters.is_none());
    }
}
