-- Migration 1: user_settings Tabelle anlegen
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  wochen_bericht_aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Nutzer sieht nur eigene Settings
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Migration 2: ersparnis_eur Spalte zur lieferungen Tabelle hinzufügen
ALTER TABLE public.lieferungen
  ADD COLUMN IF NOT EXISTS ersparnis_eur NUMERIC(10, 2) DEFAULT 0;
