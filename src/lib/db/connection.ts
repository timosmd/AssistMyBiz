import Database from "@tauri-apps/plugin-sql";

/** Geteilte, faul geladene SQLite-Verbindung (eine pro Prozess). */
let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load("sqlite:assistmybiz.db");
  return dbPromise;
}
