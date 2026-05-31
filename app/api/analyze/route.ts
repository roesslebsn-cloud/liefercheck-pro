import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { type, images, data } = await request.json();

    if (!type) {
      return NextResponse.json(
        { error: "Ungültige Anfrage: type ist erforderlich" },
        { status: 400 }
      );
    }

    let prompt = "";
    let systemPrompt = "";

    if (type === "pfand") {
      if (!images || !Array.isArray(images) || images.length === 0) {
        return NextResponse.json(
          { error: "Ungültige Anfrage: images sind erforderlich" },
          { status: 400 }
        );
      }

      const imageContent = images.map((img: string) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.startsWith("data:image/png") ? "image/png" as const : img.startsWith("data:image/gif") ? "image/gif" as const : img.startsWith("data:image/webp") ? "image/webp" as const : "image/jpeg" as const,
          data: img.replace(/^data:image\/[a-z]+;base64,/, ""),
        },
      }));

      systemPrompt =
        "Du bist ein hochspezialisierter Experte für Gastronomie-Pfand in Deutschland. Analysiere die Fotos mit absoluter Präzision nach den gegebenen Regeln. Antworte nur im JSON-Format.";
      prompt = `Du bist ein hochspezialisierter Experte für Gastronomie-Pfand in Deutschland.
Analysiere die Fotos mit absoluter Präzision nach diesen Regeln:

WAS ZÄHLEN:
- Nur Kisten MIT Flaschen drin, leere oder umgedrehte Kisten NICHT zählen
- Nur Getränkekisten, keine Metzger/Obst/sonstige Kisten
- Fässer (immer 30L, auch wenn übereinander gestapelt - jeden Fass einzeln zählen)
- CO2 Flaschen (lang und dünn)
- Biogon Flaschen (kürzer und dicker als CO2)

ARTIKEL-ERKENNUNG:
- Granini: grüne Kisten, 6x1L Saft
- Schweppes Glas: schwarze Kisten, 0,2L Glasflaschen
- Schweppes PET: Kisten mit 6x1L PET Flaschen
- Clausthaler: schwarze Kisten mit beigen/gelben Flaschen, Bier alkoholfrei 0,33L
- Selters 0,75L: dunkelblaue Kisten, blaue Flaschen, 12 Stück pro Kiste
- Selters 0,5L: dunkelblaue Kisten, blaue Flaschen, 20 Stück pro Kiste
- Orangina: eigene Kisten, 0,25L Glasflaschen
- Corona: helle Kisten mit Corona-Aufdruck, 0,33L Flaschen, 24 Stück pro Kiste
- Fässer: zylindrisch, silber/grau, immer als 30L zählen
- CO2: lange dünne Gasflasche, silber
- Biogon: kürzere dickere Gasflasche, silber
- Aschenbecher mit Mülleimer: NICHT zählen

SELTERS UNTERSCHEIDUNG:
- Ca. 20 Flaschen sichtbar = 0,5L Kiste
- Ca. 12 Flaschen sichtbar = 0,75L Kiste
- Wenn nicht eindeutig: als unsicher markieren

WENN MEHRERE FOTOS:
- Prüfe ob es derselbe Bereich aus verschiedenen Winkeln ist
- Bei gleichem Bereich: jeden Artikel nur EINMAL zählen
- Bei verschiedenen Bereichen: Mengen addieren

AUSGABE NUR ALS JSON, kein Text davor oder danach:
{
  "artikel": [
    {
      "name": "Vollständiger Artikelname",
      "marke": "Markenname",
      "groesse": "z.B. 0.33L oder 30L",
      "menge": Anzahl als Zahl,
      "typ": "Kiste/Fass/Gasflasche",
      "stueck_pro_kiste": Anzahl oder null,
      "unsicher": true oder false,
      "hinweis": "Nur ausfüllen wenn unsicher"
    }
  ],
  "gesamt_kisten": Anzahl,
  "gesamt_faesser": Anzahl,
  "mehrere_bereiche": true oder false,
  "analyse_hinweis": "Allgemeine Anmerkungen"
}`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [...imageContent, { type: "text", text: prompt }],
          },
        ],
      });

      const content = message.content[0];
      let result;
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          result = { raw: content.text };
        }
      }
      return NextResponse.json(result);

    } else if (type === "lieferschein") {
      if (!images || !Array.isArray(images) || images.length === 0) {
        return NextResponse.json(
          { error: "Ungültige Anfrage: images sind erforderlich" },
          { status: 400 }
        );
      }

      const imageContent = images.map((img: string) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.startsWith("data:image/png") ? "image/png" as const : img.startsWith("data:image/gif") ? "image/gif" as const : img.startsWith("data:image/webp") ? "image/webp" as const : "image/jpeg" as const,
          data: img.replace(/^data:image\/[a-z]+;base64,/, ""),
        },
      }));

      systemPrompt =
        "Du bist ein Experte für Gastronomie-Lieferscheine. Analysiere das Foto des Lieferscheins und extrahiere alle relevanten Informationen. Antworte nur im JSON-Format.";
      prompt = `Analysiere dieses Foto eines Lieferscheins. Extrahiere folgende Informationen:
      
      1. Alle gelieferten Artikel mit Menge und Größe
      2. Nicht gelieferte Positionen (falls markiert)
      3. Handschriftliche Pfandeinträge des Fahrers
      
      Das JSON muss folgendes Format haben:
      {
        "gelieferte_artikel": [
          {
            "artikel": "Name des Artikels",
            "menge": Anzahl als Zahl,
            "groesse": "Größe (z.B. '0,5L', '1L', 'nicht zutreffend')"
          }
        ],
        "nicht_geliefert": [
          {
            "artikel": "Name des Artikels",
            "grund": "Grund warum nicht geliefert (falls erkennbar)"
          }
        ],
        "pfand_eintrage": [
          {
            "artikel": "Name des Pfandartikels",
            "menge": Anzahl als Zahl
          }
        ]
      }
      
      Sei genau und erfasse alle erkennbaren Informationen.`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [...imageContent, { type: "text", text: prompt }],
          },
        ],
      });

      const content = message.content[0];
      let result;
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          result = { raw: content.text };
        }
      }
      return NextResponse.json(result);

    } else if (type === "abgleich") {
      if (!data || !data.lieferschein || !data.bestellung) {
        return NextResponse.json(
          { error: "Ungültige Anfrage: lieferschein und bestellung sind erforderlich" },
          { status: 400 }
        );
      }

      systemPrompt =
        "Du bist ein Experte für Gastronomie-Lieferabgleiche. Vergleiche die Gastronovi-Bestellung mit dem Lieferschein und identifiziere Abweichungen. Antworte nur im JSON-Format.";
      prompt = `Vergleiche diese Gastronovi-Bestellung mit dem Lieferschein.

Gastronovi-Bestellung (was bestellt wurde):
${JSON.stringify(data.bestellung)}

Lieferschein-Daten (was geliefert wurde):
${JSON.stringify(data.lieferschein)}

Analysiere die Unterschiede und antworte NUR als JSON:
{
  "abgleich": [
    {
      "artikel": "Artikelname",
      "bestellt": Anzahl als Zahl,
      "geliefert": Anzahl als Zahl,
      "abweichung": Differenz als Zahl (negativ = zu wenig geliefert),
      "status": "ok" oder "abweichung" oder "nicht_geliefert" oder "nicht_bestellt"
    }
  ],
  "zusammenfassung": {
    "alles_ok": true oder false,
    "anzahl_abweichungen": Zahl,
    "hinweis": "Kurze Zusammenfassung"
  }
}`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }],
          },
        ],
      });

      const content = message.content[0];
      let result;
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          result = { raw: content.text };
        }
      }
      return NextResponse.json(result);

    } else if (type === "rechnung") {
      if (!images || !Array.isArray(images) || images.length === 0) {
        return NextResponse.json(
          { error: "Ungültige Anfrage: images sind erforderlich" },
          { status: 400 }
        );
      }

      const imageContent = images.map((img: string) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.startsWith("data:image/png") ? "image/png" as const : img.startsWith("data:image/webp") ? "image/webp" as const : "image/jpeg" as const,
          data: img.replace(/^data:image\/[a-z]+;base64,/, ""),
        },
      }));

      systemPrompt =
        "Du bist ein Experte für Gastronomie-Rechnungen. Analysiere die Rechnung und extrahiere alle relevanten Informationen. Antworte nur im JSON-Format.";
      prompt = `Analysiere diese Rechnung und extrahiere alle Positionen mit Menge, Einzelpreis und Gesamtpreis, sowie Rechnungsnummer, Datum, Lieferant, Netto, MwSt und Brutto. Antworte NUR als JSON:
{
  "rechnungs_nummer": "String",
  "datum": "String",
  "lieferant": "String",
  "positionen": [
    {
      "artikel": "String",
      "menge": Zahl,
      "einzelpreis": Zahl,
      "gesamtpreis": Zahl
    }
  ],
  "netto": Zahl,
  "mwst": Zahl,
  "brutto": Zahl
}`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [...imageContent, { type: "text", text: prompt }],
          },
        ],
      });

      const content = message.content[0];
      let result;
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          result = { raw: content.text };
        }
      }
      return NextResponse.json(result);

    } else {
      return NextResponse.json(
        { error: "Ungültiger Typ" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Fehler bei der Analyse:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      { error: "Fehler bei der Analyse", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}