-- ═══════════════════════════════════════════════════════════════════════════
-- LieferCheck Pro - Supabase Migrations
-- ═══════════════════════════════════════════════════════════════════════════
-- Anleitung: Jede Migration einzeln in Supabase SQL Editor ausfuehren.
-- Jeder Block ist idempotent (mehrfach ausfuehrbar ohne Fehler).
-- Reihenfolge: 1 -> 2 -> 3 -> 4
-- ═══════════════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────────────────
-- MIGRATION 1: audit_log
-- Was: Unveraenderliches Protokoll aller Freigaben/Aenderungen (GoBD-Pflicht)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erstellt_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   TEXT,
  aktion       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  details      JSONB,
  ip_adresse   TEXT
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jeder darf eigene Logs lesen" ON public.audit_log;
CREATE POLICY "Jeder darf eigene Logs lesen"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id OR is_chef());

DROP POLICY IF EXISTS "System darf Logs schreiben" ON public.audit_log;
CREATE POLICY "System darf Logs schreiben"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON public.audit_log(erstellt_am DESC);


-- ──────────────────────────────────────────────────────────────────────────
-- MIGRATION 2: lieferanten
-- Was: Lieferanten-Stammdaten mit Preislisten fuer Preisabgleich
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lieferanten (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT,
  telefon         TEXT,
  kontakt_person  TEXT,
  liefertage      TEXT[],
  kundennummer    TEXT,
  iban            TEXT,
  notizen         TEXT,
  aktiv           BOOLEAN NOT NULL DEFAULT true,
  preisliste      JSONB
);

ALTER TABLE public.lieferanten ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User sieht eigene Lieferanten" ON public.lieferanten;
CREATE POLICY "User sieht eigene Lieferanten"
  ON public.lieferanten FOR SELECT
  USING (auth.uid() = user_id OR is_chef());

DROP POLICY IF EXISTS "User erstellt eigene Lieferanten" ON public.lieferanten;
CREATE POLICY "User erstellt eigene Lieferanten"
  ON public.lieferanten FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "User aktualisiert eigene Lieferanten oder Chef alle" ON public.lieferanten;
CREATE POLICY "User aktualisiert eigene Lieferanten oder Chef alle"
  ON public.lieferanten FOR UPDATE
  USING (auth.uid() = user_id OR is_chef());

DROP POLICY IF EXISTS "User loescht eigene Lieferanten oder Chef alle" ON public.lieferanten;
CREATE POLICY "User loescht eigene Lieferanten oder Chef alle"
  ON public.lieferanten FOR DELETE
  USING (auth.uid() = user_id OR is_chef());

CREATE OR REPLACE FUNCTION public.update_aktualisiert_am()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.aktualisiert_am = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lieferanten_aktualisiert_am ON public.lieferanten;
CREATE TRIGGER lieferanten_aktualisiert_am
  BEFORE UPDATE ON public.lieferanten
  FOR EACH ROW EXECUTE FUNCTION public.update_aktualisiert_am();


-- ──────────────────────────────────────────────────────────────────────────
-- MIGRATION 3: lieferungen - neue Spalten
-- Was: lieferant_id, freigabe_erteilt, freigabe_am
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.lieferungen
  ADD COLUMN IF NOT EXISTS lieferant_id UUID REFERENCES public.lieferanten(id) ON DELETE SET NULL;

ALTER TABLE public.lieferungen
  ADD COLUMN IF NOT EXISTS freigabe_erteilt BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.lieferungen
  ADD COLUMN IF NOT EXISTS freigabe_am TIMESTAMPTZ;


