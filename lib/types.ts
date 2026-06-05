export interface PfandItem {
  name: string;
  marke: string;
  groesse: string;
  menge: number;
  typ: string;
  stueck_pro_kiste: number | null;
  unsicher: boolean;
  hinweis: string | null;
}

export interface PfandAnalysis {
  artikel: PfandItem[];
  gesamt_kisten: number;
  gesamt_faesser: boolean;
  mehrere_bereiche: boolean;
  analyse_hinweis: string;
}

export interface LieferscheinItem {
  artikel: string;
  menge: number;
  groesse: string;
  artikelnummer?: string;
  einheit?: string;
  menge_gedruckt?: number;
  korrigiert?: boolean;
  unsicher?: boolean;
}

export interface NichtGeliefertItem {
  artikel: string;
  grund: string;
  menge_gedruckt?: number;
}

export interface PfandEintrag {
  artikel: string;
  menge: number;
}

export interface LieferscheinAnalysis {
  gelieferte_artikel: LieferscheinItem[];
  nicht_geliefert: NichtGeliefertItem[];
  pfand_eintrage: PfandEintrag[];
}

export interface AbgleichItem {
  artikel: string;
  bestellt: number;
  geliefert: number;
  abweichung: number;
  status: "ok" | "abweichung" | "nicht_geliefert" | "nicht_bestellt";
}

export interface AbgleichAnalysis {
  abgleich: AbgleichItem[];
  zusammenfassung: {
    alles_ok: boolean;
    anzahl_abweichungen: number;
    hinweis: string;
  };
}

export interface Lieferung {
  id?: string;
  created_at?: string;
  status?: string;
  notiz?: string;
  pfand_items?: PfandAnalysis;
  lieferschein_data?: LieferscheinAnalysis;
  abgleich_data?: AbgleichAnalysis;
  rechnung_data?: any;
  ersparnis_eur?: number;
  freigabe_erteilt?: boolean;
  freigabe_am?: string;
  lieferant_id?: string;
  standort_id?: string;
}

export interface EingehendeRechnung {
  id?: string;
  user_id?: string;
  empfangen_am?: string;
  absender: string;
  betreff: string;
  anhang_name: string;
  status: "neu" | "verarbeitet" | "fehler";
  rechnung_data?: any;
}

export interface UserSettings {
  id?: string;
  user_id?: string;
  wochen_bericht_aktiv?: boolean;
  role?: "chef" | "mitarbeiter";
  vorname?: string;
  organisation_id?: string;
  zuletzt_aktiv?: string;
  aktiver_standort_id?: string;
}

export interface Organisation {
  id?: string;
  name: string;
  chef_user_id?: string;
  erstellt_am?: string;
  status?: "aktiv" | "gesperrt";
  features?: Record<string, boolean>;
  kontakt_email?: string;
  notiz?: string;
}

export interface PlattformEinstellungen {
  id?: number;
  ankuendigung_text?: string | null;
  ankuendigung_aktiv?: boolean;
  ankuendigung_typ?: "info" | "warnung" | "wartung";
  aktualisiert_am?: string;
}

export interface TeamEinladung {
  id?: string;
  organisation_id: string;
  eingeladen_von?: string;
  email: string;
  vorname?: string;
  rolle: "chef" | "mitarbeiter";
  token?: string;
  angenommen_am?: string;
  erstellt_am?: string;
  abgelaufen_am?: string;
}

export interface TeamMitglied {
  user_id: string;
  vorname?: string;
  role: "chef" | "mitarbeiter";
  zuletzt_aktiv?: string;
  email?: string;
}

export interface AuditLogEintrag {
  id: string;
  erstellt_am: string;
  user_id: string;
  user_email?: string;
  aktion: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any>;
}

export interface Lieferant {
  id?: string;
  user_id?: string;
  name: string;
  email?: string;
  telefon?: string;
  iban?: string;
  kundennummer?: string;
  liefertage?: string[];
  preisliste?: Record<string, number>;
  aktiv?: boolean;
  erstellt_am?: string;
}

export interface PreisHistorieEintrag {
  id?: string;
  erstellt_am?: string;
  lieferant_id: string;
  artikel: string;
  artikel_original?: string;
  einzelpreis: number;
  rechnung_datum?: string | null;
  lieferung_id?: string | null;
}

export interface Standort {
  id?: string;
  user_id?: string;
  name: string;
  adresse?: string;
  aktiv?: boolean;
  erstellt_am?: string;
}
