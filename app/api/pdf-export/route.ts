import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const BLUE = rgb(0.23, 0.51, 0.96);
const DARK = rgb(0.05, 0.06, 0.09);
const GREY = rgb(0.45, 0.48, 0.55);
const LIGHT_GREY = rgb(0.9, 0.91, 0.93);
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.2, 0.75, 0.45);
const ORANGE = rgb(0.98, 0.45, 0.09);
const RED = rgb(0.95, 0.25, 0.25);

function clamp(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export async function POST(request: NextRequest) {
  try {
    const { lieferung } = await request.json();
    if (!lieferung) return NextResponse.json({ error: "Keine Lieferungsdaten" }, { status: 400 });

    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const W = 595, H = 842;
    const marginLeft = 48, marginRight = 48;
    const contentWidth = W - marginLeft - marginRight;

    let page = pdfDoc.addPage([W, H]);
    let y = H - 48;

    const addPage = () => {
      page = pdfDoc.addPage([W, H]);
      y = H - 48;
    };

    const checkY = (needed: number) => {
      if (y < needed + 48) addPage();
    };

    const text = (str: string, x: number, yPos: number, opts: {
      font?: typeof fontBold; size?: number; color?: typeof BLUE; align?: "left" | "right" | "center"; maxWidth?: number;
    } = {}) => {
      const { font = fontRegular, size = 10, color = DARK, align = "left", maxWidth } = opts;
      let s = str;
      if (maxWidth) {
        while (font.widthOfTextAtSize(s, size) > maxWidth && s.length > 3) s = s.slice(0, -2) + "…";
      }
      const tw = font.widthOfTextAtSize(s, size);
      let drawX = x;
      if (align === "right") drawX = x - tw;
      if (align === "center") drawX = x - tw / 2;
      page.drawText(s, { x: drawX, y: yPos, size, font, color });
    };

    const hrLine = (yPos: number, col = LIGHT_GREY) => {
      page.drawLine({ start: { x: marginLeft, y: yPos }, end: { x: W - marginRight, y: yPos }, thickness: 0.5, color: col });
    };

    const rect = (x: number, yPos: number, w: number, h: number, color: typeof BLUE) => {
      page.drawRectangle({ x, y: yPos, width: w, height: h, color });
    };

    // ── HEADER ──
    rect(0, H - 80, W, 80, DARK);
    text("LieferCheck Pro", marginLeft, H - 32, { font: fontBold, size: 16, color: WHITE });
    text("Lieferbericht", marginLeft, H - 50, { size: 10, color: rgb(0.5, 0.55, 0.65) });

    const datum = lieferung.erstellt_am || lieferung.created_at;
    const datumStr = datum ? new Date(datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
    text(`Datum: ${datumStr}`, W - marginRight, H - 32, { align: "right", size: 10, color: LIGHT_GREY });
    text(`ID: ${(lieferung.id || "").slice(0, 8).toUpperCase()}`, W - marginRight, H - 48, { align: "right", size: 9, color: rgb(0.5, 0.55, 0.65) });

    y = H - 100;

    // ── STATUS BADGE ──
    const statusColor = lieferung.status === "abgeschlossen" ? GREEN : ORANGE;
    rect(marginLeft, y - 4, 90, 20, statusColor);
    text(lieferung.status === "abgeschlossen" ? "Abgeschlossen" : "Offen", marginLeft + 8, y + 2, { font: fontBold, size: 9, color: WHITE });
    if (lieferung.ersparnis_eur > 0) {
      text(`Ersparnis erkannt: €${parseFloat(lieferung.ersparnis_eur).toFixed(2)}`, W - marginRight, y + 2, { align: "right", size: 10, color: BLUE, font: fontBold });
    }
    y -= 28;
    hrLine(y);
    y -= 20;

    // ── SECTION HELPER ──
    const sectionTitle = (title: string) => {
      checkY(50);
      rect(marginLeft, y - 4, contentWidth, 22, rgb(0.08, 0.1, 0.14));
      text(title, marginLeft + 8, y + 4, { font: fontBold, size: 10, color: WHITE });
      y -= 30;
    };

    const kv = (label: string, value: string, col2 = false) => {
      checkY(18);
      const x = col2 ? marginLeft + contentWidth / 2 : marginLeft;
      text(label, x, y, { size: 9, color: GREY });
      text(value || "—", x, y - 12, { font: fontBold, size: 10, color: DARK, maxWidth: contentWidth / 2 - 10 });
      if (!col2) y -= 28;
    };

    // ── RECHNUNGSDATEN ──
    if (lieferung.rechnung_data) {
      const r = lieferung.rechnung_data;
      sectionTitle("Rechnungsdaten");
      kv("Lieferant", r.lieferant || "—");
      kv("Rechnungsnummer", r.rechnungs_nummer || "—");
      kv("Datum", r.datum || "—");
      kv("Netto", r.netto != null ? `€${parseFloat(r.netto).toFixed(2)}` : "—");
      kv("MwSt", r.mwst != null ? `€${parseFloat(r.mwst).toFixed(2)}` : "—");
      kv("Brutto", r.brutto != null ? `€${parseFloat(r.brutto).toFixed(2)}` : "—", false);
      y -= 8;
    }

    // ── POSITIONEN ──
    if (lieferung.rechnung_data?.positionen?.length > 0) {
      sectionTitle("Rechnungspositionen");
      const cols = [marginLeft, marginLeft + contentWidth * 0.5, marginLeft + contentWidth * 0.7, marginLeft + contentWidth * 0.85];
      const headers = ["Artikel", "Menge", "Einzelpreis", "Gesamt"];
      headers.forEach((h, i) => text(h, cols[i], y, { size: 9, color: GREY, font: fontBold }));
      y -= 14;
      hrLine(y);
      y -= 10;

      for (const pos of lieferung.rechnung_data.positionen) {
        checkY(18);
        text(clamp(pos.artikel || "", 45), cols[0], y, { size: 9, maxWidth: contentWidth * 0.48 });
        text(String(pos.menge ?? "—"), cols[1], y, { size: 9 });
        text(pos.einzelpreis != null ? `€${parseFloat(pos.einzelpreis).toFixed(2)}` : "—", cols[2], y, { size: 9 });
        text(pos.gesamtpreis != null ? `€${parseFloat(pos.gesamtpreis).toFixed(2)}` : "—", cols[3], y, { size: 9 });
        y -= 16;
      }
      y -= 8;
    }

    // ── ABGLEICH ──
    if (lieferung.abgleich_data?.abgleich?.length > 0) {
      sectionTitle("Bestell-Lieferabgleich");
      const abweichungen = lieferung.abgleich_data.abgleich.filter((a: any) => a.status !== "ok");
      const ok = lieferung.abgleich_data.abgleich.filter((a: any) => a.status === "ok");

      if (abweichungen.length === 0) {
        checkY(20);
        text("✓ Alle Positionen korrekt geliefert – keine Abweichungen", marginLeft, y, { size: 10, color: GREEN, font: fontBold });
        y -= 20;
      } else {
        checkY(18);
        text(`${ok.length} OK  ·  ${abweichungen.length} Abweichung(en)`, marginLeft, y, { size: 9, color: GREY });
        y -= 20;
        const cols = [marginLeft, marginLeft + contentWidth * 0.45, marginLeft + contentWidth * 0.6, marginLeft + contentWidth * 0.75];
        ["Artikel", "Bestellt", "Geliefert", "Abweichung"].forEach((h, i) => text(h, cols[i], y, { size: 9, color: GREY, font: fontBold }));
        y -= 14;
        hrLine(y);
        y -= 10;
        for (const item of abweichungen) {
          checkY(18);
          text(clamp(item.artikel || "", 40), cols[0], y, { size: 9, maxWidth: contentWidth * 0.43 });
          text(String(item.bestellt ?? "—"), cols[1], y, { size: 9 });
          text(String(item.geliefert ?? "—"), cols[2], y, { size: 9 });
          const diff = item.abweichung ?? 0;
          text((diff > 0 ? "+" : "") + diff, cols[3], y, { size: 9, color: diff < 0 ? RED : ORANGE, font: fontBold });
          y -= 16;
        }
      }
      y -= 8;
    }

    // ── PREISABWEICHUNGEN ──
    if (lieferung.rechnung_data?.preisabweichungen?.length > 0) {
      sectionTitle("Preisabweichungen zur Preisliste");
      const cols = [marginLeft, marginLeft + contentWidth * 0.45, marginLeft + contentWidth * 0.62, marginLeft + contentWidth * 0.79];
      ["Artikel", "Rechnung", "Preisliste", "Differenz"].forEach((h, i) => text(h, cols[i], y, { size: 9, color: GREY, font: fontBold }));
      y -= 14;
      hrLine(y);
      y -= 10;
      for (const a of lieferung.rechnung_data.preisabweichungen) {
        checkY(18);
        text(clamp(a.artikel || "", 40), cols[0], y, { size: 9, maxWidth: contentWidth * 0.43 });
        text(`€${parseFloat(a.preis_rechnung).toFixed(2)}`, cols[1], y, { size: 9 });
        text(`€${parseFloat(a.preis_liste).toFixed(2)}`, cols[2], y, { size: 9 });
        const diff = parseFloat(a.abweichung_eur);
        text(`${diff > 0 ? "+" : ""}€${diff.toFixed(2)} (${a.abweichung_prozent}%)`, cols[3], y, { size: 9, color: diff > 0 ? RED : GREEN, font: fontBold });
        y -= 16;
      }
      y -= 8;
    }

    // ── NOTIZ ──
    if (lieferung.notiz) {
      sectionTitle("Notiz");
      checkY(30);
      text(clamp(lieferung.notiz, 120), marginLeft, y, { size: 9, color: DARK, maxWidth: contentWidth });
      y -= 20;
    }

    // ── FOOTER ──
    const pages = pdfDoc.getPages();
    pages.forEach((p, i) => {
      p.drawText(`LieferCheck Pro · Generiert am ${new Date().toLocaleDateString("de-DE")} · Seite ${i + 1}/${pages.length}`, {
        x: marginLeft, y: 24, size: 8, font: fontRegular, color: GREY,
      });
    });

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="lieferbericht-${(lieferung.id || "").slice(0, 8)}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[PDF-Export] Fehler:", error);
    return NextResponse.json({ error: "PDF-Generierung fehlgeschlagen" }, { status: 500 });
  }
}
