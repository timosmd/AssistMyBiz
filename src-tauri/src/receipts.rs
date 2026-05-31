use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

/// Erlaubte Dateiendung -> normalisierter Typ. None = nicht erlaubt.
pub fn file_kind(src: &str) -> Option<&'static str> {
    match Path::new(src).extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()).as_deref() {
        Some("jpg") | Some("jpeg") => Some("jpg"),
        Some("png") => Some("png"),
        Some("pdf") => Some("pdf"),
        _ => None,
    }
}

/// Relativer Zielpfad innerhalb von receipts/: "<jahr>/<uuid>.<kind>".
pub fn relative_dest(year: &str, uuid: &str, kind: &str) -> String {
    format!("{year}/{uuid}.{kind}")
}

/// Genau vier ASCII-Ziffern — verhindert Pfad-Traversal über den Jahr-Parameter.
pub fn is_valid_year(year: &str) -> bool {
    year.len() == 4 && year.chars().all(|c| c.is_ascii_digit())
}

#[derive(serde::Serialize)]
pub struct ImportedFile {
    pub relative_path: String,
    pub file_kind: String,
}

#[tauri::command]
pub fn import_receipt_file(app: tauri::AppHandle, src_path: String, year: String) -> Result<ImportedFile, String> {
    let kind = file_kind(&src_path).ok_or_else(|| "Nicht unterstützter Dateityp".to_string())?;
    if !is_valid_year(&year) {
        return Err("Ungültiges Jahr".to_string());
    }
    let uuid = uuid::Uuid::new_v4().to_string();
    let rel = relative_dest(&year, &uuid, kind);
    let base: PathBuf = app.path().app_data_dir().map_err(|e| e.to_string())?.join("receipts");
    let dest = base.join(&rel);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::copy(&src_path, &dest).map_err(|e| e.to_string())?;
    Ok(ImportedFile { relative_path: rel, file_kind: kind.to_string() })
}

#[tauri::command]
pub fn read_receipt_file(app: tauri::AppHandle, relative_path: String) -> Result<Vec<u8>, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("receipts").join(&relative_path);
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_receipt_file(app: tauri::AppHandle, relative_path: String) -> Result<(), String> {
    if !crate::export::is_safe_relative(&relative_path) {
        return Err("Unzulässiger Pfad".to_string());
    }
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("receipts").join(&relative_path);
    app.opener()
        .open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn file_kind_normalizes_known_extensions() {
        assert_eq!(file_kind("a/b/foo.JPG"), Some("jpg"));
        assert_eq!(file_kind("foo.jpeg"), Some("jpg"));
        assert_eq!(file_kind("foo.PNG"), Some("png"));
        assert_eq!(file_kind("foo.pdf"), Some("pdf"));
        assert_eq!(file_kind("foo.gif"), None);
        assert_eq!(file_kind("noext"), None);
    }
    #[test]
    fn relative_dest_builds_year_uuid_kind() {
        assert_eq!(relative_dest("2026", "abc", "jpg"), "2026/abc.jpg");
    }
    #[test]
    fn is_valid_year_rejects_traversal_and_junk() {
        assert!(is_valid_year("2026"));
        assert!(!is_valid_year("../.."));
        assert!(!is_valid_year("26"));
        assert!(!is_valid_year("20266"));
        assert!(!is_valid_year("20a6"));
    }
}
