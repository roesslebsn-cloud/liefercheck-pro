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
}

export interface NichtGeliefertItem {
  artikel: string;
  grund: string;
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

export interface Standort {
  id?: string;
  user_id?: string;
  name: string;
  adresse?: string;
  aktiv?: boolean;
  erstellt_am?: string;
}
