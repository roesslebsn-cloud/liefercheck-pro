import { NextRequest, NextResponse } from "next/server";
import { saveEingehendeRechnung } from "../../../lib/database";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { absender, betreff, anhang_base64, anhang_name } = body;

    if (!absender || !betreff || !anhang_base64 || !anhang_name) {
      return NextResponse.json(
        { error: "Fehlende erforderliche Felder" },
        { status: 400 }
      );
    }

    let rechnungData: any = null;

    // Check if PDF is ZUGFeRD (contains embedded XML)
    const isZUGFeRD = anhang_base64.includes("ZUGFeRD") || 
                      anhang_name.toLowerCase().includes("zugferd");

    if (isZUGFeRD) {
      // Extract embedded XML from ZUGFeRD PDF
      try {
        // Simple regex to find XML content in PDF
        const xmlMatch = anhang_base64.match(/<\?xml[\s\S]*?<\/invoice>/);
        if (xmlMatch) {
          const xmlContent = xmlMatch[0];
          rechnungData = parseZUGFeRDXML(xmlContent);
        } else {
          // Fallback to KI analysis if XML extraction fails
          rechnungData = await analyzeWithAI(anhang_base64);
        }
      } catch (error) {
        console.error("Fehler beim Parsen von ZUGFeRD:", error);
        // Fallback to KI analysis
        rechnungData = await analyzeWithAI(anhang_base64);
      }
    } else {
      // Regular PDF - use KI analysis
      rechnungData = await analyzeWithAI(anhang_base64);
    }

    // Save to database
    const result = await saveEingehendeRechnung({
      absender,
      betreff,
      anhang_name,
      status: rechnungData ? "neu" : "fehler",
      rechnung_data: rechnungData,
    });

    return NextResponse.json({
      success: true,
      rechnung_data: rechnungData,
      id: result.id,
    });
  } catch (error) {
    console.error("Fehler beim Verarbeiten der eingehenden Rechnung:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

function parseZUGFeRDXML(xml: string): any {
  // Simple XML parser for ZUGFeRD invoice data
  // This is a basic implementation - in production you'd use a proper XML parser
  const rechnungsnummerMatch = xml.match(/<ID>([^<]+)<\/ID>/);
  const datumMatch = xml.match(/<IssueDate>([^<]+)<\/IssueDate>/);
  const lieferantMatch = xml.match(/<SellerName>([^<]+)<\/SellerName>/);

  const positionen: any[] = [];
  const itemMatches = xml.matchAll(/<LineItem>[\s\S]*?<\/LineItem>/g);
  
  for (const match of itemMatches) {
    const itemXml = match[0];
    const artikelMatch = itemXml.match(/<Name>([^<]+)<\/Name>/);
    const mengeMatch = itemXml.match(/<Quantity>([^<]+)<\/Quantity>/);
    const preisMatch = itemXml.match(/<PriceAmount>([^<]+)<\/PriceAmount>/);

    if (artikelMatch && mengeMatch) {
      positionen.push({
        artikel: artikelMatch[1],
        menge: parseFloat(mengeMatch[1]),
        einzelpreis: preisMatch ? parseFloat(preisMatch[1]) : null,
      });
    }
  }

  let netto = 0;
  let brutto = 0;
  let mwst = 0;

  const nettoMatch = xml.match(/<TaxBasisTotalAmount>([^<]+)<\/TaxBasisTotalAmount>/);
  const bruttoMatch = xml.match(/<GrandTotalAmount>([^<]+)<\/GrandTotalAmount>/);
  const mwstMatch = xml.match(/<TaxTotalAmount>([^<]+)<\/TaxTotalAmount>/);

  if (nettoMatch) netto = parseFloat(nettoMatch[1]);
  if (bruttoMatch) brutto = parseFloat(bruttoMatch[1]);
  if (mwstMatch) mwst = parseFloat(mwstMatch[1]);

  return {
    rechnungs_nummer: rechnungsnummerMatch ? rechnungsnummerMatch[1] : "",
    datum: datumMatch ? datumMatch[1] : "",
    lieferant: lieferantMatch ? lieferantMatch[1] : "",
    netto,
    brutto,
    mwst,
    positionen,
  };
}

async function analyzeWithAI(base64: string): Promise<any> {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "rechnung",
        images: [base64],
      }),
    });

    if (!response.ok) {
      throw new Error("KI-Analyse fehlgeschlagen");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Fehler bei der KI-Analyse:", error);
    return null;
  }
}
