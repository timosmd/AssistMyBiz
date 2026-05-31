use std::path::PathBuf;

/// Sicherer Dateiname: endet auf .md, keine Pfadtrenner, kein "..".
pub fn is_safe_filename(name: &str) -> bool {
    name.ends_with(".md")
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains("..")
}

/// Repo-Ordner (Elternverzeichnis von src-tauri) zur Compile-Zeit.
fn reports_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
        .join("bug-reports")
}

#[tauri::command]
pub fn write_bug_report(filename: String, content: String) -> Result<String, String> {
    if !is_safe_filename(&filename) {
        return Err("Ungültiger Dateiname".to_string());
    }
    let dir = reports_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&filename);
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn safe_filename_accepts_plain_md_and_rejects_traversal() {
        assert!(is_safe_filename("2026-05-31T22-10-00-000Z_Hoch.md"));
        assert!(!is_safe_filename("../escape.md"));
        assert!(!is_safe_filename("sub/dir.md"));
        assert!(!is_safe_filename("no-extension"));
        assert!(!is_safe_filename("a\\b.md"));
    }
}
