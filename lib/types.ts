export interface PfandItem {
  artikel: string;
  menge: number;
  typ: string;
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

export interface Lieferung {
  id?: string;
  created_at?: string;
  pfand_items?: PfandItem[];
  lieferschein_data?: LieferscheinAnalysis;
}
