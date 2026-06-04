# LieferCheck Pro – Projektstand & Aufgabenliste für Claude

> **Zuletzt aktualisiert:** Juni 2026  
> **Stack:** Next.js 16 (App Router) · TypeScript · Supabase (Auth + PostgreSQL) · Tailwind CSS v4 · Anthropic SDK (Claude)  
> **Zweck:** KI-gestützte Lieferprüfungs-SaaS für Gastronomie-Betriebe. 5-Schritte-Workflow: Pfand → Lieferschein → Abgleich → Rechnung → Freigabe.

---

## WICHTIG: Bekannte technische Einschränkung

**Die `Edit`/`Write`-Tools von Claude Cowork kürzen lange Dateien auf Windows-Pfaden ab (Truncation-Bug).**  
**Alle Dateiänderungen MÜSSEN über `mcp__workspace__bash` mit Python-Skripten erfolgen:**

```bash
# Richtig – Python-Patch-Skript über Linux-Mountpfad:
python3 -c "
path = '/sessions/.../mnt/PRKT1_Cursor/liefercheck/app/...'
with open(path) as f: content = f.read()
content = content.replace('ALT', 'NEU')
with open(path, 'w') as f: f.write(content)
"

# Falsch – führt zu abgeschnittenen Dateien:
# Edit(file_path="E:\\Liefercheck\\...", ...)
# Write(file_path="E:\\Liefercheck\\...", ...)
```

