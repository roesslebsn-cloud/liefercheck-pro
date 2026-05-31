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