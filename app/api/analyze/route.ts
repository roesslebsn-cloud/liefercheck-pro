import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Vision-Analysen koennen laenger dauern – Timeout auf 60s anheben (Vercel)
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-5";

// ─── Helpers ────────────────────────────────────────────────────────────────

function imageBlocks(images: string[]) {
  return images.map((img: string) => {
    const media_type = img.startsWith("data:image/png")
      ? ("image/png" as const)
      : img.startsWith("data:image/gif")
      ? ("image/gif" as const)
      : img.startsWith("data:image/webp")
      ? ("image/webp" as const)
      : ("image/jpeg" as const);
    return {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type,
        data: img.replace(/^data:image\/[a-z]+;base64,/, ""),
      },
    };
  });
}

// Liest das erzwungene Tool-Ergebnis aus der Antwort (garantiert gueltiges JSON-Objekt)
function getToolInput(message: Anthropic.Message, name: string): any | null {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === name) return block.input;
  }
  return null;
}

// ─── Tool-Schemas (erzwingen strukturierte Ausgabe) ──────────────────────────

const LIEFERSCHEIN_TOOL: Anthropic.Tool = {
  name: "lieferschein_erfassen",
  description: "Erfasst alle Positionen eines Lieferscheins als strukturierte Liste.",
  input_schema: {
    type: "object",
    properties: {
      gelieferte_artikel: {
        type: "array",
        description: "Jede tatsächlich gelieferte Artikelzeile (NICHT die als 'fehlt' markierten).",
        items: {
          type: "object",
          properties: {
            artikelnummer: { type: "string", description: "Vorangestellte Artikelnummer, z.B. '00832'." },
            artikel: { type: "string", description: "Vollständiger Artikelname wie gedruckt." },
            menge: { type: "number", description: "Gültige Liefermenge: gedruckte Menge, ODER die eingekreiste Zahl falls vorhanden." },
            menge_gedruckt: { type: "number", description: "Die ursprünglich GEDRUCKTE Menge (auch wenn eingekreist korrigiert)." },
            korrigiert: { type: "boolean", description: "true NUR wenn eine eingekreiste Zahl die gedruckte Menge ersetzt." },
            unsicher: { type: "boolean", description: "true, wenn die Markierung/Menge nicht eindeutig lesbar ist." },
            einheit: { type: "string", description: "Eh-Spalte: Kasten, Fass, Flasche, Stück." },
            groesse: { type: "string", description: "Gebinde, z.B. '6 x 1,0', '24x0,2', '30 l'." },
          },
          required: ["artikel", "menge"],
        },
      },
      nicht_geliefert: {
        type: "array",
        description: "NUR Positionen, die handschriftlich mit 'fehlt'/'f' markiert oder durchgestrichen sind.",
        items: {
          type: "object",
          properties: {
            artikel: { type: "string" },
            menge_gedruckt: { type: "number", description: "Die gedruckte Menge der fehlenden Position." },
            grund: { type: "string", description: "z.B. 'fehlt' oder 'durchgestrichen'." },
          },
          required: ["artikel"],
        },
      },
      pfand_eintrage: {
        type: "array",
        description: "Handschriftliche Pfand-/Leergut-Einträge des Fahrers (falls vorhanden).",
        items: {
          type: "object",
          properties: {
            artikel: { type: "string" },
            menge: { type: "number" },
          },
          required: ["artikel", "menge"],
        },
      },
      seiten_erkannt: { type: "number", description: "Anzahl erkannter Lieferschein-Seiten." },
      hinweise: { type: "string", description: "Unleserliche Stellen oder Unsicherheiten." },
    },
    required: ["gelieferte_artikel"],
  },
};

const BESTELLUNG_TOOL: Anthropic.Tool = {
  name: "bestellung_erfassen",
  description: "Erfasst die Positionen einer Gastronovi-Bestellübersicht.",
  input_schema: {
    type: "object",
    properties: {
      positionen: {
        type: "array",
        items: {
          type: "object",
          properties: {
            artikel: { type: "string", description: "Artikelname ohne Preis." },
            menge: { type: "number", description: "Führende Bestellmenge (aktuell), z.B. die '2' in '2 x ...'." },
            menge_urspruenglich: { type: "number", description: "Klammerwert bei 'X (Y) x ...', sonst gleich menge." },
            gebinde: { type: "string", description: "z.B. '0,75l Flasche', '30l Fass', '6x1,0'." },
          },
          required: ["artikel", "menge"],
        },
      },
    },
    required: ["positionen"],
  },
};

