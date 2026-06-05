import { supabase } from "./supabase";
import { PfandItem, LieferscheinAnalysis, Lieferung, EingehendeRechnung, UserSettings, Lieferant, Standort, Organisation, TeamEinladung, TeamMitglied, PreisHistorieEintrag, AuditLogEintrag, PlattformEinstellungen } from "./types";

// Helper function to normalize artikel names for matching
export const normalizeArtikelKey = (name: string): string => {
  if (!name) return "";
  let s = name.toLowerCase();
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/keg-anschluss|keg|anschluss/g, " ");
  s = s.replace(/,/g, ".");
  const sizeMatch = s.match(/(\d+\.?\d*)\s*l/);
  const size = sizeMatch ? sizeMatch[1] + "l" : "";
  s = s.replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  const words = s.split(" ").filter(w => !/^\d+\.?\d*l?$/.test(w));
  const base = words.slice(0, 2).join(" ");
  return (base + " " + size).trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// ERSPARNIS = erkannte Überzahlung.
// Definition (einheitlich in der ganzen App):
//   Für jede Rechnungsposition: wenn die BERECHNETE Menge (Rechnung) größer ist
//   als die TATSÄCHLICH GELIEFERTE Menge (Lieferschein), wäre die Differenz zu
//   viel bezahlt worden. Genau dieses Geld spart der Betrieb durch die Prüfung.
//     ersparnis = Σ  max(0, menge_rechnung − menge_geliefert) × einzelpreis
//   Wird ein berechneter Artikel gar nicht geliefert, gilt menge_geliefert = 0.
// Diese Funktion ist die EINZIGE Quelle der Wahrheit (Dashboard == Freigabe).
// ─────────────────────────────────────────────────────────────────────────────
export const calculateErsparnis = (rechnungData: any, lieferscheinData: any, _abgleichData?: any): number => {
  if (!rechnungData?.positionen || !Array.isArray(rechnungData.positionen)) return 0;
  const geliefert: any[] = lieferscheinData?.gelieferte_artikel || [];

  let ersparnis = 0;
  rechnungData.positionen.forEach((pos: any) => {
    const preis = Number(pos.einzelpreis);
    const mengeRechnung = Number(pos.menge);
    if (!preis || !mengeRechnung) return;

    const key = normalizeArtikelKey(pos.artikel);
    const lsPos = geliefert.find((l: any) => normalizeArtikelKey(l.artikel) === key);
    const mengeGeliefert = lsPos ? Number(lsPos.menge) || 0 : 0;

    if (mengeRechnung > mengeGeliefert) {
      ersparnis += (mengeRechnung - mengeGeliefert) * preis;
    }
  });

  return Math.round(ersparnis * 100) / 100;
};

export async function saveLieferung(data: Lieferung) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht eingeloggt");

    const { data: result, error } = await supabase
      .from("lieferungen")
      .insert({
        pfand_items: data.pfand_items,
        lieferschein_data: data.lieferschein_data,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return result;
  } catch (error) {
    console.error("Fehler beim Speichern der Lieferung:", error);
    throw error;
  }
}

export async function updateLieferung(id: string, data: Partial<Lieferung>) {
  try {
    const { data: result, error } = await supabase
      .from("lieferungen")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return result;
  } catch (error) {
    console.error("Fehler beim Aktualisieren der Lieferung:", error);
    throw error;
  }
}

export async function getAllLieferungen() {
  try {
    const { data, error } = await supabase
      .from("lieferungen")
      .select("*")
      .order("erstellt_am", { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Fehler beim Laden der Lieferungen:", error);
    throw error;
  }
}

export async function getLieferungById(id: string) {
  try {
    const { data, error } = await supabase
      .from("lieferungen")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Fehler beim Laden der Lieferung:", error);
    throw error;
  }
}

export async function saveEingehendeRechnung(data: EingehendeRechnung) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht eingeloggt");

    const { data: result, error } = await supabase
      .from("eingehende_rechnungen")
      .insert({
        user_id: user.id,
        absender: data.absender,
        betreff: data.betreff,
        anhang_name: data.anhang_name,
        status: data.status || "neu",
        rechnung_data: data.rechnung_data,
      })
      .select()
      .single();

    if (error) throw error;
    return result;
  } catch (error) {
    console.error("Fehler beim Speichern der eingehenden Rechnung:", error);
    throw error;
  }
}

export async function getEingehendeRechnungen() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht eingeloggt");

    const { data, error } = await supabase
      .from("eingehende_rechnungen")
      .select("*")
      .eq("user_id", user.id)
      .order("empfangen_am", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}