**Mountpfad-Mapping:**
- `E:\Liefercheck\PRKT1_Cursor\liefercheck\` → `/sessions/vigilant-zen-mccarthy/mnt/PRKT1_Cursor/liefercheck/`

---

## Projektstruktur

```
liefercheck/
├── app/
│   ├── page.tsx                    # Login-Seite (Startseite)
│   ├── landing/page.tsx            # Öffentliche Marketing-Landingpage (/landing)
│   ├── dashboard/page.tsx          # Hauptübersicht aller Lieferungen
│   ├── analytics/page.tsx          # Statistiken (aktuell nur Grunddaten)
│   ├── einstellungen/page.tsx      # Nutzereinstellungen + E-Mail-Rechnungseingang
│   ├── team/page.tsx               # Teamverwaltung (hat pre-existing TS-Fehler)
│   ├── layout.tsx                  # Root Layout + PWA-Meta-Tags
│   ├── manifest.ts                 # PWA-Manifest
│   ├── globals.css                 # Globale Styles + Print-CSS
│   ├── components/
│   │   ├── AuthGuard.tsx           # Auth-Check, leitet zu "/" weiter
│   │   ├── ProgressBar.tsx         # 5-Schritte-Fortschrittsanzeige
│   │   ├── LoginForm.tsx
│   │   ├── LogoutButton.tsx
│   │   └── ProgressBar.tsx         # Nimmt jetzt lieferungId + lieferdatum als Props
│   ├── lieferung/
│   │   ├── neu/page.tsx            # Schritt 0: Lieferdatum wählen + Lieferung erstellen
│   │   ├── pfand/page.tsx          # Schritt 1: Pfand manuell erfassen
│   │   ├── lieferschein/page.tsx   # Schritt 2: Lieferschein-Foto → KI-Analyse
│   │   ├── abgleich/page.tsx       # Schritt 3: CSV-Upload → Soll-Ist-Vergleich
│   │   ├── rechnung/page.tsx       # Schritt 4: Rechnungs-PDF → KI-Analyse
│   │   ├── freigabe/page.tsx       # Schritt 5: Freigabe mit Notiz + Fotos
│   │   └── detail/page.tsx        # Detailansicht einer Lieferung (URL: /lieferung/detail?id=xxx)
│   └── api/
│       ├── analyze/                # KI-Analyse (Lieferschein, Abgleich)
│       ├── rechnung-eingang/       # E-Mail-Rechnungseingang-Webhook
│       ├── erechnung/route.ts      # NEU: XRechnung/ZUGFeRD Parser API
│       ├── pdf-to-images/          # PDF → Bilder Konvertierung
│       ├── wochen-bericht/         # Automatischer Wochenbericht per E-Mail
│       └── invite/                 # Team-Einladungen
├── lib/
│   ├── supabase.ts                 # Supabase-Client
│   ├── database.ts                 # Alle Datenbankfunktionen
│   ├── types.ts                    # TypeScript-Interfaces
│   └── erechnung.ts               # NEU: XRechnung/ZUGFeRD Parser (fast-xml-parser)
└── supabase_migrations.sql         # NEU: SQL für neue Tabellen (muss in Supabase ausgeführt werden)
```

---

## Supabase-Datenbankstruktur

### Bereits existierende Tabellen:
| Tabelle | Beschreibung |
|---|---|
| `lieferungen` | Kern-Tabelle, alle 5 Workflow-Schritte als JSONB-Spalten |
| `user_settings` | Nutzerrollen (chef/mitarbeiter), E-Mail, Wochenbericht-Toggle |
| `eingehende_rechnungen` | Über E-Mail eingegangene Rechnungen |

### Lieferungen-Spalten (wichtig für Code):
- `id` UUID PK
- `user_id` UUID (FK auth.users)
- `erstellt_am` TIMESTAMPTZ
- `status` TEXT ("offen" | "abgeschlossen")
- `pfand_items` JSONB (PfandAnalysis)
- `lieferschein_data` JSONB (LieferscheinAnalysis)
- `abgleich_data` JSONB (AbgleichAnalysis)
- `rechnung_data` JSONB (beliebig)
- `ersparnis_eur` NUMERIC
- `notiz` TEXT
- **`freigabe_erteilt` BOOLEAN** ← NEU (Migration ausstehend)
- **`freigabe_am` TIMESTAMPTZ** ← NEU (Migration ausstehend)
- **`lieferant_id` UUID FK lieferanten** ← NEU (Migration ausstehend)

### Neue Tabellen (noch NICHT in Supabase – Migration ausstehend):
```
audit_log       – Unveränderliches Protokoll aller Freigaben/Änderungen (GoBD)
lieferanten     – Lieferanten-Stammdaten mit Preislisten
```
**Die SQL-Migrationsdatei liegt unter:** `liefercheck/supabase_migrations.sql`  
**Status:** Nutzer hat versucht auszuführen, Fehler gehabt. Noch nicht erfolgreich abgeschlossen.  
**Lösung:** SQL in 3 separate Queries aufteilen und jeweils einzeln im Supabase SQL Editor ausführen (Details in supabase_migrations.sql).

### RLS-Policies:
- `is_chef()` Funktion existiert in Supabase
- Normale User sehen nur eigene Daten
- Chef sieht alle Daten des Teams

---

## Was wurde in dieser Session implementiert (FERTIG ✅)

### 1. localStorage-Bug vollständig gefixt ✅
**Problem war:** Alle 6 Workflow-Seiten nutzten localStorage für `lieferungId` → Datenverlust bei Page-Refresh, Cross-Tab-Bugs, Security-Issue.  
**Gelöst durch:** URL-Parameter `?id=xxx&date=2026-06-02` durch alle Schritte.  
**Betroffene Dateien:**
- `app/components/ProgressBar.tsx` → nimmt jetzt `lieferungId?` und `lieferdatum?` als Props, baut URLs mit Params
- `app/lieferung/neu/page.tsx` → erstellt Lieferung, navigiert zu `pfand?id=xxx&date=yyy`
- `app/lieferung/pfand/page.tsx` → liest ID aus searchParams, speichert via `updateLieferung`, navigiert mit ID weiter
- `app/lieferung/lieferschein/page.tsx` → liest ID aus searchParams, holt pfandData aus Supabase
- `app/lieferung/abgleich/page.tsx` → liest ID aus searchParams, holt lieferscheinData aus Supabase
- `app/lieferung/rechnung/page.tsx` → liest ID aus searchParams
- `app/lieferung/freigabe/page.tsx` → liest ID aus searchParams, lädt ALLE Daten aus Supabase (kein localStorage mehr)
- Alle Seiten haben `Suspense`-Wrapper (Next.js Pflicht bei `useSearchParams`)

### 2. PWA – Progressive Web App ✅
- `app/manifest.ts` erstellt (Name, Icons, Theme, Start-URL)
- `app/layout.tsx` aktualisiert: Viewport-Meta, apple-touch-icon, themeColor
- `app/globals.css`: Touch-Optimierungen (`tap-highlight: transparent`, `touch-action: manipulation`)

### 3. Kamera-Upload auf Handy ✅
- `app/lieferung/lieferschein/page.tsx`: `capture="environment"` auf File-Input → öffnet direkt Rückkamera

### 4. PDF-Export ✅
- `app/lieferung/detail/page.tsx`: Neuer "PDF"-Button im Header → `window.print()` → Browser-Druckdialog
- `app/globals.css`: Print-CSS hinzugefügt (blendet Navigation aus, schwarz auf weiß)

### 5. Öffentliche Landingpage ✅
- `app/landing/page.tsx` erstellt mit: Hero, Stats, 6 Feature-Cards, E-Rechnung-Hinweis-Banner, Preistabelle (Starter/Pro/Business/Enterprise), CTA, Footer
- Erreichbar unter: `/landing`
- Login bleibt weiterhin unter `/` (Startseite)

### 6. XRechnung / ZUGFeRD Parser ✅
- `npm install fast-xml-parser` installiert (v5.8.0 in package.json)
- `lib/erechnung.ts` erstellt (504 Zeilen):
  - `parseERechnung(xmlString)` – erkennt Format automatisch, gibt strukturierte `ERechnungDaten` zurück
  - Unterstützt: XRechnung UBL, XRechnung CII, ZUGFeRD 2.1 (Factur-X EN 16931)
  - `extractZUGFeRDFromPDF(pdfBase64)` – extrahiert eingebettetes XML aus ZUGFeRD-PDF
  - `validateERechnung(daten)` – prüft Pflichtfelder nach EN 16931 / CIUS DE
- `app/api/erechnung/route.ts` erstellt:
  - POST `/api/erechnung` – nimmt `{ xmlString }` oder `{ pdfBase64 }`, gibt geparste Rechnungsdaten zurück

---

## Was noch fehlt / TODO (in Prioritätsreihenfolge)

### HOCH – Sofort umsetzbar (kein User-Input nötig)

#### TODO 1: Supabase-Migration ausführen
**Status:** SQL fertig geschrieben, User hat technische Probleme beim Ausführen.  
**Datei:** `liefercheck/supabase_migrations.sql`  
**Was zu tun:** Drei SQL-Queries einzeln im Supabase SQL Editor ausführen:
1. audit_log Tabelle + RLS Policies
2. lieferanten Tabelle + RLS Policies  
3. ALTER TABLE lieferungen (3 neue Spalten: lieferant_id, freigabe_erteilt, freigabe_am)

#### TODO 2: Audit-Trail-Einträge beim Freigeben schreiben
**Abhängig von:** TODO 1 (audit_log Tabelle)  
**Was:** In `app/lieferung/freigabe/page.tsx` Funktion `handleFreigabe()` → nach `updateLieferung(...)` einen INSERT in `audit_log` schreiben:
```typescript
await supabase.from("audit_log").insert({
  user_id: user.id,
  user_email: user.email,
  aktion: "freigabe",
  entity_type: "lieferung",
  entity_id: lieferungId,
  details: { ersparnis_eur: ersparnis, notiz: notiz }
});
```
Außerdem `freigabe_erteilt: true` und `freigabe_am: new Date().toISOString()` in `updateLieferung` ergänzen.

#### TODO 3: Lieferanten-UI (CRUD-Seite)
**Abhängig von:** TODO 1 (lieferanten Tabelle)  
**Was:** Neue Seite `app/lieferanten/page.tsx` mit:
- Liste aller Lieferanten (Name, E-Mail, Telefon, aktiv/inaktiv)
- Formular: Lieferant anlegen/bearbeiten (Name, E-Mail, Telefon, IBAN, Liefertage, Kundennummer)
- Preislisten-Editor: Artikel → Preis pro Einheit (JSONB-Objekt)
- Löschen (nur Chef)
- Dashboard-Navigation-Link hinzufügen
**Datenbankfunktionen:** In `lib/database.ts` ergänzen:
```typescript
export async function getLieferanten()
export async function saveLieferant(data: Lieferant)
export async function updateLieferant(id: string, data: Partial<Lieferant>)
export async function deleteLieferant(id: string)
```
**Types:** Interface `Lieferant` in `lib/types.ts` ergänzen.

#### TODO 4: Preisabweichungs-Erkennung mit Lieferanten-Preisliste
**Abhängig von:** TODO 3 (Lieferanten + Preislisten)  
**Was:** In `app/lieferung/rechnung/page.tsx` nach der KI-Analyse: Rechnungspreise gegen Lieferanten-Preisliste vergleichen. Abweichungen > 1% hervorheben.  
**Wo:** Nach dem API-Call in `handleAnalyze()`, dann `updateLieferung(id, { rechnung_data: { ...data, preisabweichungen: [...] } })`.

#### TODO 5: Analytics-Charts
**Was:** `app/analytics/page.tsx` – Recharts-Charts hinzufügen (Recharts ist NICHT installiert – erst `npm install recharts` nötig):
- Linienchart: Ersparnis pro Lieferung über Zeit
- Balkendiagramm: Top-5 Abweichungslieferanten
- KPI-Kacheln vergrößern und visueller gestalten

#### TODO 6: PDF-Export als echtes PDF (nicht nur Druckdialog)
**Was:** Lieferbericht als strukturiertes PDF mit `pdf-lib` (bereits installiert) generieren.  
**Wo:** Button in `app/lieferung/detail/page.tsx`, API-Route `app/api/pdf-export/route.ts` erstellen.  
**Vorlage:** `app/api/pdf-to-images/` zeigt wie pdf-lib genutzt wird.

### MITTEL

#### TODO 7: DATEV-Export
**Was:** Freigegebene Rechnungen als DATEV-EXTF-Format exportieren.  
**Wo:** Neuer Button in `app/lieferung/detail/page.tsx` + API-Route `/api/datev-export`.  
**Format:** CSV mit DATEV-Kopfzeile (Buchungstext, Betrag, Steuer, Gegenkonto etc.)  
**Achtung:** Bedarf Rücksprache mit Nutzer für Kontonummern-Schema.

#### TODO 8: Push-Benachrichtigungen (Web Push)
**Was:** Bei neuer Lieferung / Abweichung → Browser-Push-Notification.  
**Nötig:** VAPID-Keys generieren, Service Worker (`public/sw.js`) erstellen, Subscription in Supabase speichern.

#### TODO 9: XRechnung in Rechnungs-Workflow integrieren
**Was:** In `app/lieferung/rechnung/page.tsx` zusätzlich XML-Upload erlauben (neben PDF). Bei .xml-Upload → `/api/erechnung` aufrufen statt `/api/rechnung` (KI-Analyse). Geparste Daten in Workflow einbinden.  
**Außerdem:** In `app/einstellungen/page.tsx` E-Rechnungs-Eingang erweitern – bei eingehenden E-Mails mit XML-Anhang automatisch `/api/erechnung` aufrufen.

### NIEDRIG

#### TODO 10: Multi-Standort / Filialen
**Was:** Team-Konzept auf mehrere Standorte erweitern. Neue `standorte` Tabelle in Supabase. Dashboard-Filter nach Standort.

#### TODO 11: Automatische Reklamations-E-Mail
**Was:** Nach Freigabe mit Abweichungen: E-Mail an Lieferant (via Resend, bereits installiert) mit Gutschriftsanforderung.  
**Nötig:** Lieferant-E-Mail aus lieferanten-Tabelle + E-Mail-Template.

---

## Pre-existing TypeScript-Fehler (NICHT von dieser Session)

Diese Fehler existierten vor unserer Arbeit und sollen NICHT angefasst werden:
- `app/dashboard/page.tsx` – war truncated in git, wurde restored
- `lib/database.ts` – war truncated in git, wurde restored  
- `app/team/page.tsx` – importiert `getAllUsers`, `updateUserRole`, `removeUserFromTeam` die nicht in database.ts existieren
- `app/api/wochen-bericht/route.ts` – `resend` Paket hat keine TypeScript-Deklarationen

---

## Umgebungsvariablen (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...
RESEND_API_KEY=...
```

