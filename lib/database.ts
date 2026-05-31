import { supabase } from "./supabase";
import { PfandItem, LieferscheinAnalysis, Lieferung } from "./types";

export async function saveLieferung(data: Lieferung) {
  try {
    const { data: result, error } = await supabase
      .from("lieferungen")
      .insert({
        pfand_items: data.pfand_items,
        lieferschein_data: data.lieferschein_data,
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