const RECHNUNG_TOOL: Anthropic.Tool = {
  name: "rechnung_erfassen",
  description: "Erfasst alle Daten einer Getränke-Rechnung als strukturierte Liste.",
  input_schema: {
    type: "object",
    properties: {
      rechnungs_nummer: { type: "string" },
      datum: { type: "string" },
      lieferant: { type: "string" },
      positionen: {
        type: "array",
        items: {
          type: "object",
          properties: {
            artikel: { type: "string" },
            menge: { type: "number" },
            einzelpreis: { type: "number" },
            gesamtpreis: { type: "number" },
          },
          required: ["artikel", "menge"],
        },
      },
      netto: { type: "number" },
      mwst: { type: "number" },
      brutto: { type: "number" },
    },
    required: ["positionen"],
  },
};

const ABGLEICH_TOOL: Anthropic.Tool = {
  name: "abgleich_erstellen",
  description: "Vergleicht Bestellung und Lieferschein und listet alle Positionen mit Status.",
  input_schema: {
    type: "object",
    properties: {
      abgleich: {
        type: "array",
        items: {
          type: "object",
          properties: {
            artikel: { type: "string" },
            bestellt: { type: "number" },
            geliefert: { type: "number" },
            abweichung: { type: "number", description: "geliefert - bestellt (negativ = zu wenig)." },
            status: { type: "string", enum: ["ok", "abweichung", "nicht_geliefert", "nicht_bestellt"] },
          },
          required: ["artikel", "bestellt", "geliefert", "abweichung", "status"],
        },
      },
      zusammenfassung: {
        type: "object",
        properties: {
          alles_ok: { type: "boolean" },
          anzahl_abweichungen: { type: "number" },
          hinweis: { type: "string" },
        },
        required: ["alles_ok", "anzahl_abweichungen"],
      },
    },
    required: ["abgleich", "zusammenfassung"],
  },
};

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { type, images, data } = await request.json();

    if (!type) {
      return NextResponse.json({ error: "Ungültige Anfrage: type ist erforderlich" }, { status: 400 });
    }

    // ===== PFAND (unverändert – manuelle Erfassung als Fallback) ==============
    if (type === "pfand") {
      if (!images || !Array.isArray(images) || images.length === 0) {
        return NextResponse.json({ error: "Ungültige Anfrage: images sind erforderlich" }, { status: 400 });
      }

      const systemPrompt =
        "Du bist ein hochspezialisierter Experte für Gastronomie-Pfand in Deutschland. Analysiere die Fotos mit absoluter Präzision nach den gegebenen Regeln. Antworte nur im JSON-Format.";
      const prompt = `Du bist ein hochspezialisierter Experte für Gastronomie-Pfand in Deutschland.
Analysiere die Fotos mit absoluter Präzision nach diesen Regeln:

WAS ZÄHLEN:
- Nur Kisten MIT Flaschen drin, leere oder umgedrehte Kisten NICHT zählen
- Nur Getränkekisten, keine Metzger/Obst/sonstige Kisten
- Fässer (immer 30L, auch wenn übereinander gestapelt - jeden Fass einzeln zählen)
- CO2 Flaschen (lang und dünn)
- Biogon Flaschen (kürzer und dicker als CO2)

AUSGABE NUR ALS JSON, kein Text davor oder danach:
{
  "artikel": [
    { "name": "Vollständiger Artikelname", "marke": "Markenname", "groesse": "z.B. 0.33L oder 30L", "menge": Anzahl als Zahl, "typ": "Kiste/Fass/Gasflasche", "stueck_pro_kiste": Anzahl oder null, "unsicher": true oder false, "hinweis": "Nur ausfüllen wenn unsicher" }
  ],
  "gesamt_kisten": Anzahl,
  "gesamt_faesser": Anzahl,
  "mehrere_bereiche": true oder false,
  "analyse_hinweis": "Allgemeine Anmerkungen"
}`;

      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: [...imageBlocks(images), { type: "text", text: prompt }] }],
      });

      const content = message.content[0];
      let result: any = {};
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: content.text };
      }
      return NextResponse.json(result);
    }

    // ===== LIEFERSCHEIN (Tool-basiert, sehr konservativ bei Handschrift) ======
    if (type === "lieferschein") {
      if (!images || !Array.isArray(images) || images.length === 0) {
        return NextResponse.json({ error: "Ungültige Anfrage: images sind erforderlich" }, { status: 400 });
      }

      const systemPrompt =
        "Du bist ein extrem sorgfältiger OCR-Experte für deutsche Getränke-Großhandel-Lieferscheine (GLH/Gefako). Du transkribierst jeden Artikelnamen ZEICHEN FÜR ZEICHEN exakt so, wie er gedruckt ist – du normalisierst, übersetzt, ergänzt oder erfindest NIEMALS etwas. Die gedruckte Menge gilt immer, außer es steht genau ein vereinbartes handschriftliches Zeichen daneben. Ergebnis ausschließlich über das bereitgestellte Tool.";

      const prompt = `Lies diesen Lieferschein eines deutschen Getränke-Fachgroßhandels.

WICHTIGSTE REGEL – ARTIKELNAMEN WORTGETREU ABSCHREIBEN:
- Übernimm den Artikelnamen EXAKT wie gedruckt, Zeichen für Zeichen – inklusive Abkürzungen ("Schäff.", "Allg.", "Nek.", "alkfr."), Punkten, Schrägstrichen, Zahlen und Sonderzeichen.
- ERFINDE NIEMALS einen Namen und „verschönere" nichts. Schreibe NICHT den vermuteten vollständigen Produktnamen, sondern nur das, was wirklich auf dem Papier steht.
- Wenn ein Name teils unleserlich ist: transkribiere den lesbaren Teil und setze unsicher = true. Rate KEIN plausibles Produkt dazu.
- Übernimm die vorangestellte Artikelnummer (z.B. 00832) separat im Feld artikelnummer – sie ist der sicherste Anker für die Identität der Position.
- Lies langsam und Zeile für Zeile von oben nach unten. Überspringe keine Zeile und füge keine Zeile hinzu, die nicht im Bild steht.

TABELLENAUFBAU:
- Spalten: "Artikel" (mit vorangestellter Artikelnummer wie 00832, 01141), "Menge", "Eh" (Einheit: Kasten, Fass, Flasche).
- Erfasse für JEDE Zeile die GEDRUCKTE Menge und die Einheit exakt.

HANDSCHRIFT – FESTER CODE, halte dich EXAKT daran (sehr wichtig):
Die GEDRUCKTE Menge gilt IMMER, AUSSER es steht genau eines dieser zwei Zeichen direkt bei der Position:

1) EINGEKREISTE ZAHL = eine handschriftliche Zahl mit einem per Hand gezogenen Kreis/Oval drumherum.
   → Das ist die tatsächlich gelieferte Menge und ÜBERSCHREIBT die gedruckte Menge.
   → Setze: menge = die eingekreiste Zahl, menge_gedruckt = die gedruckte Zahl, korrigiert = true.

2) "F" / "fehlt" / "fehlend" ODER durchgestrichene Zeile = Artikel NICHT geliefert.
   → Trage ihn in "nicht_geliefert" ein (mit menge_gedruckt) und NICHT in "gelieferte_artikel".

ALLES ANDERE ändert die Menge NICHT:
- Eine Position OHNE jede Markierung gilt als normal geliefert mit der GEDRUCKTEN Menge. Ein Häkchen ist NICHT erforderlich – nicht markierte Zeilen sind völlig normal und kommen mit ihrer gedruckten Menge in "gelieferte_artikel".
- Ein Häkchen (✓), Haken, Strich oder Kringel OHNE Zahl bedeutet nur "geprüft/in Ordnung" und ist optional. NIEMALS als Menge oder Korrektur werten.
- Eine handschriftliche Zahl, die NICHT eingekreist ist, ist KEINE Korrektur → gedruckte Menge gilt.
- Lose Zahlen außerhalb der Mengen-Spalte (Seitenzahl wie "von 4", Tour-Nr., Gewicht, Unterschrift, Datum) strikt ignorieren.

UNSICHERHEIT:
- Wenn du nicht eindeutig erkennen kannst, ob eine Zahl wirklich eingekreist ist oder ob "fehlt" dasteht, nimm deine beste Annahme UND setze für diese Position unsicher = true.

MEHRSEITIG:
- Mehrere Bilder gehören zur SELBEN Lieferung ("Seite 1 von 4" …). Führe alles zu EINER Liste zusammen, jede Position nur einmal.

Gib das vollständige Ergebnis ausschließlich über das Tool "lieferschein_erfassen" zurück. Erfinde nichts.`;

      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        tools: [LIEFERSCHEIN_TOOL],
        tool_choice: { type: "tool", name: "lieferschein_erfassen" },
        messages: [{ role: "user", content: [...imageBlocks(images), { type: "text", text: prompt }] }],
      });

      const result = getToolInput(message, "lieferschein_erfassen");
      if (!result || !Array.isArray(result.gelieferte_artikel)) {
        return NextResponse.json(
          { error: "Der Lieferschein konnte nicht ausgelesen werden. Bitte ein schärferes Foto bei gutem Licht aufnehmen (ganze Seite, gerade von oben)." },
          { status: 422 }
        );
      }
      return NextResponse.json(result);
    }

    // ===== BESTELLUNG (Gastronovi-Screenshot) =================================
    if (type === "bestellung") {
      if (!images || !Array.isArray(images) || images.length === 0) {
        return NextResponse.json({ error: "Ungültige Anfrage: images sind erforderlich" }, { status: 400 });
      }

      const systemPrompt =
        "Du liest Gastronovi-Bestellübersichten (Wareneingang/Einkaufsposten) eines Restaurants präzise aus. Die bestellte Menge ist immer die führende große Zahl pro Position. Ergebnis ausschließlich über das bereitgestellte Tool.";

      const prompt = `Dies ist eine Gastronovi-Bestellübersicht.

So liest du jede Position:
- Die BESTELLMENGE ist die führende große Zahl, z.B.:
  • "2 x Allgäuer Büble Bayrisch Hell" → menge = 2
  • "1 x Granini Ananassaft Glasflasche" → menge = 1
- Die kleine Zeile darunter ("2×30 l = 60 l", "1×24 st = 24 st", "1×1 lx6 = 6 l") ist NUR die Detail-Aufschlüsselung. Das ist NICHT die Bestellmenge. Nutze sie NICHT als menge.

SONDERFALL "X (Y) x ...": z.B. "1 (2) x Selters …" oder "0 (1) x Granini Zitronensaft …".
- X (führend, fett) = aktuelle Menge → menge = X.
- Y (in Klammern) = ursprünglich bestellte Menge → menge_urspruenglich = Y.
- Ohne Klammern: menge_urspruenglich = menge.

Ignoriere Preise (€), Häkchen und Summenzeilen. Erfasse pro Position: artikel (Name ohne Preis/Mengen-Präfix), menge, menge_urspruenglich, gebinde (falls erkennbar).

Gib das Ergebnis ausschließlich über das Tool "bestellung_erfassen" zurück.`;

      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        tools: [BESTELLUNG_TOOL],
        tool_choice: { type: "tool", name: "bestellung_erfassen" },
        messages: [{ role: "user", content: [...imageBlocks(images), { type: "text", text: prompt }] }],
      });

      const result = getToolInput(message, "bestellung_erfassen");
      if (!result || !Array.isArray(result.positionen)) {
        return NextResponse.json(
          { error: "Die Gastronovi-Bestellung konnte nicht ausgelesen werden. Bitte einen klaren Screenshot der Einkaufsposten verwenden." },
          { status: 422 }
        );
      }
      return NextResponse.json(result);
    }

    // ===== ABGLEICH (Tool-basiert, strikte Regeln) ===========================
    if (type === "abgleich") {
      if (!data || !data.lieferschein || !data.bestellung) {
        return NextResponse.json({ error: "Ungültige Anfrage: lieferschein und bestellung sind erforderlich" }, { status: 400 });
      }

      const systemPrompt =
        "Du vergleichst eine Restaurant-Bestellung (Gastronovi = Soll) mit dem Lieferschein des Großhändlers (Ist). Du findest NUR echte Mengen-Abweichungen und erfindest niemals welche. Im Zweifel ist der Status 'ok'. Ergebnis ausschließlich über das bereitgestellte Tool.";

      const prompt = `Vergleiche Bestellung (Soll) und Lieferschein (Ist). Ziel: ausschließlich ECHTE Abweichungen finden.

EINHEITEN:
- Beide Seiten zählen in Bestelleinheiten (Kasten, Fass, Flasche). Vergleiche bestellte Menge gegen gelieferte Menge in DIESEN Einheiten.
- Ignoriere Detail-Aufschlüsselungen wie "st", "l", "6 x 1,0", "24x0,2".

ARTIKEL ZUORDNEN (großzügig nach Name, ignoriere Groß/Klein, Reihenfolge, Zusätze wie "Glasflasche/Flasche/PET/Nektar/Saft/naturtrüb/Glas", Marken- und Größenangaben). Diese Paare gehören z.B. zusammen:
- "Granini Maracuja-Nektar Glasflasche" ↔ "Granini Maracuja Nek. 6 x 1,0"
- "Schweppes Russian Wild Berry PET" ↔ "Schweppes Wild Berry 6x1,0"
- "Schöfferhofer Weizen 0,00% alkoholfrei" ↔ "Schöff. Hefe alkfrei 0,0% 20x0,5"
- "Allgäuer Büble Bayrisch Hell" ↔ "Allg. Büble Bay. hell 30 l"
- "Clausthaler Classic alkoholfrei 0,33" ↔ "Clausth. Classic 24x0,33"

STATUS-REGELN (strikt):
- Mengen gleich → "ok". Das ist der NORMALFALL – die allermeisten Positionen sind "ok".
- Artikel steht im Lieferschein unter "nicht_geliefert" (als "fehlt"/durchgestrichen markiert) → "nicht_geliefert", geliefert = 0. Als bestellte Menge die ursprüngliche Bestellmenge verwenden (menge_urspruenglich, sonst menge).
- Bestellt, aber gar nicht auf dem Lieferschein → "nicht_geliefert".
- Auf dem Lieferschein, aber nicht bestellt → "nicht_bestellt".
- Bestellt N, geliefert M, und N ≠ M → "abweichung" (abweichung = M − N).

GANZ WICHTIG:
- Häkchen, Unterschriften, Seitenzahlen sind KEINE Mengen. Leite daraus NIEMALS eine Abweichung ab.
- Wenn die Mengen übereinstimmen, MUSS der Status "ok" sein. Im Zweifel "ok".
- Für die bestellte Menge nutzt du die aktuelle Gastronovi-Menge (menge); die ursprüngliche Menge nur, um einen als "fehlt" markierten Artikel korrekt als nicht_geliefert zu kennzeichnen.

Bestellung (Gastronovi, Soll):
${JSON.stringify(data.bestellung)}

Lieferschein (Ist) – inkl. der Liste "nicht_geliefert":
${JSON.stringify(data.lieferschein)}

Gib das Ergebnis ausschließlich über das Tool "abgleich_erstellen" zurück.`;

      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        tools: [ABGLEICH_TOOL],
        tool_choice: { type: "tool", name: "abgleich_erstellen" },
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      });

      const result = getToolInput(message, "abgleich_erstellen");
      if (!result || !Array.isArray(result.abgleich)) {
        return NextResponse.json(
          { error: "Der Abgleich konnte nicht erstellt werden. Bitte Lieferschein und Bestellung prüfen und erneut versuchen." },
          { status: 422 }
        );
      }
      return NextResponse.json(result);
    }

    // ===== RECHNUNG (Tool-basiert) ===========================================
    if (type === "rechnung") {
      if (!images || !Array.isArray(images) || images.length === 0) {
        return NextResponse.json({ error: "Ungültige Anfrage: images sind erforderlich" }, { status: 400 });
      }

      const systemPrompt =
        "Du bist ein Experte für Gastronomie-Rechnungen. Du liest Rechnungen präzise aus und gibst das Ergebnis ausschließlich über das bereitgestellte Tool zurück.";

      const prompt = `Analysiere diese Rechnung (eine oder mehrere Seiten gehören zur selben Rechnung).
Extrahiere Rechnungsnummer, Datum, Lieferant sowie alle Positionen mit Menge, Einzelpreis und Gesamtpreis, außerdem Netto, MwSt und Brutto.
Achte auf deutsche Zahlenformate (1.234,56 €). Gib das Ergebnis ausschließlich über das Tool "rechnung_erfassen" zurück.`;

      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        tools: [RECHNUNG_TOOL],
        tool_choice: { type: "tool", name: "rechnung_erfassen" },
        messages: [{ role: "user", content: [...imageBlocks(images), { type: "text", text: prompt }] }],
      });

      const result = getToolInput(message, "rechnung_erfassen");
      if (!result || !Array.isArray(result.positionen)) {
        return NextResponse.json(
          { error: "Die Rechnung konnte nicht ausgelesen werden. Bitte ein schärferes Foto/PDF verwenden." },
          { status: 422 }
        );
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Ungültiger Typ" }, { status: 400 });
  } catch (error) {
    console.error("Fehler bei der Analyse:", error);
    return NextResponse.json(
      { error: "Fehler bei der Analyse", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
