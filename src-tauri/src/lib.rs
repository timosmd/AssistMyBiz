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
        Migration {
            version: 4,
            description: "create_articles",
            sql: "
                CREATE TABLE articles (
                  id INTEGER PRIMARY KEY,
                  name TEXT NOT NULL,
                  bestand INTEGER NOT NULL DEFAULT 0,
                  mindestbestand INTEGER NOT NULL DEFAULT 0,
                  einheit TEXT,
                  lieferant TEXT,
                  erstellt_am TEXT NOT NULL
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create_checklist_templates",
            sql: "
                CREATE TABLE checklist_templates (
                  id INTEGER PRIMARY KEY,
                  name TEXT NOT NULL,
                  frequenz TEXT NOT NULL DEFAULT 'taeglich',
                  items_json TEXT NOT NULL DEFAULT '[]',
                  erstellt_am TEXT NOT NULL
                );
                INSERT INTO checklist_templates (name, frequenz, items_json, erstellt_am) VALUES
                  ('Öffnen', 'taeglich', '[{\"id\":\"o1\",\"label\":\"Kasse hochfahren\"},{\"id\":\"o2\",\"label\":\"Licht & Schild einschalten\"},{\"id\":\"o3\",\"label\":\"Eingang aufsperren\"}]', '2026-05-31T00:00:00Z'),
                  ('Schließen', 'taeglich', '[{\"id\":\"s1\",\"label\":\"Kasse zählen & abschließen\"},{\"id\":\"s2\",\"label\":\"Licht ausschalten\"},{\"id\":\"s3\",\"label\":\"Türen & Fenster prüfen\"},{\"id\":\"s4\",\"label\":\"Alarm aktivieren\"}]', '2026-05-31T00:00:00Z'),
                  ('Wöchentlich', 'woechentlich', '[{\"id\":\"w1\",\"label\":\"Lager auf Mindestbestände prüfen\"},{\"id\":\"w2\",\"label\":\"Kühlung/Geräte reinigen\"},{\"id\":\"w3\",\"label\":\"Müll rausbringen\"}]', '2026-05-31T00:00:00Z');
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create_checklist_runs",
            sql: "
                CREATE TABLE checklist_runs (
                  id INTEGER PRIMARY KEY,
                  template_id INTEGER REFERENCES checklist_templates(id) ON DELETE SET NULL,
                  periode TEXT NOT NULL,
                  snapshot_json TEXT NOT NULL,
                  item_states_json TEXT NOT NULL DEFAULT '{}',
                  notiz TEXT,
                  erstellt_am TEXT NOT NULL,
                  abgeschlossen_am TEXT,
                  UNIQUE(template_id, periode)
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
            receipts::open_receipt_file,
            bugreport::write_bug_report,
            export::export_bookkeeping,
            export::export_reorder,
            scanner::start_scan_session,
            scanner::stop_scan_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
