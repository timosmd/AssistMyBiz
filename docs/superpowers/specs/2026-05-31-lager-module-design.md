# Modul „Lager" — Design-Dokument

**Datum:** 2026-05-31
**Status:** Freigegeben (Kurz-Brainstorming)
**Teil von:** Laden-Cockpit (Produkt-Spec §6.3)
**Markt:** Österreich

---

## 1. Ziel

Das dritte Cockpit-Modul: ein **einfacher Lager-Überblick** für kleine Läden — Artikel
mit aktuellem Bestand und Mindestbestand, schnell per +/− pflegbar. Kein Scannen, kein
Vollsystem: „der Zettel an der Wand, nur smart". Rein lokal.

## 2. Umfang v1 (nur „Artikel"-Tab)

Die **Bestellung/Nachbestellung kommt später als eigener Reiter** (eigener Plan). v1 ist
nur die Artikel-Verwaltung — der Lieferant wird aber schon erfasst, damit der spätere
Bestell-Reiter sauber nach Lieferant gruppieren kann.

**v1 enthält:**
- Artikel **anlegen**: Name (Pflicht), Mindestbestand, optional Einheit & Lieferant.
- **Liste** je Artikel: Name · Bestand (**+/−** und Direkteingabe) · Mindestbestand ·
  Einheit · Lieferant.
- Artikel **unter/gleich Mindestbestand** werden **farblich markiert** (man sieht das
  Nötige schon ohne Bestell-Reiter).
- **Löschen** · **Suchen/Filtern** (Name/Lieferant).

**v1 NICHT:** Nachbestell-Liste + Export (eigener Reiter „Bestellung", später),
Barcode/Scan, Kategorien, automatischer Abverkauf aus der Kasse, Lieferanten-Stammdaten.

## 3. Aufbau & Einordnung

Route **`/inventory`** (ersetzt `InventoryPlaceholder`) → Modul-Hülle mit Tabs
**Artikel** (aktiv) · **Bestellung** (Platzhalter „bald verfügbar"). Folgt dem bewährten
`TillModule`-Muster (Tabs, Zurück-zum-Cockpit-Link).

```
src/routes/inventory/InventoryModule.tsx     # Tab-Hülle (+ BackLink)
src/features/inventory/
  ArticleForm.tsx        # anlegen
  ArticleRow.tsx         # eine Zeile (Bestand +/−, Markierung, Löschen)
  ArticleList.tsx        # Liste + Suchen/Filtern
  articleFilter.ts       # reine Filter-/Low-Stock-Funktion
src/lib/db/articles.ts   # listArticles / addArticle / setBestand / deleteArticle
src/App.tsx              # /inventory -> InventoryModule
```

## 4. Datenmodell (SQLite, Migration v4)

Mengen als **ganze Zahlen** (Stückzahlen).

```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  bestand INTEGER NOT NULL DEFAULT 0,
  mindestbestand INTEGER NOT NULL DEFAULT 0,
  einheit TEXT,
  lieferant TEXT,
  erstellt_am TEXT NOT NULL
);
```

## 5. Datenzugriff (`src/lib/db/articles.ts`)

- `listArticles(): Promise<Article[]>` — alle, nach Name sortiert.
- `addArticle(neu): Promise<void>` — Name + Mindestbestand + optional Einheit/Lieferant,
  Startbestand 0 (oder eingegeben).
- `setBestand(id, bestand): Promise<void>` — neuen Bestand setzen (für +/− und Direkteingabe;
  nie unter 0).
- `deleteArticle(id): Promise<void>`.

## 6. Reine Logik (`articleFilter.ts`)

- `isLowStock(a): boolean` — `a.bestand <= a.mindestbestand`.
- `filterArticles(list, query): Article[]` — Suche in Name + Lieferant (case-insensitive).

## 7. UI-Verhalten

- **ArticleForm:** Name (Pflicht; leer blockiert), Mindestbestand (Zahl, Default 0),
  Startbestand (Zahl, Default 0), Einheit (optional), Lieferant (optional) → `addArticle`.
- **ArticleRow:** zeigt Name, Einheit, Lieferant; Bestand mit **−/+**-Knöpfen (nicht < 0)
  und Direkteingabe (→ `setBestand`); ist `isLowStock`, wird die Zeile markiert
  (z. B. roter Rand/Badge „nachbestellen"); **Löschen**.
- **ArticleList:** Suchfeld (Name/Lieferant) + Liste; leer → „Noch keine Artikel."

## 8. Tests

- **Rein:** `isLowStock`, `filterArticles`.
- **Datenzugriff:** gemockt (wie bestehende `db`-Module).
- **Komponenten:** ArticleForm (Validierung + Anlegen), ArticleRow (+/− ruft `setBestand`
  mit korrektem Wert, nie < 0; Low-Stock-Markierung), ArticleList (Suche filtert),
  InventoryModule (Tabs, Artikel-Tab nutzbar).

## 9. Datenschutz / Recht

- Reine Lagerdaten, **keine personenbezogenen Daten** (Lieferant = Firmenname).
  Bleibt 100 % lokal — konsistent mit der App-Haltung.

## 10. Offene Punkte für die Planung

- Genaue Markierung „unter Minimum" (Stil) — beim Bau festlegen.
- Ob `addArticle` einen Startbestand zulässt oder immer 0 startet (Vorschlag: Startbestand
  erlaubt, Default 0).
