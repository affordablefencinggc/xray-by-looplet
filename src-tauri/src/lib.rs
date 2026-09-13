//! Looplet Tauri shell for X-Ray.
//! Command contract from `xray-by-looplet/desktop/README.md` "Embedding in Looplet".

mod material_ai;
mod assistant_ai;
mod voice;
mod cad;
#[cfg(target_os = "windows")]
mod window_chrome;
use material_ai::*;

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Manager, RunEvent, State, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use xray_engine_host::{
    engine_status, run_bom, verify_source_sha256, CancellationToken, TransportError,
};

const MAX_PLAN_BYTES: u64 = 100 * 1024 * 1024;
const MAX_PLAN_BASE64_BYTES: usize = (MAX_PLAN_BYTES as usize).div_ceil(3) * 4;
const MAX_BOM_REQUEST_BYTES: usize = 1_048_576;

#[derive(Debug, Clone, PartialEq, Eq)]
struct PlanMetadata {
    name: String,
    kind: &'static str,
    mime_type: &'static str,
    size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPlanPayload {
    name: String,
    kind: String,
    mime_type: String,
    size_bytes: u64,
    bytes_base64: String,
    takeoff: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(untagged)]
enum BomTransportEnvelope {
    Success {
        ok: bool,
        #[serde(rename = "requestId")]
        request_id: String,
        response: Value,
    },
    Failure {
        ok: bool,
        #[serde(rename = "requestId")]
        request_id: Option<String>,
        error: TransportError,
    },
}

impl BomTransportEnvelope {
    fn success(request_id: String, response: Value) -> Self {
        Self::Success {
            ok: true,
            request_id,
            response,
        }
    }

    fn failure(request_id: Option<String>, error: TransportError) -> Self {
        Self::Failure {
            ok: false,
            request_id,
            error,
        }
    }
}

#[derive(Clone, Default)]
struct InvocationCancellation {
    engine: CancellationToken,
    observed: Arc<AtomicBool>,
}

impl InvocationCancellation {
    fn cancel(&self) {
        self.observed.store(true, Ordering::Release);
        self.engine.cancel();
    }

    fn is_cancelled(&self) -> bool {
        self.observed.load(Ordering::Acquire)
    }
}

trait BomRunner: Send + Sync + 'static {
    fn run(
        &self,
        request: &[u8],
        cancellation: InvocationCancellation,
    ) -> Result<Value, TransportError>;
}

struct ProductionBomRunner;

impl BomRunner for ProductionBomRunner {
    fn run(
        &self,
        request: &[u8],
        cancellation: InvocationCancellation,
    ) -> Result<Value, TransportError> {
        run_bom(request, cancellation.engine)
    }
}

struct BomInvocationState {
    runner: Arc<dyn BomRunner>,
    active: Mutex<HashMap<String, InvocationCancellation>>,
}

impl BomInvocationState {
    fn production() -> Self {
        Self {
            runner: Arc::new(ProductionBomRunner),
            active: Mutex::new(HashMap::new()),
        }
    }

    #[cfg(test)]
    fn with_runner(runner: Arc<dyn BomRunner>) -> Self {
        Self {
            runner,
            active: Mutex::new(HashMap::new()),
        }
    }

    fn cancel(&self, request_id: &str) -> bool {
        let cancellation = self
            .active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get(request_id)
            .cloned();
        if let Some(cancellation) = cancellation {
            cancellation.cancel();
            true
        } else {
            false
        }
    }

    fn cancel_all(&self) {
        let cancellations: Vec<_> = self
            .active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .values()
            .cloned()
            .collect();
        for cancellation in cancellations {
            cancellation.cancel();
        }
    }
}

fn ipc_error(
    code: xray_engine_host::TransportCode,
    stage: xray_engine_host::TransportStage,
    retryable: bool,
    safe_message: &'static str,
) -> TransportError {
    TransportError {
        code,
        stage,
        retryable,
        safe_message,
        diagnostic_id: None,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum SourceKind {
    Pdf,
    Dxf,
    Svg,
}

impl SourceKind {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "pdf" => Some(Self::Pdf),
            "dxf" => Some(Self::Dxf),
            "svg" => Some(Self::Svg),
            _ => None,
        }
    }

    fn extension(self) -> &'static str {
        match self {
            Self::Pdf => "pdf",
            Self::Dxf => "dxf",
            Self::Svg => "svg",
        }
    }
}

struct RequestBinding {
    request_id: String,
    document_sha256: String,
    document_kind: SourceKind,
}

fn request_binding(request_json: &str) -> Result<RequestBinding, TransportError> {
    let value: Value = serde_json::from_str(request_json).map_err(|_| {
        ipc_error(
            xray_engine_host::TransportCode::InvalidRequest,
            xray_engine_host::TransportStage::Parse,
            false,
            "The calculation request is invalid.",
        )
    })?;
    let id = value
        .get("requestId")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            ipc_error(
                xray_engine_host::TransportCode::InvalidRequest,
                xray_engine_host::TransportStage::Preflight,
                false,
                "The calculation request is invalid.",
            )
        })?;
    if id.is_empty()
        || id.chars().count() > 160
        || id.chars().any(|character| character.is_control())
    {
        return Err(ipc_error(
            xray_engine_host::TransportCode::InvalidRequest,
            xray_engine_host::TransportStage::Preflight,
            false,
            "The calculation request is invalid.",
        ));
    }
    let document = value.get("document").ok_or_else(invalid_request)?;
    let document_sha256 = document
        .get("sha256")
        .and_then(Value::as_str)
        .filter(|digest| {
            digest.len() == 64
                && digest
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        })
        .ok_or_else(invalid_request)?;
    let document_kind = document
        .get("kind")
        .and_then(Value::as_str)
        .and_then(SourceKind::parse)
        .ok_or_else(invalid_request)?;
    let document_name = document
        .get("name")
        .and_then(Value::as_str)
        .filter(|name| !name.is_empty() && name.chars().count() <= 300)
        .ok_or_else(invalid_request)?;
    let extension = document_name
        .rsplit_once('.')
        .map(|(_, extension)| extension.to_ascii_lowercase())
        .filter(|extension| extension == document_kind.extension())
        .ok_or_else(invalid_request)?;
    debug_assert_eq!(extension, document_kind.extension());
    Ok(RequestBinding {
        request_id: id.to_string(),
        document_sha256: document_sha256.to_string(),
        document_kind,
    })
}

