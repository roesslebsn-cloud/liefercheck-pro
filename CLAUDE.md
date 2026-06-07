# LieferCheck Pro – Projektstand für Claude

> **Zuletzt aktualisiert:** Juni 2026  
> **Stack:** Next.js 16 (App Router) · TypeScript · Supabase (Auth + PostgreSQL) · Tailwind CSS v4 · Anthropic SDK (Claude)  
> **Zweck:** KI-gestützte Lieferprüfungs-SaaS für Gastronomie-Betriebe. 5-Schritte-Workflow: Pfand → Lieferschein → Abgleich → Rechnung → Freigabe.

---

## Build-Status

**✅ Build sauber – `next build` läuft ohne Fehler oder TypeScript-Fehler.**

---

## Projektstruktur

```
liefercheck/
├── app/
│   ├── page.tsx                    # Login-Seite (Startseite)
│   ├── landing/page.tsx            # Öffentliche Marketing-Landingpage (/landing)
│   ├── setup/page.tsx              # Ersteinrichtung / Onboarding
│   ├── dashboard/page.tsx          # Hauptübersicht aller Lieferungen
│   ├── analytics/page.tsx          # Statistiken mit Recharts-Charts
│   ├── einstellungen/page.tsx      # Nutzereinstellungen + E-Mail-Rechnungseingang
│   ├── team/page.tsx               # Teamverwaltung + Einladungen
│   ├── lieferanten/page.tsx        # CRUD Lieferanten + Preislisten + Preishistorie-Chart
│   ├── standorte/page.tsx          # CRUD Standorte/Filialen
│   ├── admin/                      # Super-Admin Cockpit (Kunden, Plattform, Standorte)
│   ├── layout.tsx                  # Root Layout + PWA-Meta-Tags
│   ├── manifest.ts                 # PWA-Manifest
│   ├── globals.css                 # Globale Styles + Print-CSS
│   ├── components/
│   │   ├── AuthGuard.tsx           # Auth-Check + Sperr-Status-Check
│   │   ├── AppHeader.tsx           # Nav mit allen Links + Mobile-Menu
│   │   ├── ProgressBar.tsx         # 5-Schritte-Fortschrittsanzeige (URL-params)
│   │   ├── LoginForm.tsx
│   │   └── LogoutButton.tsx
│   ├── lieferung/
│   │   ├── neu/page.tsx            # Schritt 0: Lieferdatum wählen + Lieferung erstellen
│   │   ├── pfand/page.tsx          # Schritt 1: Pfand manuell erfassen
│   │   ├── lieferschein/page.tsx   # Schritt 2: Lieferschein-Foto → KI-Analyse
│   │   ├── abgleich/page.tsx       # Schritt 3: CSV-Upload → Soll-Ist-Vergleich
│   │   ├── rechnung/page.tsx       # Schritt 4: PDF/XML → KI oder XRechnung-Parse
│   │   ├── freigabe/page.tsx       # Schritt 5: Freigabe + Audit-Log-Eintrag
│   │   └── detail/page.tsx        # Detailansicht: PDF-Export, DATEV, Reklamation
│   └── api/
│       ├── analyze/                # KI-Analyse (Lieferschein, Abgleich)
│       ├── rechnung-eingang/       # E-Mail-Rechnungseingang-Webhook
│       ├── erechnung/route.ts      # XRechnung/ZUGFeRD Parser API
│       ├── pdf-to-images/          # PDF → Bilder Konvertierung
│       ├── pdf-export/route.ts     # Echter PDF-Export via pdf-lib
│       ├── datev-export/route.ts   # DATEV EXTF CSV-Export
│       ├── wochen-bericht/         # Automatischer Wochenbericht per E-Mail
│       ├── invite/                 # Team-Einladungen
│       ├── push-subscribe/         # Web Push Subscriptions speichern
│       ├── push-send/              # Web Push senden
│       ├── reklamation/            # Automatische Reklamations-E-Mail an Lieferant
│       ├── anfrage/erstellen/      # Chef erstellt Mitarbeiter-Anfrage
│       ├── anfrage/entscheiden/    # Admin genehmigt/ablehnt Anfrage
│       ├── passwort-aendern/       # Passwort-Änderung
│       ├── team/members/           # Team-Mitglieder laden (Service-Role)
│       ├── team/audit/             # Audit-Log eines Users laden (Chef)
│       ├── lieferung/delete/       # Lieferung löschen (Service-Role)
│       ├── org/ensure/             # Organisation sicherstellen (Selbstheilung)
│       └── admin/                  # Admin-API: orgs, create-chef, impersonate, etc.
├── lib/
│   ├── supabase.ts                 # Supabase-Client
│   ├── database.ts                 # Alle Datenbankfunktionen
│   ├── types.ts                    # TypeScript-Interfaces
│   ├── admin.ts                    # Super-Admin E-Mail-Check
│   └── erechnung.ts               # XRechnung/ZUGFeRD Parser (fast-xml-parser)
└── supabase_migrations.sql         # SQL für alle DB-Tabellen (Migrations 1–8)
```

