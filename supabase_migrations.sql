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


-- ═══════════════════════════════════════════════════════════════════════════
-- FERTIG. Pruefe in Supabase Table Editor ob 'audit_log', 'lieferanten',
-- 'standorte' existieren und ob 'lieferungen' die neuen Spalten hat.
-- ═══════════════════════════════════════════════════════════════════════════
