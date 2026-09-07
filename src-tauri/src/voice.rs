use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

static REQUESTS: Mutex<(u64, u32, bool)> = Mutex::new((0, 0, false));
fn settings() -> Option<(String, String)> {
    let url = std::env::var("XRAY_VOICE_EDGE_URL").ok()?;
    let token = std::env::var("XRAY_VOICE_EDGE_TOKEN").ok()?;
    let parsed = reqwest::Url::parse(&url).ok()?;
    if parsed.scheme() != "https" || !parsed.host_str()?.ends_with(".supabase.co") || token.len() < 32 { return None; }
    Some((url, token))
}
#[tauri::command]
pub fn xray_voice_status() -> Value {
    let configured = settings().is_some();
    json!({"provider":"Deepgram", "configured":configured, "available":configured})
}
#[tauri::command]
pub async fn xray_voice_request(request_json: String) -> Result<Value, String> {
    if request_json.len() > 3 * 1024 * 1024 { return Err("Voice recording is too large.".into()); }
    let input: Value = serde_json::from_str(&request_json).map_err(|_| "Invalid voice request.")?;
    match input["action"].as_str() {
        Some("speak") if input["text"].as_str().is_some_and(|s| !s.trim().is_empty() && s.chars().count() <= 3000) => {},
        Some("transcribe") if input["audioBase64"].as_str().is_some_and(|s| !s.is_empty()) => {},
        _ => return Err("Invalid voice request.".into()),
    }
    let (url, token) = settings().ok_or("Voice is not configured. Reopen X-Ray using the local desktop launcher.")?;
    {
        let mut guard = REQUESTS.lock().map_err(|_| "Voice state unavailable.")?;
        let hour = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|_| "Clock unavailable.")?.as_secs() / 3600;
        if guard.0 != hour { guard.0 = hour; guard.1 = 0; }
        if guard.2 || guard.1 >= 120 { return Err("Voice is busy or has reached its hourly limit.".into()); }
        guard.1 += 1; guard.2 = true;
    }
    let result = send(url, token, request_json).await;
    if let Ok(mut guard) = REQUESTS.lock() { guard.2 = false; }
    result
}
async fn send(url: String, token: String, body: String) -> Result<Value, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(35)).redirect(reqwest::redirect::Policy::none()).build().map_err(|_| "Voice client unavailable.")?;
    let mut response = client.post(url).header("x-xray-voice-key", token).header("Content-Type", "application/json").body(body).send().await.map_err(|_| "Voice connection failed or timed out.")?;
    if !response.status().is_success() { return Err(format!("Voice service failed (HTTP {}).", response.status().as_u16())); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Voice response interrupted.")? {
        if bytes.len() + chunk.len() > 5 * 1024 * 1024 { return Err("Voice response is too large.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| "Invalid voice service response.".into())
}