---

## Wichtige Code-Konventionen

1. **Routing:** App Router (Next.js 16). Alle Seiten sind Client Components (`"use client"`).
2. **Auth:** `AuthGuard`-Komponente wrappen + `useSearchParams` immer in `<Suspense>` einwickeln.
3. **Datenbankzugriff:** Nur über Funktionen in `lib/database.ts`, nicht direkt `supabase.from()` in Komponenten.
4. **URL-Parameter-Pattern:** Alle Lieferungs-Workflow-Seiten übergeben `?id=UUID&date=YYYY-MM-DD`.
5. **Styling:** Tailwind v4, CSS-Variablen: `--accent` (grün), `--surface`, `--border`, `--muted`.
6. **Dateiänderungen:** IMMER über bash-Python-Skripte (siehe oben), NIE über Edit/Write-Tools.

---

## Nächste konkrete Arbeitsschritte

1. Supabase-Migration fertig ausführen (User macht das manuell)
2. `TODO 2` umsetzen (Audit-Trail beim Freigeben) – 30 min
3. `TODO 3` umsetzen (Lieferanten-UI) – 2–3 Stunden
4. `TODO 4` umsetzen (Preisabgleich mit Preisliste) – 1 Stunde
5. `TODO 5` umsetzen (Analytics-Charts) – 1 Stunde
