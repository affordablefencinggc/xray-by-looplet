use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, State};

const LIMIT: usize = 12_000_000;
const RESPONSE_LIMIT: usize = 17_000_000;
#[derive(Default)]
pub struct CadState(Mutex<Option<(String, Arc<AtomicBool>)>>);
impl CadState {
    pub fn cancel_all(&self) {
        if let Ok(guard) = self.0.lock() {
            if let Some((_, token)) = guard.as_ref() {
                token.store(true, Ordering::SeqCst);
            }
        }
    }
}
fn executable(app: &AppHandle) -> Result<PathBuf, String> {
    if !cfg!(target_os = "windows") {
        return Err("DWG conversion is available in the Windows desktop app.".into());
    }
    let packaged = app
        .path()
        .resource_dir()
        .map_err(|_| "CAD resources unavailable.")?
        .join("engine/cad/XRayCad.exe");
    if packaged.is_file() {
        return Ok(packaged);
    }
    #[cfg(debug_assertions)]
    {
        let development =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../engine/cad/bin/XRayCad.exe");
        if development.is_file() {
            return Ok(development);
        }
    }
    Err("The local DWG translator is missing. Reinstall the current desktop build.".into())
}
#[tauri::command]
pub fn xray_cad_status(app: AppHandle) -> Value {
    let result = executable(&app);
    json!({"available":result.is_ok(), "translator":"ACadSharp 3.7.1", "reason":result.err()})
}
fn decode_request(action: &str, source: &str) -> Result<Vec<u8>, String> {
    if action != "to-dwg" && action != "to-dxf" {
        return Err("Invalid CAD conversion direction.".into());
    }
    if source.len() > LIMIT.div_ceil(3) * 4 {
        return Err("CAD file exceeds 12 MB.".into());
    }
    let bytes = STANDARD
        .decode(source)
        .map_err(|_| "Invalid CAD file encoding.")?;
    if bytes.len() < 6 || bytes.len() > LIMIT {
        return Err("CAD file is empty, incomplete or exceeds 12 MB.".into());
    }
    if action == "to-dxf"
        && ![
            b"AC1014", b"AC1015", b"AC1018", b"AC1021", b"AC1024", b"AC1027", b"AC1032",
        ]
        .iter()
        .any(|s| bytes.starts_with(*s))
    {
        return Err("DWG import supports AutoCAD R14 through the 2018 file format. This file has an unsupported signature.".into());
    }
    if action == "to-dwg"
        && (std::str::from_utf8(&bytes).is_err() || !bytes.windows(7).any(|s| s == b"SECTION"))
    {
        return Err("DWG export requires an ASCII DXF drawing.".into());
    }
    Ok(bytes)
}
fn limited_read(mut reader: impl Read) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    reader
        .by_ref()
        .take((RESPONSE_LIMIT + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|_| "CAD output could not be read.")?;
    if bytes.len() > RESPONSE_LIMIT {
        return Err("CAD output exceeded its size limit.".into());
    }
    Ok(bytes)
}
fn convert(
    exe: &Path,
    action: &str,
    bytes: Vec<u8>,
    cancelled: Arc<AtomicBool>,
) -> Result<Value, String> {
    if cancelled.load(Ordering::SeqCst) {
        return Err("CAD conversion cancelled.".into());
    }
    let mut command = Command::new(exe);
    command
        .arg(action)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|_| {
        "Local CAD translator could not start. Windows requires .NET Framework 4.8."
    })?;
    let mut stdin = child.stdin.take().ok_or("CAD input unavailable.")?;
    let stdout = child.stdout.take().ok_or("CAD output unavailable.")?;
    let writer = std::thread::spawn(move || stdin.write_all(&bytes));
    let reader = std::thread::spawn(move || limited_read(stdout));
    let started = Instant::now();
    let outcome = loop {
        if cancelled.load(Ordering::SeqCst) {
            break Err("CAD conversion cancelled.");
        }
        if started.elapsed() > Duration::from_secs(30) {
            break Err("CAD conversion exceeded 30 seconds. Try a smaller drawing.");
        }
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(_) => break Err("CAD translator stopped unexpectedly."),
        }
    };
    if outcome.is_err() {
        let _ = child.kill();
        let _ = child.wait();
    }
    let write_result = writer.join();
    let read_result = reader.join();
    let status = outcome.map_err(str::to_string)?;
    let output = read_result.map_err(|_| "CAD output reader stopped.")??;
    let result: Value = serde_json::from_slice(&output)
        .map_err(|_| "CAD translator returned an invalid response.")?;
    if !status.success() || result["ok"] != true {
        return Err(result["error"]
            .as_str()
            .unwrap_or("CAD conversion failed.")
            .chars()
            .take(500)
            .collect());
    }
    write_result
        .map_err(|_| "CAD input writer stopped.")?
        .map_err(|_| "CAD input was interrupted.")?;
    if cancelled.load(Ordering::SeqCst) {
        return Err("CAD conversion cancelled.".into());
    }
    let source = result["bytesBase64"]
        .as_str()
        .ok_or("CAD output is missing.")?;
    // Validate bytes in the opposite direction before returning them to the UI.
    decode_request(
        if action == "to-dwg" {
            "to-dxf"
        } else {
            "to-dwg"
        },
        source,
    )?;
    Ok(result)
}
#[tauri::command]
pub async fn xray_cad_convert(
    app: AppHandle,
    state: State<'_, CadState>,
    request_id: String,
    action: String,
    source_base64: String,
) -> Result<Value, String> {
    if request_id.len() < 8
        || request_id.len() > 80
        || !request_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-')
    {
        return Err("Invalid CAD request identity.".into());
    }
    let bytes = decode_request(&action, &source_base64)?;
    let exe = executable(&app)?;
    let token = Arc::new(AtomicBool::new(false));
    {
        let mut active = state.0.lock().map_err(|_| "CAD state unavailable.")?;
        if active.is_some() {
            return Err("A CAD conversion is already running.".into());
        }
        *active = Some((request_id, token.clone()));
    }
    let result = tauri::async_runtime::spawn_blocking(move || convert(&exe, &action, bytes, token))
        .await
        .map_err(|_| "CAD conversion stopped.".to_string())
        .and_then(|r| r);
    if let Ok(mut active) = state.0.lock() {
        *active = None;
    }
    result
}
#[tauri::command]
pub fn xray_cad_cancel(state: State<'_, CadState>, request_id: String) {
    if let Ok(active) = state.0.lock() {
        if let Some((id, token)) = active.as_ref() {
            if id == &request_id {
                token.store(true, Ordering::SeqCst);
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_cad_before_starting_process() {
        assert!(decode_request("shell", "AAAA").is_err());
        assert!(decode_request("to-dxf", "not base64").is_err());
        assert!(decode_request("to-dxf", &STANDARD.encode(b"%PDF-1.7 test")).is_err());
        assert!(decode_request("to-dwg", &STANDARD.encode(b"AC1027binary")).is_err());
        assert!(decode_request("to-dxf", &"A".repeat(16_000_004)).is_err());
    }
    #[test]
    fn bounds_translator_output_and_honors_early_cancellation() {
        assert!(limited_read(std::io::repeat(0).take((RESPONSE_LIMIT + 1) as u64)).is_err());
        assert_eq!(
            convert(
                Path::new("missing.exe"),
                "to-dwg",
                vec![],
                Arc::new(AtomicBool::new(true))
            )
            .unwrap_err(),
            "CAD conversion cancelled."
        );
    }
}
