use std::path::PathBuf;
use tauri::Manager;

/// Sicherer Zielname: keine Pfadtrenner, kein "..".
pub fn is_safe_dest_name(name: &str) -> bool {
    !name.is_empty() && !name.contains('/') && !name.contains('\\') && !name.contains("..")
}

/// Sicherer relativer Quellpfad innerhalb von receipts/ (z. B. "2026/uuid.jpg"):
/// einfacher Schrägstrich erlaubt, aber kein "..", kein Backslash, nicht absolut.
pub fn is_safe_relative(rel: &str) -> bool {
    !rel.is_empty() && !rel.contains("..") && !rel.contains('\\') && !rel.starts_with('/')
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFile {
    pub src_relative: String,
    pub dest_name: String,
}

#[tauri::command]
pub fn export_bookkeeping(
    app: tauri::AppHandle,
    target_dir: String,
    files: Vec<ExportFile>,
    index_csv: String,
    summary: String,
) -> Result<u32, String> {
    let target = PathBuf::from(&target_dir);
    std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    let receipts_base = app.path().app_data_dir().map_err(|e| e.to_string())?.join("receipts");

    let mut copied = 0u32;
    for f in &files {
        if !is_safe_dest_name(&f.dest_name) {
            return Err(format!("Ungültiger Zielname: {}", f.dest_name));
        }
        if !is_safe_relative(&f.src_relative) {
            return Err(format!("Unzulässiger Quellpfad: {}", f.src_relative));
        }
        let src = receipts_base.join(&f.src_relative);
        if src.exists() {
            std::fs::copy(&src, target.join(&f.dest_name)).map_err(|e| e.to_string())?;
            copied += 1;
        }
    }

    // index.csv mit UTF-8 BOM (Excel-freundlich)
    let csv = format!("\u{feff}{index_csv}");
    std::fs::write(target.join("index.csv"), csv).map_err(|e| e.to_string())?;
    std::fs::write(target.join("zusammenfassung.txt"), summary).map_err(|e| e.to_string())?;
    Ok(copied)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn safe_dest_name_blocks_separators_and_traversal() {
        assert!(is_safe_dest_name("2026-05-31_Miete_5-00.jpg"));
        assert!(!is_safe_dest_name("../x.jpg"));
        assert!(!is_safe_dest_name("a/b.jpg"));
        assert!(!is_safe_dest_name(""));
    }
    #[test]
    fn safe_relative_allows_one_slash_but_blocks_traversal() {
        assert!(is_safe_relative("2026/abc.jpg"));
        assert!(!is_safe_relative("../../etc/passwd"));
        assert!(!is_safe_relative("2026\\..\\x.jpg"));
        assert!(!is_safe_relative("/etc/passwd"));
        assert!(!is_safe_relative(""));
    }
}
