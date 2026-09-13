//! Fixed, build-attested engine resource selection; never searches PATH.
use std::{ffi::OsString, fs::File, io::Read, path::{Component, Path, PathBuf}, process::Command};
use sha2::{Digest, Sha256};
use xray_engine_host::{CommandFactory, ConfiguredRunner, Invocation, TransportCode, TransportError, TransportStage};

pub struct SelectedEngine {
    choice: Choice,
}
enum Choice {
    Explicit(PathBuf),
    Bundled { root: PathBuf, sha256: String },
    Unavailable,
}
fn unavailable() -> TransportError {
    TransportError { code: TransportCode::EngineUnavailable, stage: TransportStage::Preflight,
        retryable: true, safe_message: "The local calculation engine is unavailable.", diagnostic_id: None }
}
impl SelectedEngine {
    pub fn new(explicit: Option<OsString>, resource_root: Option<PathBuf>, expected_sha: Option<&str>) -> Self {
        // Even an empty/invalid explicit override must not select the bundled fallback.
        let choice = if let Some(path) = explicit {
            Choice::Explicit(path.into())
        } else if let (Some(root), Some(sha)) = (resource_root, expected_sha) {
            if cfg!(target_os = "windows") && sha.len() == 64 && sha.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)) {
                Choice::Bundled { root, sha256: sha.to_owned() }
            } else { Choice::Unavailable }
        } else { Choice::Unavailable };
        Self { choice }
    }
    fn runner(&self) -> Result<ConfiguredRunner, TransportError> {
        match &self.choice {
            Choice::Explicit(path) => ConfiguredRunner::new(path.clone()),
            Choice::Unavailable => Err(unavailable()),
            Choice::Bundled { root, sha256 } => {
                let path = root.join("engine/bin/xray-engine.exe");
                validate_resource(root, &path, sha256)?;
                ConfiguredRunner::new(path)
            }
        }
    }
}
impl CommandFactory for SelectedEngine {
    fn command(&self, invocation: &Invocation) -> Result<Command, TransportError> {
        self.runner()?.command(invocation)
    }
    fn status_command(&self) -> Result<Command, TransportError> {
        self.runner()?.status_command()
    }
}
fn validate_resource(root: &Path, path: &Path, expected: &str) -> Result<(), TransportError> {
    if !root.is_absolute() || !path.starts_with(root) || root.components().any(|c| matches!(c, Component::ParentDir | Component::CurDir)) {
        return Err(unavailable());
    }
    // Check every ancestor, including the resource root, before canonicalization.
    for ancestor in path.ancestors() {
        let metadata = std::fs::symlink_metadata(ancestor).map_err(|_| unavailable())?;
        if metadata.file_type().is_symlink() { return Err(unavailable()); }
        #[cfg(windows)] {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 { return Err(unavailable()); }
        }
    }
    let canonical_root = root.canonicalize().map_err(|_| unavailable())?;
    let canonical_path = path.canonicalize().map_err(|_| unavailable())?;
    if !canonical_path.starts_with(&canonical_root) || !path.is_file() { return Err(unavailable()); }
    let mut file = File::open(path).map_err(|_| unavailable())?;
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let count = file.read(&mut buffer).map_err(|_| unavailable())?;
        if count == 0 { break; }
        hash.update(&buffer[..count]);
    }
    if format!("{:x}", hash.finalize()) != expected { return Err(unavailable()); }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    fn fixture() -> (PathBuf, PathBuf, String) {
        let root = std::env::temp_dir().join(format!("xray-bundled-{}-{}", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)));
        std::fs::create_dir_all(root.join("engine/bin")).unwrap();
        let exe = root.join("engine/bin/xray-engine.exe");
        std::fs::write(&exe, b"test executable identity only; never launched").unwrap();
        let sha = format!("{:x}", Sha256::digest(std::fs::read(&exe).unwrap()));
        (root, exe, sha)
    }
    #[test]
    fn missing_or_invalid_build_identity_fails_closed() {
        let (root, _, _) = fixture();
        for sha in [None, Some(""), Some("not-a-sha")] {
            assert!(SelectedEngine::new(None, Some(root.clone()), sha).status_command().is_err());
        }
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn invalid_explicit_override_never_falls_back() {
        let (root, _, sha) = fixture();
        let engine = SelectedEngine::new(Some(OsString::from("")), Some(root.clone()), Some(&sha));
        assert!(engine.status_command().is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn resource_integrity_and_path_escape_rejected() {
        let (root, exe, sha) = fixture();
        assert!(validate_resource(&root, &exe, &sha).is_ok());
        assert!(validate_resource(&root.join("elsewhere"), &exe, &sha).is_err());
        std::fs::write(&exe, b"changed").unwrap();
        assert!(validate_resource(&root, &exe, &sha).is_err());
        std::fs::remove_file(&exe).unwrap();
        assert!(validate_resource(&root, &exe, &sha).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn explicit_status_and_bom_select_same_program() {
        let (root, exe, sha) = fixture();
        let engine = SelectedEngine::new(Some(exe.clone().into_os_string()), None, Some(&sha));
        assert_eq!(engine.status_command().unwrap().get_program(), exe.as_os_str());
        // Both transport methods construct through the same checked runner.
        let invocation = Invocation { scratch_dir: root.clone(), result_path: root.join("result.json") };
        assert_eq!(engine.command(&invocation).unwrap().get_program(), exe.as_os_str());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[cfg(windows)]
    #[test]
    fn bundled_selection_rechecks_content_on_every_command() {
        let (root, exe, sha) = fixture();
        let engine = SelectedEngine::new(None, Some(root.clone()), Some(&sha));
        assert_eq!(engine.status_command().unwrap().get_program(), exe.as_os_str());
        std::fs::write(&exe, b"replaced after selection").unwrap();
        assert!(engine.status_command().is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[cfg(windows)]
    #[test]
    fn resource_root_junction_is_rejected() {
        use std::os::windows::process::CommandExt;
        let (root, _, sha) = fixture();
        let alias = root.with_extension("junction");
        let status = Command::new("cmd.exe").args(["/c", "mklink", "/J"])
            .arg(&alias).arg(&root).creation_flags(0x08000000).output().unwrap();
        assert!(status.status.success());
        let result = validate_resource(&alias, &alias.join("engine/bin/xray-engine.exe"), &sha);
        std::fs::remove_dir(&alias).unwrap();
        std::fs::remove_dir_all(&root).unwrap();
        assert!(result.is_err());
    }}
