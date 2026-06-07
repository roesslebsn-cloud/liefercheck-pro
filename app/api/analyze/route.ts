import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Vision-Analysen koennen laenger dauern – Timeout auf 60s anheben (Vercel)
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

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
        "Du bist ein extrem sorgfältiger OCR-Experte für deutsche Getränke-Großhandel-Lieferscheine (GLH/Gefako/Lüning/Radeberger). Du transkribierst jeden Artikelnamen ZEICHEN FÜR ZEICHEN exakt so, wie er gedruckt ist. Du erfindest, normalisierst oder ergänzt NIEMALS etwas. Jede Zeile der Tabelle muss einzeln gelesen werden. Ergebnis ausschließlich über das bereitgestellte Tool.";

      const prompt = `Lies diesen Lieferschein eines deutschen Getränke-Fachgroßhandels sorgfältig Zeile für Zeile.

SCHRITT 1 – TABELLENSTRUKTUR ERKENNEN:
Finde die Datentabelle. Typische Spalten von links nach rechts:
  Artikelnummer (5-stellig, z.B. 00832) | Artikelname | Menge | Eh (Einheit) | Gebinde/Größe | ggf. Preis
Lese JEDE Datenzeile einzeln von oben nach unten. Überspringe KEINE Zeile.

SCHRITT 2 – ARTIKELNAMEN WORTGETREU ABSCHREIBEN:
- Übernimm den Artikelnamen EXAKT wie gedruckt, Zeichen für Zeichen – inklusive Abkürzungen ("Schäff.", "Allg.", "Nek.", "alkfr.", "Wh."), Punkten, Schrägstrichen, Zahlen und Sonderzeichen.
- Schreibe NICHT den vermuteten Vollnamen; schreibe NUR das, was auf dem Papier steht.
- Die vorangestellte Artikelnummer (z.B. 00832) gehört in das Feld "artikelnummer" (nicht in den Artikelnamen).
- Wenn ein Name teils unleserlich ist: transkribiere den lesbaren Teil → unsicher = true.

SCHRITT 3 – MENGEN LESEN:
Lies die Mengenspalte ("Menge" oder ähnlich) für jede Zeile. Das ist meist eine kleine Zahl (1–50) links neben der Einheitenspalte. Verwechsle diese NICHT mit:
- Artikelnummern (5-stellig)
- Gebindegrößen ("24x0,33", "6x1,0", "30 l") – diese kommen ins Feld "groesse"
- Seitenzahlen oder Tourennummern

SCHRITT 4 – HANDSCHRIFTLICHE MARKIERUNGEN (sehr genau beachten):
Die GEDRUCKTE Menge gilt IMMER – außer bei diesen zwei Ausnahmen:

A) EINGEKREISTE ZAHL: Eine handschriftliche Zahl mit einem Kreis/Oval drumherum direkt neben der Position.
   → menge = eingekreiste Zahl, menge_gedruckt = gedruckte Zahl, korrigiert = true.

B) "F", "fehlt", "fehlend" oder durchgestrichene Zeile:
   → Position in "nicht_geliefert" eintragen (mit menge_gedruckt), NICHT in "gelieferte_artikel".

Was die Menge NICHT ändert:
- Häkchen (✓), Kringel ohne Zahl, Unterschriften → nur "geprüft", keine Mengenkorrektur.
- Handschriftliche Zahl OHNE Kreis → keine Korrektur.
- Lose Zahlen außerhalb der Mengenspalte (Seitenzahl "2 von 4", Gewicht, Tour-Nr.) → ignorieren.

SCHRITT 5 – MEHRSEITIG:
Mehrere Bilder ("Seite 1 von 4" …) gehören zur SELBEN Lieferung. Alles zu EINER Liste zusammenführen.

Gib das vollständige Ergebnis ausschließlich über das Tool "lieferschein_erfassen" zurück. Erfinde KEINE Positionen.`;

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

DATENFORMAT BESTELLUNG – AUTOMATISCH ERKENNEN:
Die Bestelldaten können in zwei Formaten vorliegen:
  Format A (aus Bild-Extraktion, normalisiert): {"artikel": "Name", "menge": 2, "gebinde": "..."}
  Format B (Gastronovi-CSV, Rohdaten): Felder wie "Bezeichnung"/"Artikel"/"Artikelname"/"Artikelbez." für den Namen und "Menge"/"Bestellmenge"/"Anzahl" für die Menge.
Erkenne das Format automatisch. Bei Format B: Nutze den Bezeichnungs-/Artikel-Wert als Artikelname und den Mengen-Wert (als Zahl) als Bestellmenge. Ignoriere Preis-, Nummern- und sonstige Felder für den Abgleich.

EINHEITEN:
- Beide Seiten zählen in Bestelleinheiten (Kasten, Fass, Flasche). Vergleiche bestellte Menge gegen gelieferte Menge in diesen Einheiten.
- Ignoriere Detail-Aufschlüsselungen wie "st", "l", "6 x 1,0", "24x0,2".

ARTIKEL ZUORDNEN – großzügig nach Name-Ähnlichkeit:
Ignoriere: Groß-/Kleinschreibung, Wortstellung, Füllwörter (Glasflasche/Flasche/PET/Nektar/Saft/naturtrüb/Glas/Kiste).
Abkürzungen auf dem Lieferschein stehen für den vollen Gastronovi-Namen. Beispiele:
- "Granini Maracuja-Nektar Glasflasche" ↔ "Granini Maracuja Nek. 6 x 1,0"
- "Granini Orangensaft Glasflasche" ↔ "Gran. Orange 6x1,0"
- "Schweppes Russian Wild Berry PET" ↔ "Schweppes Wild Berry 6x1,0"
- "Schöfferhofer Weizen 0,00% alkoholfrei" ↔ "Schöff. Hefe alkfrei 0,0% 20x0,5"
- "Schöfferhofer Weizenmischbier Grapefruit" ↔ "Schöff. Grap. 20x0,5"
- "Allgäuer Büble Bayrisch Hell" ↔ "Allg. Büble Bay. hell 30 l"
- "Allgäuer Büble Bayrisch Hell Flasche" ↔ "Allg. Büble Bay. hell 20x0,5"
- "Clausthaler Classic alkoholfrei 0,33" ↔ "Clausth. Classic 24x0,33"
- "Selters Medium Glasflasche" ↔ "Selters med. Glas 24x0,25"
- "Selters Classic PET" ↔ "Selters classic PET 6x1,0"
- "Coca-Cola Classic" ↔ "Coca Cola Class. 24x0,2"
- "Fanta Orange" ↔ "Fanta Orange 24x0,2"
Wenn zwei Namen ≥60% Übereinstimmung haben, sind es DIESELBEN Artikel.

STATUS-REGELN (strikt):
- Mengen identisch → "ok". Das ist der NORMALFALL.
- Artikel in Lieferschein "nicht_geliefert" (als "fehlt"/durchgestrichen) → "nicht_geliefert", geliefert = 0.
- Bestellt, aber komplett fehlend im Lieferschein → "nicht_geliefert".
- Nur auf dem Lieferschein, nicht bestellt → "nicht_bestellt".
- Mengen verschieden (N ≠ M) → "abweichung" (abweichung = M − N).

WICHTIG:
- Im Zweifel: Status "ok". Niemals eine Abweichung erfinden.
- Für die bestellte Menge: aktuelle Gastronovi-Menge (Feld "menge"); ursprüngliche Menge (menge_urspruenglich) nur für nicht_geliefert-Kennzeichnung.
- Häkchen/Unterschriften/Seitenzahlen sind KEINE Mengen.

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
