import { supabase } from "./supabase";
import { PfandItem, LieferscheinAnalysis, Lieferung, EingehendeRechnung, UserSettings } from "./types";

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

export const calculateErsparnis = (rechnungData: any, lieferscheinData: any): number => {
  if (!rechnungData?.positionen || !lieferscheinData?.gelieferte_artikel) {
    return 0;
  }

  let ersparnis = 0;

  rechnungData.positionen.forEach((pos: any) => {
    const rechnungKey = normalizeArtikelKey(pos.artikel);
    const lieferscheinPos = lieferscheinData.gelieferte_artikel.find(
      (l: any) => normalizeArtikelKey(l.artikel) === rechnungKey
    );

    if (lieferscheinPos && pos.menge > lieferscheinPos.menge && pos.einzelpreis) {
      ersparnis += (pos.menge - lieferscheinPos.menge) * pos.einzelpreis;
    }
  });

  return ersparnis;
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
    return data;
  } catch (error) {
    console.error("Fehler beim Laden der eingehenden Rechnungen:", error);
    throw error;
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
    const { error } = await supabase
      .from("lieferungen")
      .delete()
      .eq("id", id);
    if (error) throw error;
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
export async function deleteLieferung(id: string) {
  try {
    const { error } = await supabase.from("lieferungen").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Fehler beim Loeschen:", error);
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
      const { count } = await supabase.from("user_settings").select("*", { count: "exact", head: true });
      const role = (count === 0 || count === null) ? "chef" : "mitarbeiter";
      await supabase.from("user_settings").insert({ user_id: user.id, role, wochen_bericht_aktiv: true });
    }
  } catch (e) {
    console.error("initUserSettings error:", e);
  }
}
    }
  } catch (e) {
    console.error("initUserSettings error:", e);
  }
}
