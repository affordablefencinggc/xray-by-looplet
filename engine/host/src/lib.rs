//! Spawn the X-Ray engine and return parsed takeoff JSON.
//! Same contract as `xray-by-looplet/host/xray-host.js` and the Looplet
//! Tauri sidecar snippet in `desktop/README.md`.
//!
//! Resolution order:
//!   1. `XRAY_ENGINE_PATH` (frozen PyInstaller binary)
//!   2. `engine/bin/xray-engine[.exe]` next to this crate
//!   3. first working `python` / `python3` / `py -3` running
//!      `<py> -m xray run` with `PYTHONPATH=engine/python`
//!
//! Result-file contract: the engine writes the takeoff JSON to EXACTLY
//! `result.json` inside the `--out` scratch directory (we pass
//! `--result-name result.json`, see `engine/python/xray/cli.py`). The host
//! reads exactly that file and ignores any other files in the directory.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(120);

/// Host↔engine result-file contract: the engine writes the takeoff JSON to
/// this exact filename inside the `--out` directory, and the host reads
/// exactly this file. Stray JSON files in the scratch dir are ignored.
pub const RESULT_FILE_NAME: &str = "result.json";

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

/// Candidates for the Python fallback, in probe order. `python3` is dead on
/// Windows, so `python` is tried first and the `py` launcher is pinned to
/// `-3` explicitly. Each candidate must pass a `--version` probe that
/// reports a Python 3 interpreter before it is used.
const PY_CANDIDATES: [(&str, &[&str]); 3] = [
    ("python", &[]),
    ("python3", &[]),
    ("py", &["-3"]),
];

/// Probe candidates with `--version` (the existing build-sidecar.mjs probe
/// pattern) and return the first one that reports Python 3. Cached so each
/// takeoff runs at most one extra probe process.
fn resolve_python() -> Option<(&'static str, Vec<&'static str>)> {
    static CACHE: OnceLock<Option<(&'static str, Vec<&'static str>)>> = OnceLock::new();
    CACHE
        .get_or_init(|| {
            for (exe, prefix) in PY_CANDIDATES {
                let mut probe = Command::new(exe);
                probe.args(prefix).arg("--version");
                match probe.output() {
                    Ok(out) if out.status.success() => {
                        let text = format!(
                            "{}{}",
                            String::from_utf8_lossy(&out.stdout),
                            String::from_utf8_lossy(&out.stderr),
                        );
                        if text.contains("Python 3") {
                            return Some((exe, prefix.to_vec()));
                        }
                    }
                    _ => continue, // not installed (or Windows Store alias stub)
                }
            }
            None
        })
        .clone()
}

fn command_for(pdf_path: &str, out: &Path) -> Result<Command, EngineError> {
    if let Some(bin) = resolve_engine_path() {
        let mut c = Command::new(bin);
        c.args([
            "run",
            pdf_path,
            "--out",
            &out.to_string_lossy(),
            "--result-name",
            RESULT_FILE_NAME,
        ]);
        return Ok(c);
    }
    let (exe, prefix) = resolve_python().ok_or_else(|| {
        EngineError(
            "no Python 3 interpreter found (tried python, python3, py -3)".into(),
        )
    })?;
    let mut c = Command::new(exe);
    c.args(prefix)
        .args([
            "-m",
            "xray",
            "run",
            pdf_path,
            "--out",
            &out.to_string_lossy(),
            "--result-name",
            RESULT_FILE_NAME,
        ])
        .env("PYTHONPATH", python_src_dir());
    Ok(c)
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
    let result = match command_for(pdf_path, &out) {
        Ok(mut cmd) => {
            cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
            match cmd
                .spawn()
                .map_err(|e| EngineError(format!("failed to spawn engine: {e}")))
                .and_then(wait_with_timeout)
            {
                Ok(output) if !output.status.success() => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    Err(EngineError(format!(
                        "engine exit {}: {stderr}{stdout}",
                        output.status
                    )))
                }
                Ok(_) => read_result(&out),
                Err(e) => Err(e),
            }
        }
        Err(e) => Err(e),
    };
    let _ = std::fs::remove_dir_all(&out);
    result
}

/// Contract read: the engine writes exactly `RESULT_FILE_NAME` into `out`;
/// the host reads that exact path. Any other files in the scratch dir (e.g.
/// stray JSON written by something else) are ignored — they never satisfy
/// the contract.
fn read_result(out: &Path) -> Result<serde_json::Value, EngineError> {
    let json_path = out.join(RESULT_FILE_NAME);
    if !json_path.is_file() {
        let mut msg = format!(
            "engine produced no takeoff JSON (expected {})",
            json_path.display()
        );
        let strays: Vec<String> = std::fs::read_dir(out)
            .map(|rd| {
                rd.filter_map(|e| e.ok())
                    .map(|e| e.file_name().to_string_lossy().into_owned())
                    .collect()
            })
            .unwrap_or_default();
        if !strays.is_empty() {
            msg.push_str(&format!("; scratch dir contained: {}", strays.join(", ")));
        }
        return Err(EngineError(msg));
    }
    let raw = std::fs::read_to_string(&json_path).map_err(|e| EngineError(e.to_string()))?;
    serde_json::from_str(&raw).map_err(|e| EngineError(e.to_string()))
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

    #[test]
    fn result_contract_is_fixed_file_name() {
        assert_eq!(RESULT_FILE_NAME, "result.json");
        // The Python side of the contract must mirror it (cli.py).
        let cli = python_src_dir().join("xray/cli.py");
        let src = std::fs::read_to_string(&cli).unwrap();
        assert!(
            src.contains("HOST_RESULT_NAME = \"result.json\""),
            "cli.py no longer declares the host result contract"
        );
    }

    #[test]
    fn python_fallback_order_is_windows_viable() {
        // 'python' first ('python3' is dead on Windows), 'py' pinned to -3.
        assert_eq!(PY_CANDIDATES[0].0, "python");
        assert_eq!(PY_CANDIDATES[1].0, "python3");
        assert_eq!(PY_CANDIDATES[2], ("py", &["-3"][..]));
    }
}
