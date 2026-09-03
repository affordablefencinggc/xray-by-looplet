//! Spawn the X-Ray engine and return parsed takeoff JSON.
//! Same contract as `xray-by-looplet/host/xray-host.js` and the Looplet
//! Tauri sidecar snippet in `desktop/README.md`.
//!
//! Resolution order:
//!   1. `XRAY_ENGINE_PATH` (frozen PyInstaller binary)
//!   2. `engine/bin/xray-engine[.exe]` next to this crate
//!   3. `python3 -m xray run` with `PYTHONPATH=engine/python`

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Debug)]
pub struct EngineError(pub String);

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}
impl std::error::Error for EngineError {}

pub fn engine_exe_name() -> &'static str {
    if cfg!(windows) {
        "xray-engine.exe"
    } else {
        "xray-engine"
    }
}

pub fn python_src_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../python")
}

pub fn resolve_engine_path() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("XRAY_ENGINE_PATH") {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Some(pb);
        }
    }
    let exe = engine_exe_name();
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    [root.join("../bin").join(exe), root.join("../../engine/bin").join(exe)]
        .into_iter()
        .find(|p| p.is_file())
}

pub fn engine_status() -> serde_json::Value {
    let src = python_src_dir();
    let sidecar = resolve_engine_path();
    serde_json::json!({
        "engine": "xray-by-looplet",
        "host": "tauri",
        "pythonSrc": src.display().to_string(),
        "pythonPresent": src.join("xray/__init__.py").is_file(),
        "sidecar": sidecar.as_ref().map(|p| p.display().to_string()),
        "available": sidecar.is_some() || src.join("xray/__init__.py").is_file(),
    })
}

fn scratch_dir() -> Result<PathBuf, EngineError> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let out = std::env::temp_dir().join(format!("xray-{}-{}", std::process::id(), nanos));
    std::fs::create_dir_all(&out).map_err(|e| EngineError(e.to_string()))?;
    Ok(out)
}

fn command_for(pdf_path: &str, out: &Path) -> Command {
    if let Some(bin) = resolve_engine_path() {
        let mut c = Command::new(bin);
        c.args(["run", pdf_path, "--out", &out.to_string_lossy()]);
        return c;
    }
    let mut c = Command::new("python3");
    c.args(["-m", "xray", "run", pdf_path, "--out", &out.to_string_lossy()])
        .env("PYTHONPATH", python_src_dir());
    c
}

fn wait_with_timeout(mut child: std::process::Child) -> Result<std::process::Output, EngineError> {
    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();
    let stdout_h = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(ref mut s) = stdout_pipe {
            let _ = s.read_to_end(&mut buf);
        }
        buf
    });
    let stderr_h = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(ref mut s) = stderr_pipe {
            let _ = s.read_to_end(&mut buf);
        }
        buf
    });
    let start = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(st)) => break st,
            Ok(None) if start.elapsed() > DEFAULT_TIMEOUT => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(EngineError("engine timed out after 120s".into()));
            }
            Ok(None) => thread::sleep(Duration::from_millis(40)),
            Err(e) => return Err(EngineError(e.to_string())),
        }
    };
    Ok(std::process::Output {
        status,
        stdout: stdout_h.join().unwrap_or_default(),
        stderr: stderr_h.join().unwrap_or_default(),
    })
}

pub fn run_takeoff(pdf_path: &str) -> Result<serde_json::Value, EngineError> {
    let pdf = Path::new(pdf_path);
    if !pdf.is_file() {
        return Err(EngineError(format!("no such file: {pdf_path}")));
    }
    let out = scratch_dir()?;
    let mut cmd = command_for(pdf_path, &out);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let child = cmd
        .spawn()
        .map_err(|e| EngineError(format!("failed to spawn engine: {e}")))?;
    let output = wait_with_timeout(child)?;
    let result = if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        Err(EngineError(format!(
            "engine exit {}: {stderr}{stdout}",
            output.status
        )))
    } else {
        let json_path = std::fs::read_dir(&out)
            .map_err(|e| EngineError(e.to_string()))?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .find(|p| p.extension().is_some_and(|x| x == "json"))
            .ok_or_else(|| EngineError("engine produced no takeoff JSON".into()))?;
        let raw = std::fs::read_to_string(&json_path).map_err(|e| EngineError(e.to_string()))?;
        serde_json::from_str(&raw).map_err(|e| EngineError(e.to_string()))
    };
    let _ = std::fs::remove_dir_all(&out);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn python_package_is_on_disk() {
        let init = python_src_dir().join("xray/__init__.py");
        assert!(init.is_file(), "missing {}", init.display());
    }

    #[test]
    fn missing_pdf_is_an_error() {
        let err = run_takeoff("/no/such/plan.pdf").unwrap_err();
        assert!(err.0.contains("no such file"));
    }

    #[test]
    fn status_reports_python_present() {
        let s = engine_status();
        assert_eq!(s["engine"], "xray-by-looplet");
        assert_eq!(s["pythonPresent"], true);
        assert_eq!(s["available"], true);
    }

    #[test]
    fn exe_name_is_platform_correct() {
        if cfg!(windows) {
            assert_eq!(engine_exe_name(), "xray-engine.exe");
        } else {
            assert_eq!(engine_exe_name(), "xray-engine");
        }
    }
}