export async function updateEingehendeRechnung(id: string, data: Partial<EingehendeRechnung>) {
  try {
    const { data: result, error } = await supabase
      .from("eingehende_rechnungen")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return result;
  } catch (error) {
    console.error("Fehler beim Aktualisieren der eingehenden Rechnung:", error);
    throw error;
  }
}

export async function getUserSettings() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht eingeloggt");

    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 means no rows found, which is ok for first-time users
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Fehler beim Laden der Benutzereinstellungen:", error);
    throw error;
  }
}

export async function updateUserSettings(data: Partial<UserSettings>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht eingeloggt");

    const { data: existing } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from("user_settings")
        .update(data)
        .eq("user_id", user.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("user_settings")
        .insert({ ...data, user_id: user.id })
        .select()
        .single();
    }

    if (result.error) throw result.error;
    return result.data;
  } catch (error) {
    console.error("Fehler beim Aktualisieren der Benutzereinstellungen:", error);
    throw error;
  }
}

export async function deleteLieferung(id: string) {
  try {
    // Loeschen laeuft ueber eine Service-Role-Route (Chef-verifiziert),
    // damit es unabhaengig von RLS-Policies zuverlaessig funktioniert.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Nicht eingeloggt");
    const res = await fetch("/api/lieferung/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Löschen fehlgeschlagen");
    }
  } catch (error) {
    console.error("Fehler beim Löschen der Lieferung:", error);
    throw error;
  }
}

export async function getUserRole(): Promise<"chef" | "mitarbeiter"> {
  try {
    const settings = await getUserSettings();
    return (settings?.role as "chef" | "mitarbeiter") || "mitarbeiter";
  } catch {
    return "mitarbeiter";
  }
}

export async function initUserSettingsIfNeeded() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("user_settings").select("id").eq("user_id", user.id).single();
    if (!data) {
      // First user in the system = chef
      const { count } = await supabase.from("user_settings").select("*", { count: "exact", head: true });
      const role = (count === 0 || count === null) ? "chef" : "mitarbeiter";
      await supabase.from("user_settings").insert({ user_id: user.id, role, wochen_bericht_aktiv: true });
    }
  } catch (e) {
    console.error("initUserSettings error:", e);
  }
}

// Stellt sicher, dass der eingeloggte Chef einer Organisation angehoert
// (Selbstheilung gegen "Team (0)" bei Alt-Accounts).
export async function ensureOrganisation(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/org/ensure", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    // still – darf den Dashboard-Load nie blockieren
  }
}

export async function getLieferanten(): Promise<Lieferant[]> {
  try {
    const { data, error } = await supabase
      .from("lieferanten")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Fehler beim Laden der Lieferanten:", error);
    throw error;
  }
}

export async function saveLieferant(data: Omit<Lieferant, "id" | "user_id" | "erstellt_am">) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht eingeloggt");
    const { data: result, error } = await supabase
      .from("lieferanten")
      .insert({ ...data, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return result;
  } catch (error) {
    console.error("Fehler beim Speichern des Lieferanten:", error);
    throw error;
  }
}

export async function updateLieferant(id: string, data: Partial<Lieferant>) {
  try {
    const { data: result, error } = await supabase
      .from("lieferanten")
      .update(data)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return result;
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Lieferanten:", error);
    throw error;
  }
}

export async function deleteLieferant(id: string) {
  try {
    const { error } = await supabase
      .from("lieferanten")
      .delete()
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Fehler beim Löschen des Lieferanten:", error);
    throw error;
  }
}

export async function getStandorte(): Promise<Standort[]> {
  try {
    const { data, error } = await supabase
      .from("standorte")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Fehler beim Laden der Standorte:", error);
    return [];
  }
}

export async function saveStandort(data: Omit<Standort, "id" | "user_id" | "erstellt_am">) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht eingeloggt");
    const { data: result, error } = await supabase
      .from("standorte")
      .insert({ ...data, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return result;
  } catch (error) {
    console.error("Fehler beim Speichern des Standorts:", error);
    throw error;
  }
}

export async function updateStandort(id: string, data: Partial<Standort>) {
  try {
    const { data: result, error } = await supabase
      .from("standorte")
      .update(data)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return result;
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Standorts:", error);
    throw error;
  }
}

export async function deleteStandort(id: string) {
  try {
    const { error } = await supabase
      .from("standorte")
      .delete()
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Fehler beim Loeschen des Standorts:", error);
    throw error;
  }
}

