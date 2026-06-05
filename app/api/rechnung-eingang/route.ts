import { NextRequest, NextResponse } from "next/server";
import { saveEingehendeRechnung, findLieferantByEmail, findLieferantByName, speicherPreisHistorie } from "../../../lib/database";
import { parseERechnung, extractZUGFeRDFromPDF } from "../../../lib/erechnung";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { absender, betreff, anhang_base64, anhang_name, user_id } = body;

    if (!absender || !betreff || !anhang_base64 || !anhang_name) {
      return NextResponse.json(
        { error: "Fehlende erforderliche Felder" },
        { status: 400 }
      );
    }

    let rechnungData: any = null;
    const isXml = anhang_name.toLowerCase().endsWith(".xml");
    const isPdf = anhang_name.toLowerCase().endsWith(".pdf");

    if (isXml) {
      // Direkt als XML parsen
      try {
        const xmlString = Buffer.from(anhang_base64, "base64").toString("utf-8");
        const parsed = parseERechnung(xmlString);
        rechnungData = erechnungToRechnungData(parsed);
      } catch (e) {
        console.error("[RechnungEingang] XML-Parse-Fehler:", e);
        rechnungData = await analyzeWithAI(anhang_base64);
      }
    } else if (isPdf) {
      // Erst ZUGFeRD versuchen, dann KI-Fallback
      try {
        const xmlString = await extractZUGFeRDFromPDF(anhang_base64);
        if (xmlString) {
          const parsed = parseERechnung(xmlString);
          rechnungData = erechnungToRechnungData(parsed);
        }
      } catch {
        // kein ZUGFeRD – ignorieren
      }

      if (!rechnungData) {
        rechnungData = await analyzeWithAI(anhang_base64);
      }
    } else {
      // Bild oder unbekannt – KI
      rechnungData = await analyzeWithAI(anhang_base64);
    }

    // Speichern
    const result = await saveEingehendeRechnung({
      absender,
      betreff,
      anhang_name,
      status: rechnungData ? "neu" : "fehler",
      rechnung_data: rechnungData,
    });

    // Preishistorie automatisch befüllen (best-effort, benötigt Auth)
    if (rechnungData?.positionen?.length > 0) {
      try {
        const lieferant =
          (await findLieferantByEmail(absender)) ||
          (rechnungData.lieferant ? await findLieferantByName(rechnungData.lieferant) : null);

        if (lieferant?.id) {
          await speicherPreisHistorie(
            lieferant.id,
            rechnungData.positionen,
            rechnungData.datum || null
          );
        }
      } catch {
        // Auth-Problem im Webhook-Kontext – wird ignoriert
      }
    }

    return NextResponse.json({
      success: true,
      rechnung_data: rechnungData,
      id: result.id,
    });
  } catch (error) {
    console.error("[RechnungEingang] Fehler:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

function erechnungToRechnungData(d: any): any {
  return {
    rechnungs_nummer: d.rechnungsnummer || "",
    datum: d.rechnungsdatum || "",
    lieferant: d.lieferant?.name || "",
    netto: d.summen?.nettoGesamt ?? null,
    mwst: d.summen?.steuerBetrag ?? null,
    brutto: d.summen?.bruttoGesamt ?? null,
    positionen: (d.positionen || []).map((p: any) => ({
      artikel: p.bezeichnung || p.artikel || "",
      menge: p.menge ?? 1,
      einzelpreis: p.einzelpreisNetto ?? null,
      gesamtpreis: p.gesamtpreisNetto ?? null,
    })),
    xrechnung: true,
    format: d.format || "XRechnung",
    zahlungsziel: d.zahlungsziel ?? null,
    faelligkeitsdatum: d.faelligkeitsdatum ?? null,
  };
}

async function analyzeWithAI(base64: string): Promise<any> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "rechnung", images: [base64] }),
    });
    if (!response.ok) throw new Error("KI-Analyse fehlgeschlagen");
    return await response.json();
  } catch (error) {
    console.error("[RechnungEingang] KI-Analyse fehlgeschlagen:", error);
    return null;
  }
}
