import { NextRequest, NextResponse } from "next/server";

// SKR03 Konten für Gastronomie
const STEUER_KONTO_MAP: Record<string, { konto: string; gegenkonto: string }> = {
  "19": { konto: "1576", gegenkonto: "3400" }, // 19% VSt → Wareneingang
  "7":  { konto: "1571", gegenkonto: "3300" }, // 7% VSt → Lebensmittel
  "0":  { konto: "0",    gegenkonto: "3400" }, // steuerfrei
};

function escapeCSV(val: string): string {
  if (val.includes(";") || val.includes("\"") || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function POST(request: NextRequest) {
  try {
    const { lieferung } = await request.json();
    if (!lieferung) return NextResponse.json({ error: "Keine Lieferungsdaten" }, { status: 400 });

    const r = lieferung.rechnung_data;
    if (!r) return NextResponse.json({ error: "Keine Rechnungsdaten" }, { status: 400 });

    const datum = lieferung.erstellt_am || lieferung.created_at || new Date().toISOString();
    const belegDatum = new Date(datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\./g, "");
    // DATEV Datumsformat: DDMM (z.B. 0206 für 2. Juni)
    const belegDatumDATEV = belegDatum.slice(0, 4);

    const lieferant = escapeCSV(r.lieferant || "Unbekannter Lieferant");
    const rechnungsNr = escapeCSV(r.rechnungs_nummer || lieferung.id?.slice(0, 8) || "");
    const buchungstext = escapeCSV(`Lieferung ${lieferant} ${rechnungsNr}`);

    // MwSt-Satz ermitteln
    let mwstSatz = "19";
    if (r.mwst != null && r.netto != null && parseFloat(r.netto) > 0) {
      const rate = Math.round((parseFloat(r.mwst) / parseFloat(r.netto)) * 100);
      if (rate <= 7) mwstSatz = "7";
      else if (rate === 0) mwstSatz = "0";
    }
    const { konto, gegenkonto } = STEUER_KONTO_MAP[mwstSatz] || STEUER_KONTO_MAP["19"];

    const brutto = r.brutto ? parseFloat(r.brutto).toFixed(2).replace(".", ",") : "0,00";

    // DATEV EXTF Header (Zeile 1)
    const today = new Date();
    const erstelltAm = `${String(today.getDate()).padStart(2,"0")}${String(today.getMonth()+1).padStart(2,"0")}${today.getFullYear()}`;

    const headerLine = [
      "\"EXTF\"",
      "700",       // Versionsnummer
      "21",        // Datenkategorie: Buchungsstapel
      "\"Buchungsstapel\"",
      "7",
      erstelltAm,
      "",
      "",
      "",
      "",
      "\"RE\"",    // Herkunft
      `"${erstelltAm}"`, // Exportiert am
      "",
      "\"\"",
      "\"\"",
      "1",
      "0",
      "",
      "\"EUR\"",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join(";");

    // Spaltenheader (Zeile 2)
    const columnHeader = [
      "Umsatz (ohne Soll/Haben-Kz)",
      "Soll/Haben-Kennzeichen",
      "WKZ Umsatz",
      "Kurs",
      "Basis-Umsatz",
      "WKZ Basis-Umsatz",
      "Konto",
      "Gegenkonto (ohne BU-Schlüssel)",
      "BU-Schlüssel",
      "Belegdatum",
      "Belegfeld 1",
      "Belegfeld 2",
      "Skonto",
      "Buchungstext",
      "Postensperre",
      "Diverse Adressnummer",
      "Geschäftspartnerbank",
      "Sachverhalt",
      "Zinssperre",
      "Beleglink",
      "Beleginfo - Art 1",
      "Beleginfo - Inhalt 1",
    ].map(escapeCSV).join(";");

    // Buchungszeile
    const buchungszeile = [
      brutto,
      "S",           // Soll
      "EUR",
      "",
      "",
      "",
      gegenkonto,
      konto,
      mwstSatz === "7" ? "9" : mwstSatz === "19" ? "8" : "",  // BU-Schlüssel
      belegDatumDATEV,
      escapeCSV(rechnungsNr),
      "",
      "",
      buchungstext,
      "",
      "",
      "",
      "",
      "",
      "",
      "Rechnungsnummer",
      escapeCSV(rechnungsNr),
    ].join(";");

    const csvContent = [headerLine, columnHeader, buchungszeile].join("\r\n");

    // BOM für korrekte Zeichenkodierung in DATEV
    const bom = "﻿";
    const finalContent = bom + csvContent;

    return new NextResponse(finalContent, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="datev-${(lieferung.id || "").slice(0, 8)}.csv"`,
      },
    });
  } catch (error) {
    console.error("[DATEV-Export] Fehler:", error);
    return NextResponse.json({ error: "DATEV-Export fehlgeschlagen" }, { status: 500 });
  }
}