export async function getAllUsers(): Promise<any[]> {
  try {
    const settings = await getUserSettings();
    let query = supabase.from("user_settings").select("*").order("erstellt_am", { ascending: true });
    if (settings?.organisation_id) {
      query = query.eq("organisation_id", settings.organisation_id);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Fehler beim Laden der Nutzer:", error);
    return [];
  }
}

export async function updateUserRole(userId: string, role: "chef" | "mitarbeiter"): Promise<void> {
  try {
    const { error } = await supabase
      .from("user_settings")
      .update({ role })
      .eq("user_id", userId);
    if (error) throw error;
  } catch (error) {
    console.error("Fehler beim Aktualisieren der Rolle:", error);
    throw error;
  }
}

export async function removeUserFromTeam(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("user_settings")
      .delete()
      .eq("user_id", userId);
    if (error) throw error;
  } catch (error) {
    console.error("Fehler beim Entfernen des Nutzers:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ORGANISATIONEN + TEAM-SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

export async function getMyOrganisation(): Promise<Organisation | null> {
  try {
    const settings = await getUserSettings();
    if (!settings?.organisation_id) return null;
    const { data, error } = await supabase
      .from("organisationen")
      .select("*")
      .eq("id", settings.organisation_id)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Fehler beim Laden der Organisation:", error);
    return null;
  }
}

export async function updateMyOrganisation(name: string): Promise<void> {
  const org = await getMyOrganisation();
  if (!org?.id) throw new Error("Keine Organisation gefunden");
  const { error } = await supabase
    .from("organisationen")
    .update({ name })
    .eq("id", org.id);
  if (error) throw error;
}

export async function getTeamMitglieder(): Promise<TeamMitglied[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const res = await fetch("/api/team/members", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("Fehler beim Laden des Teams:", error);
    return [];
  }
}

// Audit-Protokoll eines Mitarbeiters laden (nur Chef, via Service-Role-Route)
export async function getAuditLogFuerUser(userId: string): Promise<AuditLogEintrag[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const res = await fetch(`/api/team/audit?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("Fehler beim Laden des Audit-Logs:", error);
    return [];
  }
}

export async function updateMyVorname(vorname: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");
  const { error } = await supabase
    .from("user_settings")
    .update({ vorname })
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function markZuletztAktiv(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("user_settings")
      .update({ zuletzt_aktiv: new Date().toISOString() })
      .eq("user_id", user.id);
  } catch (e) {
    // silent
  }
}

export async function getOffeneEinladungen(): Promise<TeamEinladung[]> {
  try {
    const { data, error } = await supabase
      .from("team_einladungen")
      .select("*")
      .is("angenommen_am", null)
      .order("erstellt_am", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Fehler beim Laden der Einladungen:", error);
    return [];
  }
}

export async function deleteEinladung(id: string): Promise<void> {
  const { error } = await supabase
    .from("team_einladungen")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════════════════
// PREISHISTORIE – stumme automatische Befüllung aus Rechnungen
// ═══════════════════════════════════════════════════════════════════════════

export async function findLieferantByEmail(email: string): Promise<Lieferant | null> {
  if (!email) return null;
  try {
    const { data } = await supabase
      .from("lieferanten")
      .select("*")
      .ilike("email", email.trim().toLowerCase())
      .limit(1);
    return data?.[0] || null;
  } catch {
    return null;
  }
}

export async function findLieferantByName(name: string): Promise<Lieferant | null> {
  if (!name) return null;
  try {
    const { data } = await supabase
      .from("lieferanten")
      .select("*")
      .order("name");
    if (!data || data.length === 0) return null;
    const normalizedInput = normalizeArtikelKey(name);
    const match = data.find((l: any) => {
      const normalizedName = normalizeArtikelKey(l.name);
      return normalizedName.includes(normalizedInput.split(" ")[0]) ||
             normalizedInput.includes(normalizedName.split(" ")[0]);
    });
    return match || null;
  } catch {
    return null;
  }
}

export async function speicherPreisHistorie(
  lieferantId: string,
  positionen: { artikel: string; einzelpreis: number | null }[],
  rechnungDatum: string | null,
  lieferungId?: string
): Promise<void> {
  try {
    const valid = positionen.filter(p => p.einzelpreis != null && p.einzelpreis > 0);
    if (valid.length === 0) return;

    const rows = valid.map(p => ({
      lieferant_id: lieferantId,
      artikel: normalizeArtikelKey(p.artikel),
      artikel_original: p.artikel,
      einzelpreis: p.einzelpreis,
      rechnung_datum: rechnungDatum || null,
      lieferung_id: lieferungId || null,
    }));

    await supabase.from("preis_historie").insert(rows);

    const neuePreise: Record<string, number> = {};
    valid.forEach(p => { neuePreise[p.artikel] = p.einzelpreis!; });

    const { data: lieferant } = await supabase
      .from("lieferanten")
      .select("preisliste")
      .eq("id", lieferantId)
      .single();

    const merged = { ...(lieferant?.preisliste || {}), ...neuePreise };
    await supabase.from("lieferanten").update({ preisliste: merged }).eq("id", lieferantId);
  } catch (e) {
    console.error("speicherPreisHistorie:", e);
  }
}

export async function getPreisHistorie(lieferantId: string, artikel?: string): Promise<PreisHistorieEintrag[]> {
  try {
    let query = supabase
      .from("preis_historie")
      .select("*")
      .eq("lieferant_id", lieferantId)
      .order("erstellt_am", { ascending: false })
      .limit(200);
    if (artikel) {
      query = (query as any).eq("artikel", normalizeArtikelKey(artikel));
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("getPreisHistorie:", e);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT-LOG (GoBD) – zentrale Helfer
// ═══════════════════════════════════════════════════════════════════════════

export async function logAudit(
  aktion: string,
  entityType: string,
  entityId: string,
  details: Record<string, any> = {}
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      user_id: user?.id,
      user_email: user?.email,
      aktion,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch (e) {
    console.error("logAudit:", e);
  }
}

export async function getLetzterAuditEintrag(entityId: string, aktion: string): Promise<any | null> {
  try {
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .eq("entity_id", entityId)
      .eq("aktion", aktion)
      .order("erstellt_am", { ascending: false })
      .limit(1);
    return data?.[0] || null;
  } catch (e) {
    console.error("getLetzterAuditEintrag:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PREISABWEICHUNGEN – Rechnungspreise gegen Lieferanten-Preisliste (>1%)
// ═══════════════════════════════════════════════════════════════════════════

export function berechnePreisabweichungen(
  positionen: any[],
  lieferanten: Lieferant[],
  lieferantName?: string
): any[] {
  if (!positionen || positionen.length === 0 || lieferanten.length === 0) return [];

  const matched = lieferanten.find(l =>
    lieferantName && l.name.toLowerCase().includes(lieferantName.toLowerCase().split(" ")[0])
  );
  if (!matched?.preisliste || Object.keys(matched.preisliste).length === 0) return [];

  const abweichungen: any[] = [];
  positionen.forEach((pos: any) => {
    const posKey = normalizeArtikelKey(pos.artikel);
    const eintrag = Object.entries(matched.preisliste!).find(
      ([artikel]) => normalizeArtikelKey(artikel) === posKey
    );
    if (eintrag && pos.einzelpreis) {
      const raw = eintrag[1] as any;
      const listePreis = typeof raw === "object" ? raw.einzelpreis : raw;
      if (!listePreis) return;
      const diff = Math.abs(pos.einzelpreis - listePreis);
      const diffProzent = (diff / listePreis) * 100;
      if (diffProzent > 1) {
        abweichungen.push({
          artikel: pos.artikel,
          preis_rechnung: pos.einzelpreis,
          preis_liste: listePreis,
          abweichung_eur: +(pos.einzelpreis - listePreis).toFixed(2),
          abweichung_prozent: +diffProzent.toFixed(1),
        });
      }
    }
  });
  return abweichungen;
}

// ─── Plattform-Banner & Sperr-Status (vom Admin gesteuert) ───────────────────

// Aktive globale Ankündigung (oder null). Liest plattform_einstellungen (id=1).
export async function getAktiveAnkuendigung(): Promise<PlattformEinstellungen | null> {
  const { data, error } = await supabase
    .from("plattform_einstellungen")
    .select("ankuendigung_text, ankuendigung_aktiv, ankuendigung_typ")
    .eq("id", 1)
    .single();
  if (error || !data || !data.ankuendigung_aktiv || !data.ankuendigung_text) return null;
  return data as PlattformEinstellungen;
}

// Status der eigenen Organisation ("aktiv" | "gesperrt" | null wenn keine Org).
// Genutzt vom AuthGuard, um gesperrte Kunden auszusperren.
export async function getMeineOrgStatus(): Promise<"aktiv" | "gesperrt" | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: settings } = await supabase
    .from("user_settings")
    .select("organisation_id")
    .eq("user_id", user.id)
    .single();
  if (!settings?.organisation_id) return null;
  const { data: org } = await supabase
    .from("organisationen")
    .select("status")
    .eq("id", settings.organisation_id)
    .single();
  return (org?.status as "aktiv" | "gesperrt") || "aktiv";
}

// Feature-Flags der eigenen Organisation. Default: alles an ({}).
// Ein Feature gilt als deaktiviert, wenn features[key] === false.
export async function getMeineFeatures(): Promise<Record<string, boolean>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data: settings } = await supabase
    .from("user_settings")
    .select("organisation_id")
    .eq("user_id", user.id)
    .single();
  if (!settings?.organisation_id) return {};
  const { data: org } = await supabase
    .from("organisationen")
    .select("features")
    .eq("id", settings.organisation_id)
    .single();
  return (org?.features as Record<string, boolean>) || {};
}