fn invalid_request() -> TransportError {
    ipc_error(
        xray_engine_host::TransportCode::InvalidRequest,
        xray_engine_host::TransportStage::Preflight,
        false,
        "The calculation request is invalid.",
    )
}

fn verify_source_bytes(
    source_bytes_base64: &str,
    expected_sha256: &str,
    expected_kind: SourceKind,
) -> Result<(), TransportError> {
    if source_bytes_base64.is_empty() || source_bytes_base64.len() > MAX_PLAN_BASE64_BYTES {
        return Err(ipc_error(
            xray_engine_host::TransportCode::InvalidRequest,
            xray_engine_host::TransportStage::Preflight,
            false,
            "The source document bytes are invalid.",
        ));
    }
    let source_bytes = BASE64_STANDARD.decode(source_bytes_base64).map_err(|_| {
        ipc_error(
            xray_engine_host::TransportCode::InvalidRequest,
            xray_engine_host::TransportStage::Parse,
            false,
            "The source document bytes are invalid.",
        )
    })?;
    if source_bytes.is_empty() || source_bytes.len() as u64 > MAX_PLAN_BYTES {
        return Err(ipc_error(
            xray_engine_host::TransportCode::InvalidRequest,
            xray_engine_host::TransportStage::Preflight,
            false,
            "The source document bytes are invalid.",
        ));
    }
    match detect_source_kind(&source_bytes) {
        Some(actual_kind) if actual_kind == expected_kind => {}
        Some(_) => {
            return Err(ipc_error(
                xray_engine_host::TransportCode::SourceBindingMismatch,
                xray_engine_host::TransportStage::Bind,
                false,
                "The calculation request does not match the source document format.",
            ))
        }
        None => {
            return Err(ipc_error(
                xray_engine_host::TransportCode::InvalidRequest,
                xray_engine_host::TransportStage::Validate,
                false,
                "The source document content is invalid.",
            ))
        }
    }
    verify_source_sha256(&source_bytes, expected_sha256)?;
    Ok(())
}

fn detect_source_kind(bytes: &[u8]) -> Option<SourceKind> {
    let head = &bytes[..bytes.len().min(4096)];
    let pdf_header = head
        .windows(5)
        .position(|window| window == b"%PDF-")
        .filter(|position| *position < 1024)
        .and_then(|position| head.get(position + 5..position + 8))
        .is_some_and(|version| {
            version[0].is_ascii_digit() && version[1] == b'.' && version[2].is_ascii_digit()
        });
    let pdf_eof = bytes
        .iter()
        .rposition(|byte| !byte.is_ascii_whitespace())
        .and_then(|end| bytes.get(..=end))
        .is_some_and(|trimmed| trimmed.ends_with(b"%%EOF"));
    if pdf_header && pdf_eof {
        return Some(SourceKind::Pdf);
    }
    const BINARY_DXF_SIGNATURE: &[u8] = b"AutoCAD Binary DXF\r\n\x1a\0";
    if bytes.starts_with(BINARY_DXF_SIGNATURE) && bytes.len() >= BINARY_DXF_SIGNATURE.len() + 16 {
        return Some(SourceKind::Dxf);
    }
    if let Ok(text) = std::str::from_utf8(head) {
        let normalized = text.replace("\r\n", "\n");
        let tokens: Vec<_> = normalized.lines().map(str::trim).collect();
        let has_section = tokens
            .windows(2)
            .any(|pair| pair[0] == "0" && pair[1].eq_ignore_ascii_case("SECTION"));
        let has_endsec = tokens
            .windows(2)
            .any(|pair| pair[0] == "0" && pair[1].eq_ignore_ascii_case("ENDSEC"));
        let has_eof = tokens
            .windows(2)
            .any(|pair| pair[0] == "0" && pair[1].eq_ignore_ascii_case("EOF"));
        if has_section && has_endsec && has_eof {
            return Some(SourceKind::Dxf);
        }
    }
    std::str::from_utf8(bytes)
        .ok()
        .filter(|text| valid_svg_document(text))
        .map(|_| SourceKind::Svg)
}

fn valid_svg_document(text: &str) -> bool {
    let mut remaining = text.strip_prefix('\u{feff}').unwrap_or(text).trim_start();
    if remaining.starts_with("<?xml") {
        let Some(end) = remaining.find("?>") else {
            return false;
        };
        remaining = remaining[end + 2..].trim_start();
    }
    while remaining.starts_with("<!--") {
        let Some(end) = remaining.find("-->") else {
            return false;
        };
        remaining = remaining[end + 3..].trim_start();
    }
    let Some(after_root) = remaining.strip_prefix("<svg") else {
        return false;
    };
    if !after_root
        .chars()
        .next()
        .is_some_and(|character| character.is_ascii_whitespace() || matches!(character, '>' | '/'))
    {
        return false;
    }
    let Some(open_end) = after_root.find('>') else {
        return false;
    };
    let opening = &after_root[..open_end];
    opening.trim_end().ends_with('/') || remaining.contains("</svg>")
}

