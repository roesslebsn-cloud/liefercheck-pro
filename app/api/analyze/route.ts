import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { type, images } = await request.json();

    if (!type || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: "Ungültige Anfrage: type und images sind erforderlich" },
        { status: 400 }
      );
    }

    // Konvertiere Base64-Strings zu Buffer
    const imageContent = images.map((img: string) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg" as const,
        data: img.replace(/^data:image\/[a-z]+;base64,/, ""),
      },
    }));

    let prompt = "";
    let systemPrompt = "";

    if (type === "pfand") {
      systemPrompt =
        "Du bist ein Experte für Gastronomie-Lieferungen. Analysiere die Fotos von Pfandartikeln und erkenne alle Pfandgegenstände mit ihren Mengen. Antworte nur im JSON-Format.";
      prompt = `Analysiere diese Fotos von Pfandartikeln. Erkenne alle Pfandgegenstände und gib sie als JSON zurück.
      
      Das JSON muss folgendes Format haben:
      {
        "items": [
          {
            "artikel": "Name des Artikels (z.B. 'Bierkiste', 'Flasche 0,5L', 'Kasten 0,33L')",
            "menge": Anzahl als Zahl,
            "typ": "Typ des Pfands (z.B. 'Kiste', 'Flasche', 'Kasten')"
          }
        ]
      }
      
      Berücksichtige alle sichtbaren Pfandartikel auf den Fotos.`;
    } else if (type === "lieferschein") {
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
    } else {
      return NextResponse.json(
        { error: "Ungültiger Typ: muss 'pfand' oder 'lieferschein' sein" },
        { status: 400 }
      );
    }

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

    // Extrahiere JSON aus der Antwort
    const content = message.content[0];
    let result;

    if (content.type === "text") {
      // Versuche, JSON aus dem Text zu extrahieren
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = { raw: content.text };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fehler bei der Bildanalyse:", error);
    return NextResponse.json(
      { error: "Fehler bei der Bildanalyse" },
      { status: 500 }
    );
  }
}