---

## Supabase-Datenbankstruktur

### Bereits existierende Tabellen:
| Tabelle | Beschreibung |
|---|---|
| `lieferungen` | Kern-Tabelle, alle 5 Workflow-Schritte als JSONB-Spalten |
| `user_settings` | Nutzerrollen, E-Mail, Org, Vorname, zuletzt_aktiv, passwort_temporaer |
| `eingehende_rechnungen` | Über E-Mail eingegangene Rechnungen |

### Neue Tabellen (Migration muss noch ausgeführt werden):
```
audit_log           – GoBD-konformes Freigabe-Protokoll
lieferanten         – Stammdaten + Preislisten + Preishistorie
standorte           – Multi-Standort / Filialen
organisationen      – Mandantentrennung (jeder Chef = eine Org)
team_einladungen    – Mitarbeiter-Einladungen mit Token
mitarbeiter_anfragen – Chef-Anfragen für neue Mitarbeiter
preis_historie      – Automatische Preishistorie aus Rechnungen
plattform_einstellungen – Single-Row: globaler Ankündigungs-Banner
```

**Die SQL-Migrationsdatei:** `liefercheck/supabase_migrations.sql`  
**Status:** Muss in Supabase SQL Editor ausgeführt werden (Migrations 1–8, am besten einzeln).

---

## Was vollständig implementiert ist ✅

- **5-Schritte-Workflow** komplett (Pfand → Lieferschein → Abgleich → Rechnung → Freigabe)
- **URL-Parameter-Pattern** durch alle Schritte (`?id=UUID&date=YYYY-MM-DD`), kein localStorage
- **KI-Analyse** via Anthropic Claude für Lieferschein + Rechnung
- **XRechnung / ZUGFeRD** Parser – automatische Erkennung, kein KI-Token-Verbrauch
- **Audit-Trail** beim Freigeben – schreibt in `audit_log` (GoBD-konform)
- **Lieferanten-CRUD** mit Preislisten-Editor und Preishistorie-Chart
- **Preisabweichungs-Erkennung** – Rechnungspreise vs. Lieferanten-Preisliste (>1%)
- **Analytics-Charts** mit Recharts (Linienchart Ersparnis, Balken Abweichungen)
- **PDF-Export** via pdf-lib (echter PDF, nicht nur Druckdialog)
- **DATEV-Export** API Route
- **Reklamations-E-Mail** an Lieferant (via Resend)
- **Push-Benachrichtigungen** (Web Push API)
- **PWA** – installierbar auf Handy, Kamera-Capture
- **Admin-Cockpit** – Kunden verwalten, Org sperren, Feature-Flags, Plattform-Banner
- **Organisations-System** – Mandantentrennung, Team, Einladungen, Mitarbeiter-Anfragen
- **Standorte** – Multi-Standort-Verwaltung
- **Landingpage** unter `/landing`
- **Wochenbericht** per E-Mail (Resend)

---

## Einzige verbleibende Aufgabe: Supabase-Migration ausführen

Die App ist code-seitig **fertig**. Die Datenbank-Tabellen müssen noch angelegt werden.

**Schritt-für-Schritt:**
1. Öffne Supabase Dashboard → SQL Editor
2. Führe `supabase_migrations.sql` aus – Migration 1 bis 8 (am besten einzeln)
3. Prüfe im Table Editor: `organisationen`, `lieferanten`, `audit_log`, `preis_historie` etc. existieren

---

## Wichtige Code-Konventionen

1. **Routing:** App Router (Next.js 16). Alle Seiten sind Client Components (`"use client"`).
2. **Auth:** `AuthGuard`-Komponente wrappen + `useSearchParams` immer in `<Suspense>` einwickeln.
3. **Datenbankzugriff:** Nur über Funktionen in `lib/database.ts`.
4. **URL-Parameter-Pattern:** Alle Lieferungs-Workflow-Seiten: `?id=UUID&date=YYYY-MM-DD`.
5. **Styling:** Tailwind v4, CSS-Variablen: `--accent`, `--surface`, `--surface-elevated`, `--border`, `--muted`.
6. **Dateiänderungen:** Edit/Write-Tools funktionieren normal in dieser Umgebung.

---

## Umgebungsvariablen (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...
RESEND_API_KEY=...
VAPID_PUBLIC_KEY=...          # für Push-Notifications
VAPID_PRIVATE_KEY=...         # für Push-Notifications
SUPABASE_SERVICE_ROLE_KEY=... # für Admin-API-Routen
```
