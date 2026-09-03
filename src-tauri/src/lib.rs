//! Looplet Tauri shell for X-Ray.
//! Command contract from `xray-by-looplet/desktop/README.md` "Embedding in Looplet".

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use xray_engine_host::{engine_status, run_takeoff};

#[tauri::command]
fn xray_engine_status() -> serde_json::Value {
    engine_status()
}

#[tauri::command]
fn xray_run_takeoff(pdf_path: String) -> Result<serde_json::Value, String> {
    run_takeoff(&pdf_path).map_err(|e| e.0)
}

#[tauri::command]
fn xray_pick_plan(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Plans (PDF / DXF / SVG)", &["pdf", "dxf", "svg"])
        .blocking_pick_file();
    Ok(picked.and_then(|p| p.into_path().ok()).map(|p| p.to_string_lossy().into_owned()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            xray_run_takeoff,
            xray_engine_status,
            xray_pick_plan
        ])
        .run(tauri::generate_context!())
        .expect("error while running X-Ray");
}