async fn run_bom_ipc(
    state: &BomInvocationState,
    request_json: String,
    source_bytes_base64: String,
) -> BomTransportEnvelope {
    if request_json.len() > MAX_BOM_REQUEST_BYTES {
        return BomTransportEnvelope::failure(
            None,
            ipc_error(
                xray_engine_host::TransportCode::InvalidRequest,
                xray_engine_host::TransportStage::Preflight,
                false,
                "The calculation request is too large.",
            ),
        );
    }
    let parsed = tauri::async_runtime::spawn_blocking(move || {
        let binding = request_binding(&request_json);
        (request_json, binding)
    })
    .await;
    let (request_json, binding) = match parsed {
        Ok(parsed) => parsed,
        Err(_) => {
            return BomTransportEnvelope::failure(
                None,
                ipc_error(
                    xray_engine_host::TransportCode::InvalidRequest,
                    xray_engine_host::TransportStage::Parse,
                    true,
                    "The calculation request could not be inspected.",
                ),
            )
        }
    };
    let binding = match binding {
        Ok(binding) => binding,
        Err(error) => return BomTransportEnvelope::failure(None, error),
    };
    let request_id = binding.request_id;
    let document_sha256 = binding.document_sha256;
    let document_kind = binding.document_kind;
    let cancellation = InvocationCancellation::default();
    {
        let mut active = state
            .active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if active.contains_key(&request_id) {
            return BomTransportEnvelope::failure(
                Some(request_id),
                ipc_error(
                    xray_engine_host::TransportCode::InvalidRequest,
                    xray_engine_host::TransportStage::Preflight,
                    false,
                    "A calculation with this request identifier is already running.",
                ),
            );
        }
        active.insert(request_id.clone(), cancellation.clone());
    }

    let runner = Arc::clone(&state.runner);
    let bytes = request_json.into_bytes();
    let outcome = tauri::async_runtime::spawn_blocking(move || {
        verify_source_bytes(&source_bytes_base64, &document_sha256, document_kind)?;
        if cancellation.is_cancelled() {
            return Err(ipc_error(
                xray_engine_host::TransportCode::Cancelled,
                xray_engine_host::TransportStage::Execute,
                true,
                "The calculation was cancelled.",
            ));
        }
        runner.run(&bytes, cancellation)
    })
    .await;
    state
        .active
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .remove(&request_id);

    match outcome {
        Ok(Ok(Value::Null)) => BomTransportEnvelope::failure(
            Some(request_id),
            ipc_error(
                xray_engine_host::TransportCode::MissingResult,
                xray_engine_host::TransportStage::Read,
                false,
                "The local calculation engine returned no result.",
            ),
        ),
        Ok(Ok(response)) => BomTransportEnvelope::success(request_id, response),
        Ok(Err(error)) => BomTransportEnvelope::failure(Some(request_id), error),
        Err(_) => BomTransportEnvelope::failure(
            Some(request_id),
            ipc_error(
                xray_engine_host::TransportCode::SpawnFailed,
                xray_engine_host::TransportStage::Cleanup,
                true,
                "The local calculation engine task stopped unexpectedly.",
            ),
        ),
    }
}

#[tauri::command]
async fn xray_run_bom(
    state: State<'_, BomInvocationState>,
    request_json: String,
    source_bytes_base64: String,
) -> Result<BomTransportEnvelope, ()> {
    // Every expected transport failure is represented inside the serialized
    // envelope; Tauri's outer Result exists only to satisfy its async command
    // lifetime contract and is never used for domain or engine failures.
    Ok(run_bom_ipc(&state, request_json, source_bytes_base64).await)
}

#[tauri::command]
fn xray_cancel_bom(state: State<'_, BomInvocationState>, request_id: String) -> bool {
    if request_id.is_empty()
        || request_id.chars().count() > 160
        || request_id.chars().any(|character| character.is_control())
    {
        return false;
    }
    state.cancel(&request_id)
}

#[tauri::command]
async fn xray_bom_status() -> Value {
    // Frozen engine startup may include runtime extraction. Keep the bounded
    // handshake off the UI thread and report failed workers as unavailable.
    let status = tauri::async_runtime::spawn_blocking(engine_status)
        .await
        .unwrap_or_else(|_| serde_json::json!({"available": false}));
    bom_status_envelope(&status)
}

fn bom_status_envelope(status: &Value) -> Value {
    let available = status.get("available").and_then(Value::as_bool) == Some(true);
    serde_json::json!({
        "available": available,
        "host": "tauri",
        "requestSchemas": if available { vec![xray_engine_host::REQUEST_SCHEMA] } else { Vec::<&str>::new() },
        "responseSchemas": if available { vec![xray_engine_host::RESPONSE_SCHEMA] } else { Vec::<&str>::new() },
        "rulesets": if available { vec![serde_json::json!({"id": xray_engine_host::RULESET_ID, "version": xray_engine_host::RULESET_VERSION})] } else { Vec::<Value>::new() },
    })
}

fn plan_kind(path: &Path) -> Result<(&'static str, &'static str), String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "Plan must have a PDF, DXF, or SVG extension.".to_string())?;
    match extension.as_str() {
        "pdf" => Ok(("pdf", "application/pdf")),
        "dxf" => Ok(("dxf", "application/dxf")),
        "svg" => Ok(("svg", "image/svg+xml")),
        _ => Err("Unsupported plan type. Choose a PDF, DXF, or SVG file.".to_string()),
    }
}

fn read_validated_plan(path: &Path) -> Result<(PlanMetadata, Vec<u8>), String> {
    let file_type = std::fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect the selected plan: {error}"))?
        .file_type();
    if !file_type.is_file() {
        return Err("The selected plan is not a regular file.".to_string());
    }

    let (kind, mime_type) = plan_kind(path)?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "The selected plan has no valid file name.".to_string())?
        .to_string();

    let file =
        File::open(path).map_err(|error| format!("Could not open the selected plan: {error}"))?;
    let declared_size = file
        .metadata()
        .map_err(|error| format!("Could not inspect the selected plan: {error}"))?
        .len();
    if declared_size == 0 {
        return Err("The selected plan is empty.".to_string());
    }
    if declared_size > MAX_PLAN_BYTES {
        return Err("The selected plan exceeds the 100 MB limit.".to_string());
    }

    // The file can change after metadata is read. Bound the actual read to one
    // byte beyond the limit so a growing file can never allocate without cap.
    let mut bytes = Vec::with_capacity(declared_size as usize);
    file.take(MAX_PLAN_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read the selected plan: {error}"))?;
    if bytes.is_empty() {
        return Err("The selected plan is empty.".to_string());
    }
    if bytes.len() as u64 > MAX_PLAN_BYTES {
        return Err("The selected plan exceeds the 100 MB limit.".to_string());
    }

    Ok((
        PlanMetadata {
            name,
            kind,
            mime_type,
            size_bytes: bytes.len() as u64,
        },
        bytes,
    ))
}

