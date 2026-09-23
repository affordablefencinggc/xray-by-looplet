//! Saves quote handover files into a folder the user picked (for example a Dropbox, OneDrive or
//! Google Drive folder, which then syncs them). Only plain file names with handover extensions are
//! accepted, existing files are never overwritten and the total size is bounded.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use std::io::Write;
use std::path::{Path, PathBuf};

const MAX_TOTAL_BYTES: usize = 25 * 1024 * 1024;
const MAX_FILES: usize = 8;

#[derive(Deserialize)]
pub struct HandoverFileInput { name: String, #[serde(rename = "base64")] data: String }

fn valid_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    !name.is_empty() && name.len() <= 120 && !name.starts_with('.')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
        && [".pdf", ".csv", ".json", ".zip"].iter().any(|ext| lower.ends_with(ext))
}

/// Writes every file or none: names and sizes are validated and existing names are refused before any write.
pub fn save_handover(dir: &Path, files: &[HandoverFileInput]) -> Result<Vec<PathBuf>, String> {
    if !dir.is_absolute() || !dir.is_dir() { return Err("Choose an existing folder for the handover files.".into()); }
    if files.is_empty() || files.len() > MAX_FILES { return Err("Nothing to save.".into()); }
    let mut decoded = Vec::new();
    let mut total = 0;
    for file in files {
        if !valid_name(&file.name) { return Err(format!("Refused unsafe file name: {}", file.name)); }
        let bytes = STANDARD.decode(&file.data).map_err(|_| "Handover file data is invalid.")?;
        total += bytes.len();
        if total > MAX_TOTAL_BYTES { return Err("Handover files exceed 25 MB.".into()); }
        let target = dir.join(&file.name);
        if target.exists() { return Err(format!("{} already exists in that folder. Change the quote reference or choose another folder; nothing was saved.", file.name)); }
        decoded.push((target, bytes));
    }
    let mut written = Vec::new();
    for (target, bytes) in decoded {
        let result = std::fs::OpenOptions::new().write(true).create_new(true).open(&target).and_then(|mut f| { f.write_all(&bytes)?; f.sync_all() });
        if let Err(error) = result {
            for path in &written { let _ = std::fs::remove_file(path); }
            return Err(format!("Could not save {}: {}. Nothing was kept.", target.file_name().and_then(|n| n.to_str()).unwrap_or("file"), error.kind()));
        }
        written.push(target);
    }
    Ok(written)
}

#[tauri::command]
pub fn xray_save_handover(dir: String, files: Vec<HandoverFileInput>) -> Result<Vec<String>, String> {
    save_handover(Path::new(&dir), &files).map(|paths| paths.into_iter().map(|p| p.display().to_string()).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn file(name: &str, text: &str) -> HandoverFileInput { HandoverFileInput { name: name.into(), data: STANDARD.encode(text) } }
    fn temp(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("xray-handover-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir); std::fs::create_dir_all(&dir).unwrap(); dir
    }

    #[test]
    fn writes_all_files_and_refuses_overwrite_without_partial_writes() {
        let dir = temp("write");
        let paths = save_handover(&dir, &[file("Q-1-draft-quote.pdf", "%PDF"), file("Q-1-draft-quote.json", "{}")]).unwrap();
        assert_eq!(paths.len(), 2);
        assert_eq!(std::fs::read_to_string(dir.join("Q-1-draft-quote.json")).unwrap(), "{}");
        let again = save_handover(&dir, &[file("Q-1-new.csv", "a"), file("Q-1-draft-quote.pdf", "x")]);
        assert!(again.unwrap_err().contains("already exists"));
        assert!(!dir.join("Q-1-new.csv").exists(), "no partial write when any name collides");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn refuses_unsafe_names_extensions_and_missing_folders() {
        let dir = temp("names");
        for name in ["../escape.pdf", "a/b.pdf", "run.exe", ".hidden.pdf", "C:evil.csv", ""] {
            assert!(save_handover(&dir, &[file(name, "x")]).is_err(), "{name}");
        }
        assert!(save_handover(&dir.join("missing"), &[file("q.pdf", "x")]).is_err());
        assert!(save_handover(Path::new("relative"), &[file("q.pdf", "x")]).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