-- ──────────────────────────────────────────────────────────────────────────
-- MIGRATION 4: standorte (Multi-Standort / Filialen)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.standorte (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  adresse      TEXT,
  aktiv        BOOLEAN NOT NULL DEFAULT true,
  erstellt_am  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.standorte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User sieht eigene Standorte oder Chef alle" ON public.standorte;
CREATE POLICY "User sieht eigene Standorte oder Chef alle"
  ON public.standorte FOR SELECT
  USING (auth.uid() = user_id OR is_chef());

DROP POLICY IF EXISTS "User erstellt eigene Standorte" ON public.standorte;
CREATE POLICY "User erstellt eigene Standorte"
  ON public.standorte FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "User aktualisiert eigene Standorte oder Chef alle" ON public.standorte;
CREATE POLICY "User aktualisiert eigene Standorte oder Chef alle"
  ON public.standorte FOR UPDATE
  USING (auth.uid() = user_id OR is_chef());

DROP POLICY IF EXISTS "Nur Chef loescht Standorte" ON public.standorte;
CREATE POLICY "Nur Chef loescht Standorte"
  ON public.standorte FOR DELETE
  USING (is_chef());

ALTER TABLE public.lieferungen
  ADD COLUMN IF NOT EXISTS standort_id UUID REFERENCES public.standorte(id) ON DELETE SET NULL;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS aktiver_standort_id UUID REFERENCES public.standorte(id) ON DELETE SET NULL;


-- ──────────────────────────────────────────────────────────────────────────
-- MIGRATION 5: Organisationen + Mandantentrennung + Team-System
-- Was:
--  * Jeder Chef = eine Organisation. Mitarbeiter erben organisation_id.
--  * user_settings bekommt vorname, organisation_id, zuletzt_aktiv
--  * Alle Datentabellen bekommen organisation_id + RLS-Policy "nur eigene Org"
--  * team_einladungen Tabelle fuer Mitarbeiter-Einladungen mit Token
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organisationen (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  chef_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organisationen ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS vorname TEXT,
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisationen(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zuletzt_aktiv TIMESTAMPTZ;

ALTER TABLE public.lieferungen
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisationen(id) ON DELETE SET NULL;

ALTER TABLE public.lieferanten
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisationen(id) ON DELETE SET NULL;

ALTER TABLE public.standorte
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisationen(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.get_my_organisation()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organisation_id FROM public.user_settings WHERE user_id = auth.uid() LIMIT 1;
$$;

DROP POLICY IF EXISTS "Org sieht sich selbst" ON public.organisationen;
CREATE POLICY "Org sieht sich selbst"
  ON public.organisationen FOR SELECT
  USING (id = public.get_my_organisation());

DROP POLICY IF EXISTS "Chef bearbeitet eigene Org" ON public.organisationen;
CREATE POLICY "Chef bearbeitet eigene Org"
  ON public.organisationen FOR UPDATE
  USING (id = public.get_my_organisation() AND is_chef());

CREATE TABLE IF NOT EXISTS public.team_einladungen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisationen(id) ON DELETE CASCADE,
  eingeladen_von  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email           TEXT NOT NULL,
  vorname         TEXT,
  rolle           TEXT NOT NULL DEFAULT 'mitarbeiter',
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  angenommen_am   TIMESTAMPTZ,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  abgelaufen_am   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days')
);

ALTER TABLE public.team_einladungen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chef sieht eigene Einladungen" ON public.team_einladungen;
CREATE POLICY "Chef sieht eigene Einladungen"
  ON public.team_einladungen FOR SELECT
  USING (organisation_id = public.get_my_organisation() AND is_chef());

DROP POLICY IF EXISTS "Chef erstellt Einladungen" ON public.team_einladungen;
CREATE POLICY "Chef erstellt Einladungen"
  ON public.team_einladungen FOR INSERT
  WITH CHECK (organisation_id = public.get_my_organisation() AND is_chef());

DROP POLICY IF EXISTS "Chef loescht Einladungen" ON public.team_einladungen;
CREATE POLICY "Chef loescht Einladungen"
  ON public.team_einladungen FOR DELETE
  USING (organisation_id = public.get_my_organisation() AND is_chef());

CREATE INDEX IF NOT EXISTS idx_team_einladungen_token ON public.team_einladungen(token);
CREATE INDEX IF NOT EXISTS idx_team_einladungen_email ON public.team_einladungen(email);

-- Aktualisiere user_settings RLS: Mitarbeiter sehen alle der gleichen Org (fuer Team-Anzeige)
DROP POLICY IF EXISTS "User sieht eigene Settings" ON public.user_settings;
DROP POLICY IF EXISTS "Org-Mitglieder sehen sich gegenseitig" ON public.user_settings;
CREATE POLICY "Org-Mitglieder sehen sich gegenseitig"
  ON public.user_settings FOR SELECT
  USING (user_id = auth.uid() OR organisation_id = public.get_my_organisation());

DROP POLICY IF EXISTS "User aktualisiert eigene Settings" ON public.user_settings;
CREATE POLICY "User aktualisiert eigene Settings"
  ON public.user_settings FOR UPDATE
  USING (user_id = auth.uid() OR (organisation_id = public.get_my_organisation() AND is_chef()));

-- Aktualisiere RLS auf Lieferungen/Lieferanten/Standorte: organisation_id-basiert
DROP POLICY IF EXISTS "User sieht eigene Lieferungen oder Chef alle" ON public.lieferungen;
DROP POLICY IF EXISTS "Org sieht eigene Lieferungen" ON public.lieferungen;
CREATE POLICY "Org sieht eigene Lieferungen"
  ON public.lieferungen FOR SELECT
  USING (
    organisation_id = public.get_my_organisation()
    OR (organisation_id IS NULL AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "User sieht eigene Lieferanten" ON public.lieferanten;
DROP POLICY IF EXISTS "Org sieht eigene Lieferanten" ON public.lieferanten;
CREATE POLICY "Org sieht eigene Lieferanten"
  ON public.lieferanten FOR SELECT
  USING (
    organisation_id = public.get_my_organisation()
    OR (organisation_id IS NULL AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "User sieht eigene Standorte oder Chef alle" ON public.standorte;
DROP POLICY IF EXISTS "Org sieht eigene Standorte" ON public.standorte;
CREATE POLICY "Org sieht eigene Standorte"
  ON public.standorte FOR SELECT
  USING (
    organisation_id = public.get_my_organisation()
    OR (organisation_id IS NULL AND auth.uid() = user_id)
  );


-- ──────────────────────────────────────────────────────────────────────────
-- MIGRATION 6: Mitarbeiter-Anfragen + temporaeres Passwort
-- Was:
--  * Chef stellt Anfrage zur Mitarbeiter-Erstellung -> Admin approved per Email-Link
--  * user_settings.passwort_temporaer flag fuer roten Banner
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS passwort_temporaer BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.mitarbeiter_anfragen (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES public.organisationen(id) ON DELETE CASCADE,
  angefragt_von     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  angefragt_von_email TEXT,
  email             TEXT NOT NULL,
  vorname           TEXT,
  passwort          TEXT NOT NULL,
  rolle             TEXT NOT NULL DEFAULT 'mitarbeiter',
  status            TEXT NOT NULL DEFAULT 'pending',
  approval_token    TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  bearbeitet_am     TIMESTAMPTZ,
  bearbeitet_von    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  erstellt_am       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mitarbeiter_anfragen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chef sieht eigene Anfragen" ON public.mitarbeiter_anfragen;
CREATE POLICY "Chef sieht eigene Anfragen"
  ON public.mitarbeiter_anfragen FOR SELECT
  USING (organisation_id = public.get_my_organisation() AND is_chef());

DROP POLICY IF EXISTS "Chef erstellt Anfragen" ON public.mitarbeiter_anfragen;
CREATE POLICY "Chef erstellt Anfragen"
  ON public.mitarbeiter_anfragen FOR INSERT
  WITH CHECK (organisation_id = public.get_my_organisation() AND is_chef());

CREATE INDEX IF NOT EXISTS idx_mitarbeiter_anfragen_token ON public.mitarbeiter_anfragen(approval_token);
CREATE INDEX IF NOT EXISTS idx_mitarbeiter_anfragen_status ON public.mitarbeiter_anfragen(status);


-- ──────────────────────────────────────────────────────────────────────────
-- MIGRATION 7: preis_historie
-- Was: Automatische Preishistorie pro Lieferant – wird stumm aus Rechnungen befuellt
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.preis_historie (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erstellt_am      TIMESTAMPTZ NOT NULL DEFAULT now(),
  lieferant_id     UUID NOT NULL REFERENCES public.lieferanten(id) ON DELETE CASCADE,
  artikel          TEXT NOT NULL,
  artikel_original TEXT,
  einzelpreis      NUMERIC NOT NULL,
  rechnung_datum   DATE,
  lieferung_id     UUID REFERENCES public.lieferungen(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_preis_historie_lieferant ON public.preis_historie(lieferant_id);
CREATE INDEX IF NOT EXISTS idx_preis_historie_artikel   ON public.preis_historie(lieferant_id, artikel);
CREATE INDEX IF NOT EXISTS idx_preis_historie_datum     ON public.preis_historie(lieferant_id, erstellt_am DESC);

ALTER TABLE public.preis_historie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Eigene Preishistorie lesen" ON public.preis_historie;
CREATE POLICY "Eigene Preishistorie lesen"
  ON public.preis_historie FOR ALL
  USING (
    lieferant_id IN (
      SELECT id FROM public.lieferanten
      WHERE user_id = auth.uid()
         OR organisation_id = public.get_my_organisation()
    )
  );


-- ──────────────────────────────────────────────────────────────────────────
-- MIGRATION 8: Admin-Cockpit (Kunden-Status, Feature-Flags, Plattform-Banner)
-- Was:
--  * organisationen bekommt status (aktiv/gesperrt), features (JSONB), kontakt_email, notiz
--  * plattform_einstellungen: Single-Row-Tabelle fuer globalen Ankuendigungs-Banner
-- Hinweis: Schreibzugriff auf beide ausschliesslich ueber Service-Role (Admin-API).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organisationen
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'aktiv',   -- 'aktiv' | 'gesperrt'
  ADD COLUMN IF NOT EXISTS features      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS kontakt_email TEXT,
  ADD COLUMN IF NOT EXISTS notiz         TEXT;

CREATE TABLE IF NOT EXISTS public.plattform_einstellungen (
  id                 INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- erzwingt Single-Row
  ankuendigung_text  TEXT,
  ankuendigung_aktiv BOOLEAN NOT NULL DEFAULT false,
  ankuendigung_typ   TEXT NOT NULL DEFAULT 'info',              -- 'info' | 'warnung' | 'wartung'
  aktualisiert_am    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plattform_einstellungen ENABLE ROW LEVEL SECURITY;

-- Lesen duerfen alle eingeloggten Nutzer (fuer den Banner im Dashboard).
-- Schreiben passiert ausschliesslich per Service-Role (umgeht RLS) -> keine Write-Policy noetig.
DROP POLICY IF EXISTS "Jeder liest Plattform-Einstellungen" ON public.plattform_einstellungen;
CREATE POLICY "Jeder liest Plattform-Einstellungen"
  ON public.plattform_einstellungen FOR SELECT
  USING (auth.role() = 'authenticated');

INSERT INTO public.plattform_einstellungen (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- FERTIG. Pruefe in Supabase Table Editor:
--   - 'organisationen', 'team_einladungen', 'mitarbeiter_anfragen' existieren
--   - 'user_settings' hat vorname, organisation_id, zuletzt_aktiv, passwort_temporaer
--   - 'lieferungen', 'lieferanten', 'standorte' haben organisation_id
--   - 'preis_historie' existiert mit Indizes und RLS
--   - 'organisationen' hat status, features, kontakt_email, notiz
--   - 'plattform_einstellungen' existiert mit genau einer Zeile (id=1)
-- ═══════════════════════════════════════════════════════════════════════════