fn desktop_plan_payload(
    metadata: PlanMetadata,
    bytes: Vec<u8>,
    takeoff: Option<serde_json::Value>,
) -> DesktopPlanPayload {
    DesktopPlanPayload {
        name: metadata.name,
        kind: metadata.kind.to_string(),
        mime_type: metadata.mime_type.to_string(),
        size_bytes: metadata.size_bytes,
        bytes_base64: BASE64_STANDARD.encode(bytes),
        takeoff,
    }
}

fn import_plan_at_path(path: &Path) -> Result<DesktopPlanPayload, String> {
    let (metadata, bytes) = read_validated_plan(path)?;
    // Import returns inspected source bytes only. BOM execution is a separate,
    // explicit command and cannot be hidden behind file selection.
    Ok(desktop_plan_payload(metadata, bytes, None))
}

#[tauri::command]
fn xray_import_plan(app: AppHandle) -> Result<Option<DesktopPlanPayload>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Plans (PDF / DXF / SVG)", &["pdf", "dxf", "svg"])
        .blocking_pick_file();
    let Some(picked) = picked else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|_| "The selected plan is not a readable local file.".to_string())?;

    Ok(Some(import_plan_at_path(&path)?))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BomInvocationState::production())
        .manage(MaterialAiState::default())
        .manage(assistant_ai::AssistantAiState::default())
        .manage(cad::CadState::default())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                window_chrome::apply(&window.as_ref().window());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(target_os = "windows")]
            if matches!(event, WindowEvent::ThemeChanged(_) | WindowEvent::Focused(_)) {
                window_chrome::apply(window);
            }
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                window.state::<BomInvocationState>().cancel_all();
                window.state::<cad::CadState>().cancel_all();
                window.state::<assistant_ai::AssistantAiState>().cancel_all();
            }
        })
        .invoke_handler(tauri::generate_handler![
            cad::xray_cad_status,
            cad::xray_cad_convert,
            cad::xray_cad_cancel,
            voice::xray_voice_status,
            voice::xray_voice_request,
            xray_material_ai_status,
            assistant_ai::xray_assistant_status,
            assistant_ai::xray_assistant_turn,
            assistant_ai::xray_cancel_assistant,
            xray_configure_material_ai,
            xray_interpret_material_ai,
            xray_propose_architect_ai,
            xray_cancel_material_ai,
            xray_bom_status,
            xray_run_bom,
            xray_cancel_bom,
            xray_import_plan
        ])
        .build(tauri::generate_context!())
        .expect("error while building X-Ray")
        .run(|app, event| {
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                app.state::<BomInvocationState>().cancel_all();
                app.state::<cad::CadState>().cancel_all();
                app.state::<assistant_ai::AssistantAiState>().cancel_all();
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};
    use std::fs::{create_dir_all, remove_dir_all, write, OpenOptions};
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicUsize, Ordering as AtomicOrdering};
    use std::thread;
    use std::time::Duration;
    use std::time::{SystemTime, UNIX_EPOCH};

    const SOURCE_BYTES: &[u8] = b"<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";

    fn source_base64() -> String {
        BASE64_STANDARD.encode(SOURCE_BYTES)
    }

    fn bom_request(request_id: &str) -> String {
        request_for_source(request_id, "svg", "plan.svg", SOURCE_BYTES)
    }

    fn request_for_source(request_id: &str, kind: &str, name: &str, bytes: &[u8]) -> String {
        let sha256 = format!("{:x}", Sha256::digest(bytes));
        serde_json::json!({
            "requestId": request_id,
            "document": {"sha256": sha256, "kind": kind, "name": name},
            "job": {"id": "job-boundary", "revision": 7},
            "recipeSet": {"id": "recipes-boundary", "revision": 3, "digest": "a".repeat(64)},
            "ruleset": {"id": "fencing-v1", "version": 1}
        })
        .to_string()
    }

    struct StaticRunner {
        calls: AtomicUsize,
        response: Value,
    }

    impl BomRunner for StaticRunner {
        fn run(
            &self,
            _request: &[u8],
            _cancellation: InvocationCancellation,
        ) -> Result<Value, TransportError> {
            self.calls.fetch_add(1, AtomicOrdering::SeqCst);
            Ok(self.response.clone())
        }
    }

    struct CoordinatedRunner {
        release: Arc<AtomicBool>,
    }

    impl BomRunner for CoordinatedRunner {
        fn run(
            &self,
            request: &[u8],
            cancellation: InvocationCancellation,
        ) -> Result<Value, TransportError> {
            let request: Value = serde_json::from_slice(request).expect("test request JSON");
            while !self.release.load(Ordering::Acquire) && !cancellation.is_cancelled() {
                thread::sleep(Duration::from_millis(2));
            }
            if cancellation.is_cancelled() {
                return Err(ipc_error(
                    xray_engine_host::TransportCode::Cancelled,
                    xray_engine_host::TransportStage::Execute,
                    true,
                    "The calculation was cancelled.",
                ));
            }
            Ok(serde_json::json!({"requestId": request["requestId"]}))
        }
    }

    struct TypedErrorRunner {
        error: TransportError,
    }

    impl BomRunner for TypedErrorRunner {
        fn run(
            &self,
            _request: &[u8],
            _cancellation: InvocationCancellation,
        ) -> Result<Value, TransportError> {
            Err(self.error.clone())
        }
    }

    struct PanicRunner;

    impl BomRunner for PanicRunner {
        fn run(
            &self,
            _request: &[u8],
            _cancellation: InvocationCancellation,
        ) -> Result<Value, TransportError> {
            panic!("deliberate hermetic runner panic")
        }
    }

    #[derive(Default)]
    struct EchoRunner {
        request: Mutex<Option<Vec<u8>>>,
    }

    impl BomRunner for EchoRunner {
        fn run(
            &self,
            request: &[u8],
            _cancellation: InvocationCancellation,
        ) -> Result<Value, TransportError> {
            *self.request.lock().unwrap() = Some(request.to_vec());
            let request: Value = serde_json::from_slice(request).unwrap();
            Ok(serde_json::json!({
                "requestId": request["requestId"],
                "documentSha256": request["document"]["sha256"]
            }))
        }
    }

    fn test_dir(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let path = std::env::temp_dir().join(format!(
            "xray-import-{label}-{}-{nonce}",
            std::process::id()
        ));
        create_dir_all(&path).expect("create test directory");
        path
    }

    #[test]
    fn reads_supported_plan_and_builds_payload() {
        let root = test_dir("supported");
        let path = root.join("BOUNDARY.SVG");
        let contents = b"<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";
        write(&path, contents).expect("write fixture");

        let (metadata, bytes) = read_validated_plan(&path).expect("valid plan");
        assert_eq!(metadata.name, "BOUNDARY.SVG");
        assert_eq!(metadata.kind, "svg");
        assert_eq!(metadata.mime_type, "image/svg+xml");
        assert_eq!(metadata.size_bytes, contents.len() as u64);

        let payload = desktop_plan_payload(metadata, bytes, None);
        assert_eq!(payload.size_bytes, contents.len() as u64);
        assert_eq!(payload.bytes_base64, BASE64_STANDARD.encode(contents));
        assert!(payload.takeoff.is_none());
        remove_dir_all(root).expect("remove test directory");
    }

    #[test]
    fn transport_br_023_import_then_changed_file_is_rejected_before_bom_runner() {
        let root = test_dir("changed-after-pick");
        let path = root.join("selected.svg");
        write(&path, SOURCE_BYTES).expect("write selected source");

        let imported = import_plan_at_path(&path).expect("import exact selected bytes");
        assert_eq!(imported.bytes_base64, source_base64());
        assert!(imported.takeoff.is_none());

        let changed = b"<svg xmlns=\"http://www.w3.org/2000/svg\"><path/></svg>";
        write(&path, changed).expect("mutate file after selection");
        let changed_payload = import_plan_at_path(&path).expect("read changed source");
        assert_ne!(changed_payload.bytes_base64, imported.bytes_base64);

        let runner = Arc::new(StaticRunner {
            calls: AtomicUsize::new(0),
            response: serde_json::json!({"schema":"xray.bom/v1","ok":true}),
        });
        let state = BomInvocationState::with_runner(runner.clone());
        let result = tauri::async_runtime::block_on(run_bom_ipc(
            &state,
            request_for_source("changed-after-pick", "svg", "selected.svg", SOURCE_BYTES),
            changed_payload.bytes_base64,
        ));
        let encoded = serde_json::to_value(result).expect("serialize changed-source failure");
        assert_eq!(encoded["ok"], false);
        assert_eq!(encoded["requestId"], "changed-after-pick");
        assert_eq!(encoded["error"]["code"], "source-binding-mismatch");
        assert_eq!(encoded["error"]["stage"], "bind");
        assert_eq!(runner.calls.load(AtomicOrdering::SeqCst), 0);
        assert!(state.active.lock().unwrap().is_empty());
        remove_dir_all(root).expect("remove test directory");
    }

    #[test]
    fn transport_br_024_import_and_bom_are_separate_commands_and_null_fails_closed() {
        let root = test_dir("separate-command");
        let path = root.join("selected.svg");
        write(&path, SOURCE_BYTES).expect("write selected source");
        let runner = Arc::new(StaticRunner {
            calls: AtomicUsize::new(0),
            response: Value::Null,
        });
        let state = BomInvocationState::with_runner(runner.clone());

        let imported = import_plan_at_path(&path).expect("import source without engine run");
        assert!(imported.takeoff.is_none());
        assert_eq!(runner.calls.load(AtomicOrdering::SeqCst), 0);

        let result = tauri::async_runtime::block_on(run_bom_ipc(
            &state,
            bom_request("null-result"),
            imported.bytes_base64,
        ));
        let encoded = serde_json::to_value(result).expect("serialize missing result");
        assert_eq!(runner.calls.load(AtomicOrdering::SeqCst), 1);
        assert_eq!(encoded["ok"], false);
        assert_eq!(encoded["requestId"], "null-result");
        assert_eq!(encoded["error"]["code"], "missing-result");
        assert_eq!(encoded["error"]["stage"], "read");
        assert!(encoded.get("response").is_none());
        assert!(state.active.lock().unwrap().is_empty());
        remove_dir_all(root).expect("remove test directory");
    }

    #[test]
    fn rejects_unsupported_extension() {
        let root = test_dir("unsupported");
        let path = root.join("notes.txt");
        write(&path, b"not a plan").expect("write fixture");
        let error = read_validated_plan(&path).expect_err("unsupported type must fail");
        assert!(error.contains("Unsupported plan type"));
        remove_dir_all(root).expect("remove test directory");
    }

    #[test]
    fn rejects_empty_file() {
        let root = test_dir("empty");
        let path = root.join("empty.pdf");
        write(&path, []).expect("write fixture");
        let error = read_validated_plan(&path).expect_err("empty plan must fail");
        assert!(error.contains("empty"));
        remove_dir_all(root).expect("remove test directory");
    }

    #[test]
    fn rejects_file_over_limit_without_reading_it() {
        let root = test_dir("oversize");
        let path = root.join("oversize.dxf");
        let file = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&path)
            .expect("create fixture");
        file.set_len(MAX_PLAN_BYTES + 1).expect("extend fixture");
        let error = read_validated_plan(&path).expect_err("oversize plan must fail");
        assert!(error.contains("100 MB"));
        remove_dir_all(root).expect("remove test directory");
    }

    #[test]
    fn rejects_directory_even_when_its_name_has_a_plan_extension() {
        let root = test_dir("directory");
        let path = root.join("folder.pdf");
        create_dir_all(&path).expect("create directory fixture");
        let error = read_validated_plan(&path).expect_err("directory must fail");
        assert!(error.contains("regular file"));
        remove_dir_all(root).expect("remove test directory");
    }

    #[test]
    fn transport_br_007_bom_ipc_preserves_exact_request_bytes_and_source_binding() {
        let runner = Arc::new(EchoRunner::default());
        let state = BomInvocationState::with_runner(runner.clone());
        let request = bom_request("binding-round-trip");
        let result =
            tauri::async_runtime::block_on(run_bom_ipc(&state, request.clone(), source_base64()));
        assert_eq!(
            runner.request.lock().unwrap().as_deref(),
            Some(request.as_bytes())
        );
        let encoded = serde_json::to_value(result).unwrap();
        assert_eq!(encoded["ok"], true);
        assert_eq!(encoded["requestId"], "binding-round-trip");
        assert_eq!(
            encoded["response"]["documentSha256"],
            format!("{:x}", Sha256::digest(SOURCE_BYTES))
        );
        let captured: Value =
            serde_json::from_slice(runner.request.lock().unwrap().as_ref().unwrap()).unwrap();
        assert_eq!(captured["job"]["revision"], 7);
        assert_eq!(captured["recipeSet"]["revision"], 3);
        assert_eq!(captured["ruleset"]["version"], 1);
        assert!(state.active.lock().unwrap().is_empty());
    }

    #[test]
    fn bom_ipc_success_has_the_exact_outer_transport_envelope() {
        let runner = Arc::new(StaticRunner {
            calls: AtomicUsize::new(0),
            response: serde_json::json!({"schema":"xray.bom/v1","ok":true}),
        });
        let state = BomInvocationState::with_runner(runner.clone());
        let result = tauri::async_runtime::block_on(run_bom_ipc(
            &state,
            bom_request("request-1"),
            source_base64(),
        ));
        assert_eq!(runner.calls.load(AtomicOrdering::SeqCst), 1);
        assert_eq!(
            serde_json::to_value(result).expect("serialize envelope"),
            serde_json::json!({
                "ok": true,
                "requestId": "request-1",
                "response": {"schema":"xray.bom/v1","ok":true}
            })
        );
        assert!(state.active.lock().unwrap().is_empty());
    }

    #[test]
    fn bom_ipc_rejects_untrusted_registry_keys_without_calling_runner() {
        let runner = Arc::new(StaticRunner {
            calls: AtomicUsize::new(0),
            response: Value::Null,
        });
        let state = BomInvocationState::with_runner(runner.clone());
        for request in [
            r#"{}"#.to_string(),
            r#"{"requestId":"bad\nkey"}"#.to_string(),
            format!(r#"{{"requestId":"{}"}}"#, "x".repeat(161)),
        ] {
            let result =
                tauri::async_runtime::block_on(run_bom_ipc(&state, request, source_base64()));
            let encoded = serde_json::to_value(result).expect("serialize failure");
            assert_eq!(encoded["ok"], false);
            assert_eq!(encoded["requestId"], Value::Null);
            assert_eq!(encoded["error"]["code"], "invalid-request");
        }
        assert_eq!(runner.calls.load(AtomicOrdering::SeqCst), 0);
        assert!(state.active.lock().unwrap().is_empty());
    }

    #[test]
    fn transport_br_012_031_bom_ipc_cancellation_is_keyed_and_concurrent_requests_are_isolated() {
        let release = Arc::new(AtomicBool::new(false));
        let state = Arc::new(BomInvocationState::with_runner(Arc::new(
            CoordinatedRunner {
                release: release.clone(),
            },
        )));
        let slow_state = state.clone();
        let slow = thread::spawn(move || {
            tauri::async_runtime::block_on(run_bom_ipc(
                &slow_state,
                bom_request("slow"),
                source_base64(),
            ))
        });
        let fast_state = state.clone();
        let fast = thread::spawn(move || {
            tauri::async_runtime::block_on(run_bom_ipc(
                &fast_state,
                bom_request("fast"),
                source_base64(),
            ))
        });

        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        while state.active.lock().unwrap().len() != 2 {
            assert!(std::time::Instant::now() < deadline, "requests registered");
            thread::sleep(Duration::from_millis(2));
        }
        assert!(state.cancel("slow"));
        assert!(!state.cancel("missing"));
        release.store(true, Ordering::Release);

        let slow = serde_json::to_value(slow.join().expect("slow task")).unwrap();
        let fast = serde_json::to_value(fast.join().expect("fast task")).unwrap();
        assert_eq!(slow["ok"], false);
        assert_eq!(slow["requestId"], "slow");
        assert_eq!(slow["error"]["code"], "cancelled");
        assert_eq!(fast["ok"], true);
        assert_eq!(fast["requestId"], "fast");
        assert!(state.active.lock().unwrap().is_empty());
    }

    #[test]
    fn transport_br_019_bom_ipc_cancel_all_covers_window_close_and_app_shutdown_hook() {
        let state = BomInvocationState::with_runner(Arc::new(StaticRunner {
            calls: AtomicUsize::new(0),
            response: Value::Null,
        }));
        let first = InvocationCancellation::default();
        let second = InvocationCancellation::default();
        state
            .active
            .lock()
            .unwrap()
            .insert("one".into(), first.clone());
        state
            .active
            .lock()
            .unwrap()
            .insert("two".into(), second.clone());
        state.cancel_all();
        assert!(first.is_cancelled());
        assert!(second.is_cancelled());
    }

    #[test]
    fn transport_br_019_panicked_worker_is_typed_and_removed_from_active_registry() {
        let state = BomInvocationState::with_runner(Arc::new(PanicRunner));
        let result = tauri::async_runtime::block_on(run_bom_ipc(
            &state,
            bom_request("panicked-worker"),
            source_base64(),
        ));
        let encoded = serde_json::to_value(result).unwrap();
        assert_eq!(encoded["ok"], false);
        assert_eq!(encoded["requestId"], "panicked-worker");
        assert_eq!(encoded["error"]["code"], "spawn-failed");
        assert_eq!(encoded["error"]["stage"], "cleanup");
        assert!(state.active.lock().unwrap().is_empty());
    }

    #[test]
    fn transport_br_020_bom_ipc_errors_are_typed_redacted_and_schema_safe() {
        let envelope = BomTransportEnvelope::failure(
            Some("request-safe".into()),
            ipc_error(
                xray_engine_host::TransportCode::EngineUnavailable,
                xray_engine_host::TransportStage::Preflight,
                true,
                "The local calculation engine is unavailable.",
            ),
        );
        let encoded = serde_json::to_value(envelope).expect("serialize failure");
        assert_eq!(encoded["error"]["code"], "engine-unavailable");
        assert_eq!(encoded["error"]["stage"], "preflight");
        assert_eq!(encoded["error"]["retryable"], true);
        assert_eq!(encoded["error"]["diagnosticId"], Value::Null);
        let text = encoded.to_string().to_ascii_lowercase();
        assert!(!text.contains("c:\\"));
        assert!(!text.contains("/users/"));
        assert!(!text.contains("token="));
    }

    #[test]
    fn transport_br_005_011_015_typed_host_failures_survive_ipc_without_domain_collapse() {
        for (request_id, code, stage, retryable, expected_code, expected_stage) in [
            (
                "wrong-response-id",
                xray_engine_host::TransportCode::RequestIdMismatch,
                xray_engine_host::TransportStage::Bind,
                false,
                "request-id-mismatch",
                "bind",
            ),
            (
                "timed-out",
                xray_engine_host::TransportCode::Timeout,
                xray_engine_host::TransportStage::Execute,
                true,
                "timeout",
                "execute",
            ),
        ] {
            let runner = Arc::new(TypedErrorRunner {
                error: ipc_error(code, stage, retryable, "The calculation failed safely."),
            });
            let state = BomInvocationState::with_runner(runner);
            let result = tauri::async_runtime::block_on(run_bom_ipc(
                &state,
                bom_request(request_id),
                source_base64(),
            ));
            let encoded = serde_json::to_value(result).unwrap();
            assert_eq!(encoded["ok"], false);
            assert_eq!(encoded["requestId"], request_id);
            assert_eq!(encoded["error"]["code"], expected_code);
            assert_eq!(encoded["error"]["stage"], expected_stage);
            assert_eq!(encoded["error"]["retryable"], retryable);
            assert!(encoded.get("response").is_none());
            assert!(state.active.lock().unwrap().is_empty());
        }
    }

    #[test]
    fn transport_br_024_032_kernel_domain_response_remains_distinct_from_transport_error() {
        let domain = serde_json::json!({
            "schema": "xray.bom/v1",
            "ok": false,
            "requestId": "domain-failure",
            "inputDigest": null,
            "issues": [{"code": "review", "message": "Review required."}]
        });
        let state = BomInvocationState::with_runner(Arc::new(StaticRunner {
            calls: AtomicUsize::new(0),
            response: domain.clone(),
        }));
        let result = tauri::async_runtime::block_on(run_bom_ipc(
            &state,
            bom_request("domain-failure"),
            source_base64(),
        ));
        let encoded = serde_json::to_value(result).unwrap();
        assert_eq!(encoded["ok"], true, "transport itself succeeded");
        assert_eq!(encoded["response"], domain);
        assert!(encoded.get("error").is_none());
    }

    #[test]
    fn transport_br_014_async_command_keeps_runtime_heartbeat_live_while_runner_is_pending() {
        let release = Arc::new(AtomicBool::new(false));
        let state = Arc::new(BomInvocationState::with_runner(Arc::new(
            CoordinatedRunner {
                release: release.clone(),
            },
        )));
        tauri::async_runtime::block_on(async {
            let run_state = state.clone();
            let run = tauri::async_runtime::spawn(async move {
                run_bom_ipc(
                    &run_state,
                    bom_request("heartbeat-pending"),
                    source_base64(),
                )
                .await
            });
            let deadline = std::time::Instant::now() + Duration::from_secs(2);
            while !state
                .active
                .lock()
                .unwrap()
                .contains_key("heartbeat-pending")
            {
                assert!(std::time::Instant::now() < deadline, "request registered");
                thread::sleep(Duration::from_millis(2));
            }

            let (heartbeat_tx, heartbeat_rx) = std::sync::mpsc::channel();
            tauri::async_runtime::spawn(async move {
                heartbeat_tx.send("advanced").unwrap();
            });
            assert_eq!(
                heartbeat_rx
                    .recv_timeout(Duration::from_millis(250))
                    .unwrap(),
                "advanced"
            );
            assert!(
                state
                    .active
                    .lock()
                    .unwrap()
                    .contains_key("heartbeat-pending"),
                "runner remains pending during heartbeat"
            );
            release.store(true, Ordering::Release);
            let encoded = serde_json::to_value(run.await.unwrap()).unwrap();
            assert_eq!(encoded["ok"], true);
        });
        assert!(state.active.lock().unwrap().is_empty());
    }

    #[test]
    fn transport_br_023_bom_ipc_rehashes_source_bytes_and_rejects_mismatch_before_runner() {
        let runner = Arc::new(StaticRunner {
            calls: AtomicUsize::new(0),
            response: Value::Null,
        });
        let state = BomInvocationState::with_runner(runner.clone());
        let result = tauri::async_runtime::block_on(run_bom_ipc(
            &state,
            bom_request("source-mismatch"),
            BASE64_STANDARD.encode(b"<svg viewBox=\"0 0 1 1\"></svg>"),
        ));
        let encoded = serde_json::to_value(result).expect("serialize mismatch");
        assert_eq!(encoded["ok"], false);
        assert_eq!(encoded["requestId"], "source-mismatch");
        assert_eq!(encoded["error"]["code"], "source-binding-mismatch");
        assert_eq!(encoded["error"]["stage"], "bind");
        assert_eq!(runner.calls.load(AtomicOrdering::SeqCst), 0);
        assert!(state.active.lock().unwrap().is_empty());
    }

    #[test]
    fn bom_ipc_rejects_malformed_or_empty_source_bytes_before_runner() {
        let runner = Arc::new(StaticRunner {
            calls: AtomicUsize::new(0),
            response: Value::Null,
        });
        let state = BomInvocationState::with_runner(runner.clone());
        for (request_id, source) in [("malformed-source", "***"), ("empty-source", "")] {
            let result = tauri::async_runtime::block_on(run_bom_ipc(
                &state,
                bom_request(request_id),
                source.to_string(),
            ));
            let encoded = serde_json::to_value(result).expect("serialize invalid source");
            assert_eq!(encoded["ok"], false);
            assert_eq!(encoded["requestId"], request_id);
            assert_eq!(encoded["error"]["code"], "invalid-request");
        }
        assert_eq!(runner.calls.load(AtomicOrdering::SeqCst), 0);
        assert!(state.active.lock().unwrap().is_empty());
    }

    #[test]
    fn transport_br_022_bom_ipc_rejects_bad_pdf_dxf_and_svg_content_before_runner() {
        let runner = Arc::new(StaticRunner {
            calls: AtomicUsize::new(0),
            response: Value::Null,
        });
        let state = BomInvocationState::with_runner(runner.clone());
        for (request_id, kind, name, bytes) in [
            (
                "bad-pdf",
                "pdf",
                "plan.pdf",
                b"%PDF-1.7\nno end marker".as_slice(),
            ),
            (
                "bad-dxf",
                "dxf",
                "plan.dxf",
                b"0\nSECTION\n2\nHEADER\n".as_slice(),
            ),
            ("bad-svg", "svg", "plan.svg", b"<html></html>".as_slice()),
        ] {
            let result = tauri::async_runtime::block_on(run_bom_ipc(
                &state,
                request_for_source(request_id, kind, name, bytes),
                BASE64_STANDARD.encode(bytes),
            ));
            let encoded = serde_json::to_value(result).expect("serialize invalid content");
            assert_eq!(encoded["ok"], false, "{request_id}");
            assert_eq!(encoded["requestId"], request_id, "{request_id}");
            assert_eq!(encoded["error"]["code"], "invalid-request", "{request_id}");
            assert_eq!(encoded["error"]["stage"], "validate", "{request_id}");
        }
        assert_eq!(runner.calls.load(AtomicOrdering::SeqCst), 0);
        assert!(state.active.lock().unwrap().is_empty());
    }

    #[test]
    fn source_format_detector_accepts_bounded_complete_signatures() {
        assert_eq!(
            detect_source_kind(b"prefix\n%PDF-1.7\nbody\n%%EOF\n"),
            Some(SourceKind::Pdf)
        );
        assert_eq!(
            detect_source_kind(b"0\r\nSECTION\r\n2\r\nHEADER\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n"),
            Some(SourceKind::Dxf)
        );
        assert_eq!(
            detect_source_kind(b"\xef\xbb\xbf<?xml version=\"1.0\"?><!--plan--><svg></svg>"),
            Some(SourceKind::Svg)
        );
        assert_eq!(
            detect_source_kind(b"AutoCAD Binary DXF\r\n\x1a\0"),
            None,
            "a bare binary signature has no content"
        );
    }

    #[test]
    fn bom_ipc_rejects_content_kind_and_filename_kind_mismatch_before_runner() {
        let runner = Arc::new(StaticRunner {
            calls: AtomicUsize::new(0),
            response: Value::Null,
        });
        let state = BomInvocationState::with_runner(runner.clone());
        let pdf = b"%PDF-1.7\n%%EOF";
        let content_mismatch = tauri::async_runtime::block_on(run_bom_ipc(
            &state,
            request_for_source("kind-mismatch", "svg", "plan.svg", pdf),
            BASE64_STANDARD.encode(pdf),
        ));
        let encoded = serde_json::to_value(content_mismatch).unwrap();
        assert_eq!(encoded["error"]["code"], "source-binding-mismatch");
        assert_eq!(encoded["error"]["stage"], "bind");

        let name_mismatch = tauri::async_runtime::block_on(run_bom_ipc(
            &state,
            request_for_source("name-mismatch", "svg", "plan.pdf", SOURCE_BYTES),
            source_base64(),
        ));
        let encoded = serde_json::to_value(name_mismatch).unwrap();
        assert_eq!(encoded["ok"], false);
        assert_eq!(encoded["requestId"], Value::Null);
        assert_eq!(encoded["error"]["code"], "invalid-request");
        assert_eq!(runner.calls.load(AtomicOrdering::SeqCst), 0);
        assert!(state.active.lock().unwrap().is_empty());
    }

    #[test]
    fn bom_ipc_enforces_frozen_request_and_source_bounds_before_runner() {
        assert_eq!(MAX_BOM_REQUEST_BYTES, 1_048_576);
        assert_eq!(MAX_PLAN_BASE64_BYTES, 139_810_136);
        let runner = Arc::new(StaticRunner {
            calls: AtomicUsize::new(0),
            response: Value::Null,
        });
        let state = BomInvocationState::with_runner(runner.clone());
        let result = tauri::async_runtime::block_on(run_bom_ipc(
            &state,
            "x".repeat(MAX_BOM_REQUEST_BYTES + 1),
            source_base64(),
        ));
        let encoded = serde_json::to_value(result).expect("serialize oversize request");
        assert_eq!(encoded["ok"], false);
        assert_eq!(encoded["requestId"], Value::Null);
        assert_eq!(encoded["error"]["code"], "invalid-request");
        assert_eq!(runner.calls.load(AtomicOrdering::SeqCst), 0);
    }

    #[test]
    fn transport_br_021_bom_status_is_truthful_without_probing_production() {
        let unavailable = bom_status_envelope(&serde_json::json!({"available": false}));
        assert_eq!(
            unavailable,
            serde_json::json!({
                "available": false,
                "host": "tauri",
                "requestSchemas": [],
                "responseSchemas": [],
                "rulesets": []
            })
        );
        let available = bom_status_envelope(&serde_json::json!({"available": true}));
        assert_eq!(
            available,
            serde_json::json!({
                "available": true,
                "host": "tauri",
                "requestSchemas": ["xray.job-to-bom/v1"],
                "responseSchemas": ["xray.bom/v1"],
                "rulesets": [{"id":"fencing-v1","version":1}]
            })
        );
    }
}
