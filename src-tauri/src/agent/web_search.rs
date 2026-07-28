//! [INPUT]: 依赖当前对话 Provider、runtime 模型选择、已有 Provider 凭证/ChatGPT OAuth、HTTP 传输政策与 HTML DOM 解析
//! [OUTPUT]: 向内置 web_search 工具提供 Provider-native 优先、DuckDuckGo 兜底的无额外凭证搜索路由
//! [POS]: Agent 工具层的联网搜索适配器；统一归一化来源，不改变模型可见的 web_search 契约
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

use super::chatgpt_auth;
use super::credentials::read_provider_secret;
use super::provider_http::{http_client, read_json_response, send_provider_request};
use super::provider_stream::{collect_openai_sse, ProviderStreamSink};
use super::providers::{openai_output_text, selected_model};
use super::tools::ToolExecution;
use crate::models::AgentRuntimeSettings;
use dom_query::Document;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const CHATGPT_RESPONSES_URL: &str = "https://chatgpt.com/backend-api/codex/responses";
const ANTHROPIC_MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";
const QWEN_GENERATION_URL: &str =
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";
const DDG_HTML_URL: &str = "https://html.duckduckgo.com/html/";
const DDG_LITE_URL: &str = "https://lite.duckduckgo.com/lite/";
const DDG_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NativeSearchKind {
    OpenAi,
    ChatGpt,
    Anthropic,
    Qwen,
    None,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct WebSearchResult {
    title: String,
    url: String,
    content: String,
}

#[derive(Debug)]
struct SearchResponse {
    provider: &'static str,
    answer: String,
    results: Vec<WebSearchResult>,
}

pub(super) async fn search(
    provider: &str,
    runtime: &AgentRuntimeSettings,
    query: &str,
    max_results: u64,
) -> Result<ToolExecution, String> {
    let max_results = max_results.clamp(1, 10) as usize;
    let native = native_search_kind(provider);
    let native_result = match native {
        NativeSearchKind::OpenAi => search_openai(runtime, query, max_results).await,
        NativeSearchKind::ChatGpt => search_chatgpt(runtime, query, max_results).await,
        NativeSearchKind::Anthropic => search_anthropic(runtime, query, max_results).await,
        NativeSearchKind::Qwen => search_qwen(runtime, query, max_results).await,
        NativeSearchKind::None => return search_duckduckgo(query, max_results, false).await,
    };

    match native_result {
        Ok(response) if !response.answer.trim().is_empty() || !response.results.is_empty() => {
            serialize_response(query, response, false)
        }
        Ok(_) | Err(_) => search_duckduckgo(query, max_results, true).await,
    }
}

fn native_search_kind(provider: &str) -> NativeSearchKind {
    match provider.trim().to_ascii_lowercase().as_str() {
        "openai-api" => NativeSearchKind::OpenAi,
        "chatgpt-subscription" => NativeSearchKind::ChatGpt,
        "anthropic-api" => NativeSearchKind::Anthropic,
        "qwen-api" => NativeSearchKind::Qwen,
        _ => NativeSearchKind::None,
    }
}

async fn search_openai(
    runtime: &AgentRuntimeSettings,
    query: &str,
    max_results: usize,
) -> Result<SearchResponse, String> {
    let secret = read_provider_secret("openai-api")?;
    let model = selected_model(runtime, "gpt-5.6-terra")?;
    let body = openai_search_body(model, query, max_results, "web_search", false);
    let response = send_provider_request(
        http_client()?
            .post(OPENAI_RESPONSES_URL)
            .bearer_auth(secret)
            .json(&body),
        "OpenAI",
    )
    .await
    .map_err(|error| error.to_string())?;
    let value = read_json_response(response, "OpenAI")
        .await
        .map_err(|error| error.to_string())?;
    Ok(parse_openai_response(&value, "OpenAI", max_results))
}

async fn search_chatgpt(
    runtime: &AgentRuntimeSettings,
    query: &str,
    max_results: usize,
) -> Result<SearchResponse, String> {
    let access = chatgpt_auth::access().await?;
    let model = selected_model(runtime, "gpt-5.6-sol")?;
    let mut failures = Vec::new();
    for tool_type in ["web_search", "web_search_preview"] {
        let body = openai_search_body(model, query, max_results, tool_type, true);
        let response = send_provider_request(
            http_client()?
                .post(CHATGPT_RESPONSES_URL)
                .bearer_auth(&access.token)
                .header("ChatGPT-Account-Id", &access.account_id)
                .header("OpenAI-Beta", "responses=experimental")
                .header("originator", "loby")
                .header("session-id", uuid::Uuid::new_v4().to_string())
                .json(&body),
            "ChatGPT",
        )
        .await;
        let response = match response {
            Ok(response) => response,
            Err(error) => {
                failures.push(error.to_string());
                continue;
            }
        };
        let sink: ProviderStreamSink = Arc::new(|_| {});
        match collect_openai_sse(response, &sink).await {
            Ok(value) => return Ok(parse_openai_response(&value, "ChatGPT", max_results)),
            Err(error) => failures.push(error),
        }
    }
    Err(failures
        .into_iter()
        .next()
        .unwrap_or_else(|| "ChatGPT 联网搜索暂不可用。".to_string()))
}

fn openai_search_body(
    model: &str,
    query: &str,
    max_results: usize,
    tool_type: &str,
    stream: bool,
) -> Value {
    json!({
        "model": model,
        "store": false,
        "stream": stream,
        "instructions": "You are a web search assistant. Search the web and return a concise factual answer grounded in source citations.",
        "tools": [{ "type": tool_type }],
        "tool_choice": "auto",
        "parallel_tool_calls": true,
        "text": { "verbosity": "medium" },
        "input": [{
            "role": "user",
            "content": [{
                "type": "input_text",
                "text": format!("Search the web for: {query}\n\nUse at most {max_results} relevant sources.")
            }]
        }]
    })
}

fn parse_openai_response(value: &Value, provider: &'static str, limit: usize) -> SearchResponse {
    SearchResponse {
        provider,
        answer: openai_output_text(value),
        results: collect_url_results(&value["output"], limit),
    }
}

async fn search_anthropic(
    runtime: &AgentRuntimeSettings,
    query: &str,
    max_results: usize,
) -> Result<SearchResponse, String> {
    let secret = read_provider_secret("anthropic-api")?;
    let model = selected_model(runtime, "claude-sonnet-5")?;
    let response = send_provider_request(
        http_client()?
            .post(ANTHROPIC_MESSAGES_URL)
            .header("x-api-key", secret)
            .header("anthropic-version", "2023-06-01")
            .json(&json!({
                "model": model,
                "max_tokens": 2048,
                "messages": [{
                    "role": "user",
                    "content": format!("Search the web for: {query}\n\nUse at most {max_results} relevant sources and answer concisely.")
                }],
                "tools": [{
                    "type": "web_search_20250305",
                    "name": "web_search",
                    "max_uses": 3
                }]
            })),
        "Anthropic",
    )
    .await
    .map_err(|error| error.to_string())?;
    let value = read_json_response(response, "Anthropic")
        .await
        .map_err(|error| error.to_string())?;
    let answer = value["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|block| block["type"].as_str() == Some("text"))
        .filter_map(|block| block["text"].as_str())
        .collect::<Vec<_>>()
        .join("");
    Ok(SearchResponse {
        provider: "Anthropic",
        answer,
        results: collect_url_results(&value["content"], max_results),
    })
}

async fn search_qwen(
    runtime: &AgentRuntimeSettings,
    query: &str,
    max_results: usize,
) -> Result<SearchResponse, String> {
    let secret = read_provider_secret("qwen-api")?;
    let model = selected_model(runtime, "qwen3.7-plus")?;
    let response = send_provider_request(
        http_client()?
            .post(QWEN_GENERATION_URL)
            .bearer_auth(secret)
            .json(&json!({
                "model": model,
                "input": {
                    "messages": [{ "role": "user", "content": query }]
                },
                "parameters": {
                    "enable_search": true,
                    "result_format": "message",
                    "search_options": {
                        "search_strategy": "turbo",
                        "enable_source": true
                    }
                }
            })),
        "千问",
    )
    .await
    .map_err(|error| error.to_string())?;
    let value = read_json_response(response, "千问")
        .await
        .map_err(|error| error.to_string())?;
    let answer = value["output"]["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    let results = value["output"]["search_info"]["search_results"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(search_result_from_value)
        .take(max_results)
        .collect();
    Ok(SearchResponse {
        provider: "千问",
        answer,
        results,
    })
}

async fn search_duckduckgo(
    query: &str,
    max_results: usize,
    used_as_fallback: bool,
) -> Result<ToolExecution, String> {
    let mut failures = Vec::new();
    for endpoint in [DDG_HTML_URL, DDG_LITE_URL] {
        match fetch_duckduckgo(endpoint, query, max_results).await {
            Ok(results) if !results.is_empty() => {
                return serialize_response(
                    query,
                    SearchResponse {
                        provider: "DuckDuckGo",
                        answer: String::new(),
                        results,
                    },
                    used_as_fallback,
                );
            }
            Ok(_) => failures.push("没有匹配结果".to_string()),
            Err(error) => failures.push(error),
        }
    }
    Err(format!(
        "联网搜索暂不可用：{}",
        failures
            .into_iter()
            .next()
            .unwrap_or_else(|| "DuckDuckGo 未返回结果".to_string())
    ))
}

async fn fetch_duckduckgo(
    endpoint: &str,
    query: &str,
    max_results: usize,
) -> Result<Vec<WebSearchResult>, String> {
    let response = tokio::time::timeout(
        DDG_TIMEOUT,
        http_client()?
            .get(endpoint)
            .query(&[("q", query)])
            .header("Accept", "text/html")
            .header(
                "User-Agent",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36",
            )
            .send(),
    )
    .await
    .map_err(|_| "DuckDuckGo 搜索超时。".to_string())?
    .map_err(|error| format!("无法连接 DuckDuckGo：{error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "DuckDuckGo 请求失败（HTTP {}）。",
            response.status().as_u16()
        ));
    }
    let html = tokio::time::timeout(DDG_TIMEOUT, response.text())
        .await
        .map_err(|_| "DuckDuckGo 响应读取超时。".to_string())?
        .map_err(|error| format!("DuckDuckGo 返回了无法读取的响应：{error}"))?;
    Ok(parse_duckduckgo_html(&html, max_results))
}

fn parse_duckduckgo_html(html: &str, limit: usize) -> Vec<WebSearchResult> {
    let document = Document::from(html);
    let mut results = Vec::new();
    let mut seen = HashSet::new();
    for selector in ["a.result__a", "a.result-link"] {
        for link in document.select(selector).iter() {
            if results.len() >= limit {
                return results;
            }
            let Some(href) = link.attr("href") else {
                continue;
            };
            let Some(url) = normalize_duckduckgo_url(href.as_ref()) else {
                continue;
            };
            if !seen.insert(url.clone()) {
                continue;
            }
            let title = normalize_whitespace(link.text().as_ref());
            if title.is_empty() {
                continue;
            }
            let container = link.parent().parent();
            let snippet = container
                .try_select(".result__snippet")
                .map(|selection| normalize_whitespace(selection.text().as_ref()))
                .unwrap_or_else(|| {
                    normalize_whitespace(container.text().as_ref())
                        .trim_start_matches(&title)
                        .trim()
                        .chars()
                        .take(360)
                        .collect()
                });
            results.push(WebSearchResult {
                title,
                url,
                content: snippet,
            });
        }
    }
    results
}

fn normalize_duckduckgo_url(href: &str) -> Option<String> {
    if let Some(encoded) = href
        .split(['?', '&'])
        .find_map(|part| part.strip_prefix("uddg="))
    {
        let decoded = urlencoding::decode(encoded).ok()?.into_owned();
        return valid_http_url(&decoded).then_some(decoded);
    }
    let normalized = if href.starts_with("//") {
        format!("https:{href}")
    } else {
        href.to_string()
    };
    valid_http_url(&normalized).then_some(normalized)
}

fn collect_url_results(value: &Value, limit: usize) -> Vec<WebSearchResult> {
    let mut results = Vec::new();
    collect_url_results_inner(value, &mut results, limit);
    let mut deduplicated = Vec::<WebSearchResult>::new();
    for result in results {
        if let Some(existing) = deduplicated.iter_mut().find(|item| item.url == result.url) {
            if existing.title == existing.url && result.title != result.url {
                existing.title = result.title;
            }
            if existing.content.is_empty() && !result.content.is_empty() {
                existing.content = result.content;
            }
        } else if deduplicated.len() < limit {
            deduplicated.push(result);
        }
    }
    deduplicated
}

fn collect_url_results_inner(value: &Value, results: &mut Vec<WebSearchResult>, limit: usize) {
    if results.len() >= limit.saturating_mul(3) {
        return;
    }
    match value {
        Value::Array(values) => {
            for value in values {
                collect_url_results_inner(value, results, limit);
            }
        }
        Value::Object(object) => {
            if let Some(result) = search_result_from_value(value) {
                results.push(result);
            }
            for child in object.values() {
                collect_url_results_inner(child, results, limit);
            }
        }
        _ => {}
    }
}

fn search_result_from_value(value: &Value) -> Option<WebSearchResult> {
    let url = value["url"].as_str()?.trim();
    if !valid_http_url(url) {
        return None;
    }
    let title = value["title"]
        .as_str()
        .map(normalize_whitespace)
        .filter(|title| !title.is_empty())
        .unwrap_or_else(|| url.to_string());
    let content = ["content", "snippet", "description", "cited_text"]
        .into_iter()
        .find_map(|field| value[field].as_str())
        .map(normalize_whitespace)
        .unwrap_or_default();
    Some(WebSearchResult {
        title,
        url: url.to_string(),
        content,
    })
}

fn valid_http_url(value: &str) -> bool {
    value.starts_with("https://") || value.starts_with("http://")
}

fn normalize_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn serialize_response(
    query: &str,
    response: SearchResponse,
    used_as_fallback: bool,
) -> Result<ToolExecution, String> {
    let note = used_as_fallback.then_some("当前连接的原生搜索不可用，已自动改用 DuckDuckGo。");
    let output = serde_json::to_string(&json!({
        "query": query,
        "provider": response.provider,
        "answer": response.answer,
        "results": response.results,
        "note": note
    }))
    .map_err(|error| error.to_string())?;
    Ok(ToolExecution {
        output,
        artifact_path: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_only_supported_connections_to_native_search() {
        assert_eq!(native_search_kind("openai-api"), NativeSearchKind::OpenAi);
        assert_eq!(
            native_search_kind("chatgpt-subscription"),
            NativeSearchKind::ChatGpt
        );
        assert_eq!(
            native_search_kind("anthropic-api"),
            NativeSearchKind::Anthropic
        );
        assert_eq!(native_search_kind("qwen-api"), NativeSearchKind::Qwen);
        assert_eq!(native_search_kind("deepseek-api"), NativeSearchKind::None);
        assert_eq!(native_search_kind("kimi-api"), NativeSearchKind::None);
    }

    #[test]
    fn openai_response_normalizes_and_deduplicates_citations() {
        let value = json!({
            "output": [
                { "type": "web_search_call", "action": { "sources": [
                    { "type": "url", "url": "https://example.com/a" }
                ]}},
                { "type": "message", "content": [{
                    "type": "output_text",
                    "text": "answer",
                    "annotations": [{
                        "type": "url_citation",
                        "url": "https://example.com/a",
                        "title": "Example A"
                    }]
                }]}
            ]
        });
        let response = parse_openai_response(&value, "OpenAI", 5);
        assert_eq!(response.answer, "answer");
        assert_eq!(response.results.len(), 1);
        assert_eq!(response.results[0].title, "Example A");
    }

    #[test]
    fn anthropic_search_blocks_keep_title_url_and_cited_text() {
        let value = json!({
            "content": [{
                "type": "web_search_tool_result",
                "content": [{
                    "type": "web_search_result",
                    "title": "Claude docs",
                    "url": "https://example.com/claude",
                    "cited_text": "Current documentation"
                }]
            }]
        });
        let results = collect_url_results(&value, 5);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content, "Current documentation");
    }

    #[test]
    fn parses_duckduckgo_html_and_decodes_redirect_urls() {
        let html = r#"
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpost">Example Post</a>
              <a class="result__snippet">A useful result snippet.</a>
            </div>
        "#;
        let results = parse_duckduckgo_html(html, 5);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].url, "https://example.com/post");
        assert_eq!(results[0].title, "Example Post");
        assert_eq!(results[0].content, "A useful result snippet.");
    }
}
