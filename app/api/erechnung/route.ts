import { NextRequest, NextResponse } from "next/server";
import { parseERechnung, extractZUGFeRDFromPDF, validateERechnung } from "@/lib/erechnung";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { xmlString, pdfBase64, filename } = body;

    let xml: string | null = xmlString ?? null;

    // If PDF provided, try to extract embedded ZUGFeRD XML first
    if (!xml && pdfBase64) {
      xml = await extractZUGFeRDFromPDF(pdfBase64);
      if (!xml) {
        return NextResponse.json(
          { error: "Kein eingebettetes XML in dieser PDF gefunden. Handelt es sich um eine ZUGFeRD-Rechnung?" },
          { status: 422 }
        );
      }
    }

    if (!xml) {
      return NextResponse.json({ error: "Kein XML-Inhalt übermittelt." }, { status: 400 });
    }

    const daten = parseERechnung(xml);
    if (!daten) {
      return NextResponse.json(
        { error: "Format nicht erkannt. Bitte XRechnung (UBL/CII) oder ZUGFeRD-PDF hochladen." },
        { status: 422 }
      );
    }

    const validierung = validateERechnung(daten);

    return NextResponse.json({
      success: true,
      daten,
      validierung,
      hinweis: !validierung.valid
        ? `${validierung.fehler.length} Pflichtfeld(er) fehlen: ${validierung.fehler.join("; ")}`
        : "Rechnung ist EN 16931-konform.",
    });
  } catch (error: any) {
    console.error("E-Rechnung parse error:", error);
    return NextResponse.json({ error: "Parsing-Fehler: " + error.message }, { status: 500 });
  }
}
