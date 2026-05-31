// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_sql::{Migration, MigrationKind};

mod bugreport;
mod export;
mod receipts;
mod scanner;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_settings_table",
            sql: "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_receipts_and_categories",
            sql: "
                CREATE TABLE categories (
                  id INTEGER PRIMARY KEY,
                  name TEXT NOT NULL UNIQUE,
                  is_default INTEGER NOT NULL DEFAULT 0,
                  sort_order INTEGER NOT NULL DEFAULT 0
                );
                INSERT INTO categories (name, is_default, sort_order) VALUES
                  ('Wareneinkauf', 1, 1),
                  ('Miete', 1, 2),
                  ('Betriebskosten', 1, 3),
                  ('Büromaterial', 1, 4),
                  ('Marketing', 1, 5),
                  ('Sonstiges', 1, 6);
                CREATE TABLE receipts (
                  id INTEGER PRIMARY KEY,
                  datum TEXT NOT NULL,
                  betrag_cent INTEGER NOT NULL,
                  kategorie_id INTEGER REFERENCES categories(id),
                  notiz TEXT,
                  datei_pfad TEXT,
                  datei_typ TEXT,
                  erstellt_am TEXT NOT NULL
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_daily_close",
            sql: "
                CREATE TABLE daily_close (
                  id INTEGER PRIMARY KEY,
                  datum TEXT NOT NULL UNIQUE,
                  gezaehlt_cent INTEGER,
                  soll_cent INTEGER,
                  umsatz_cent INTEGER,
                  notiz TEXT,
                  erstellt_am TEXT NOT NULL
                );
            ",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:assistmybiz.db", migrations)
                .build(),
        )
        .manage(scanner::ScanState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            receipts::import_receipt_file,
            receipts::read_receipt_file,
            bugreport::write_bug_report,
            export::export_bookkeeping,
            scanner::start_scan_session,
            scanner::stop_scan_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
