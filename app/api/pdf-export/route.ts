import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// ── Farbpalette ──────────────────────────────────────────────────────────────
const C = {
  navy:      rgb(0.08, 0.10, 0.18),
  navyLight: rgb(0.12, 0.15, 0.26),
  accent:    rgb(0.25, 0.47, 0.95),
  accentBg:  rgb(0.93, 0.96, 1.00),
  white:     rgb(1, 1, 1),
  black:     rgb(0.08, 0.09, 0.12),
  dark:      rgb(0.18, 0.20, 0.26),
  grey:      rgb(0.50, 0.53, 0.60),
  greyLight: rgb(0.88, 0.90, 0.93),
  greyBg:    rgb(0.96, 0.97, 0.98),
  green:     rgb(0.13, 0.70, 0.40),
  greenBg:   rgb(0.90, 0.98, 0.93),
  orange:    rgb(0.95, 0.50, 0.10),
  orangeBg:  rgb(1.00, 0.96, 0.90),
  red:       rgb(0.87, 0.20, 0.20),
  redBg:     rgb(0.99, 0.92, 0.92),
};

const W = 595, H = 842;
const ML = 52, MR = 52;
const CW = W - ML - MR;

function clamp(text: string, font: any, size: number, maxW: number): string {
  let s = String(text ?? "");
  while (s.length > 2 && font.widthOfTextAtSize(s, size) > maxW) s = s.slice(0, -2) + "…";
  return s;
}

function fmtEur(v: any): string {
  const n = parseFloat(String(v ?? ""));
  return isNaN(n) ? "—" : `€ ${n.toFixed(2)}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function POST(request: NextRequest) {
  try {
    const { lieferung } = await request.json();
    if (!lieferung) return NextResponse.json({ error: "Keine Lieferungsdaten" }, { status: 400 });

    const doc = await PDFDocument.create();
    const R  = await doc.embedFont(StandardFonts.Helvetica);
    const B  = await doc.embedFont(StandardFonts.HelveticaBold);

    let page = doc.addPage([W, H]);
    let y = H;

    // ── Seiten-Management ────────────────────────────────────────────────────
    const newPage = () => {
      page = doc.addPage([W, H]);
      y = H - 48;
      // dezente Kopfzeile auf Folgeseiten
      page.drawRectangle({ x: 0, y: H - 28, width: W, height: 28, color: C.navy });
      page.drawText("LieferCheck Pro  ·  Lieferbericht", { x: ML, y: H - 18, size: 8, font: R, color: rgb(0.6, 0.65, 0.75) });
      const pageNum = doc.getPageCount();
      page.drawText(`Seite ${pageNum}`, { x: W - MR, y: H - 18, size: 8, font: R, color: rgb(0.6, 0.65, 0.75) });
      y = H - 44;
    };

    const need = (h: number) => { if (y < h + 60) newPage(); };

    // ── Text-Helfer ──────────────────────────────────────────────────────────
    const txt = (s: string, x: number, yy: number, opts: {
      font?: any; size?: number; color?: any; align?: "l"|"r"|"c"; maxW?: number;
    } = {}) => {
      const { font = R, size = 9.5, color = C.black, align = "l", maxW } = opts;
      let str = maxW ? clamp(s, font, size, maxW) : String(s ?? "");
      const tw = font.widthOfTextAtSize(str, size);
      const dx = align === "r" ? -tw : align === "c" ? -tw / 2 : 0;
      page.drawText(str, { x: x + dx, y: yy, size, font, color });
    };

    const line = (x1: number, yy: number, x2: number, col = C.greyLight, thick = 0.5) =>
      page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: thick, color: col });

    const box = (x: number, yy: number, w: number, h: number, col: any, radius = 0) =>
      page.drawRectangle({ x, y: yy, width: w, height: h, color: col, borderRadius: radius });

    // ══════════════════════════════════════════════════════════════════════════
    // SEITE 1 – HEADER
    // ══════════════════════════════════════════════════════════════════════════
    box(0, H - 90, W, 90, C.navy);

    // Logo-Block
    box(ML, H - 68, 36, 36, C.accent, 6);
    txt("LC", ML + 8, H - 53, { font: B, size: 14, color: C.white });

    txt("LieferCheck Pro", ML + 46, H - 46, { font: B, size: 16, color: C.white });
    txt("LIEFERBERICHT", ML + 46, H - 62, { font: B, size: 8, color: rgb(0.55, 0.62, 0.80), align: "l" });

    // Datum + ID rechts
    const datumStr = fmtDate(lieferung.erstellt_am || lieferung.created_at);
    txt(datumStr, W - MR, H - 46, { font: B, size: 11, color: C.white, align: "r" });
    txt(`ID: ${(lieferung.id || "").slice(0, 8).toUpperCase()}`, W - MR, H - 61, { size: 8, color: rgb(0.55, 0.62, 0.80), align: "r" });

    y = H - 106;

    // ── Status-Banner ────────────────────────────────────────────────────────
    const isAbgeschlossen = lieferung.status === "abgeschlossen";
    const bannerCol  = isAbgeschlossen ? C.greenBg  : C.orangeBg;
    const bannerTxt  = isAbgeschlossen ? C.green    : C.orange;
    const bannerLabel = isAbgeschlossen ? "✓  Freigegeben" : "●  Offen";

    box(ML, y - 6, 130, 22, bannerCol, 4);
    txt(bannerLabel, ML + 10, y + 3, { font: B, size: 9, color: bannerTxt });

    // Ersparnis rechts
    if (lieferung.ersparnis_eur > 0) {
      const espStr = `Erkannte Ersparnis: ${fmtEur(lieferung.ersparnis_eur)}`;
      const espW = B.widthOfTextAtSize(espStr, 10) + 20;
      box(W - MR - espW, y - 6, espW, 22, C.accentBg, 4);
      txt(espStr, W - MR - 10, y + 3, { font: B, size: 10, color: C.accent, align: "r" });
    }

    y -= 30;
    line(ML, y, W - MR, C.greyLight, 1);
    y -= 18;

    // ══════════════════════════════════════════════════════════════════════════
    // ÜBERSICHTS-KARTEN (3er-Reihe)
    // ══════════════════════════════════════════════════════════════════════════
    const r = lieferung.rechnung_data || {};
    const abgleich: any[] = lieferung.abgleich_data?.abgleich || [];
    const abweichungen = abgleich.filter((a: any) => a.status !== "ok");
    const preisAbw: any[] = r.preisabweichungen || [];

    const cards = [
      { label: "Lieferant",    val: r.lieferant || "—" },
      { label: "Rechnungs-Nr.",val: r.rechnungs_nummer || "—" },
      { label: "Rechnungsdatum",val: r.datum || "—" },
    ];

    const cw3 = (CW - 16) / 3;
    cards.forEach((c, i) => {
      const cx = ML + i * (cw3 + 8);
      box(cx, y - 38, cw3, 48, C.greyBg, 4);
      txt(c.label, cx + 10, y - 5, { size: 8, color: C.grey });
      txt(c.val, cx + 10, y - 22, { font: B, size: 9.5, color: C.dark, maxW: cw3 - 16 });
    });
    y -= 54;

    // ── Betragszeile ─────────────────────────────────────────────────────────
    const betraege = [
      { label: "Netto",  val: fmtEur(r.netto) },
      { label: "MwSt",   val: fmtEur(r.mwst) },
      { label: "Brutto", val: fmtEur(r.brutto), bold: true },
    ];
    const bw = (CW - 16) / 3;
    betraege.forEach((b, i) => {
      const cx = ML + i * (bw + 8);
      const bgCol = i === 2 ? C.accentBg : C.greyBg;
      const fc    = i === 2 ? C.accent   : C.dark;
      box(cx, y - 30, bw, 38, bgCol, 4);
      txt(b.label, cx + 10, y - 6, { size: 7.5, color: C.grey });
      txt(b.val, cx + bw - 10, y - 22, { font: b.bold ? B : R, size: 12, color: fc, align: "r" });
    });
    y -= 46;

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION-HELPER
    // ══════════════════════════════════════════════════════════════════════════
    const section = (title: string) => {
      need(60);
      y -= 10;
      box(ML, y - 4, CW, 22, C.navy, 4);
      txt(title.toUpperCase(), ML + 12, y + 4, { font: B, size: 8, color: rgb(0.7, 0.78, 0.95) });
      y -= 30;
    };

    const tableHeader = (cols: { label: string; x: number; align?: "l"|"r" }[]) => {
      cols.forEach(c => txt(c.label, c.x, y, { font: B, size: 8, color: C.grey, align: c.align || "l" }));
      y -= 12;
      line(ML, y, W - MR, C.greyLight);
      y -= 10;
    };

    const tableRow = (cols: { val: string; x: number; align?: "l"|"r"; color?: any; bold?: boolean; maxW?: number }[], shade: boolean) => {
      need(20);
      if (shade) box(ML, y - 4, CW, 17, C.greyBg, 2);
      cols.forEach(c => txt(c.val, c.x, y, { font: c.bold ? B : R, size: 9, color: c.color || C.dark, align: c.align || "l", maxW: c.maxW }));
      y -= 17;
    };

    // ══════════════════════════════════════════════════════════════════════════
    // RECHNUNGSPOSITIONEN
    // ══════════════════════════════════════════════════════════════════════════
    const positionen: any[] = r.positionen || [];
    if (positionen.length > 0) {
      section("Rechnungspositionen");
      const c0 = ML + 8, c1 = ML + CW * 0.52, c2 = ML + CW * 0.67, c3 = W - MR - 8;
      tableHeader([
        { label: "Artikel", x: c0 },
        { label: "Menge",   x: c1 },
        { label: "Einzelpr.", x: c2 },
        { label: "Gesamt",  x: c3, align: "r" },
      ]);
      positionen.forEach((p: any, i: number) => {
        need(20);
        tableRow([
          { val: p.artikel || "—", x: c0, maxW: CW * 0.49 },
          { val: String(p.menge ?? "—"), x: c1 },
          { val: p.einzelpreis != null ? fmtEur(p.einzelpreis) : "—", x: c2 },
          { val: p.gesamtpreis != null ? fmtEur(p.gesamtpreis) : "—", x: c3, align: "r" },
        ], i % 2 === 0);
      });

      // Summenzeile
      need(28);
      y -= 4;
      line(ML, y, W - MR, C.dark, 1);
      y -= 14;
      txt("Rechnungsbetrag (Brutto)", ML + 8, y, { font: B, size: 9.5, color: C.dark });
      txt(fmtEur(r.brutto), W - MR - 8, y, { font: B, size: 11, color: C.accent, align: "r" });
      y -= 20;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // BESTELL-LIEFERABGLEICH
    // ══════════════════════════════════════════════════════════════════════════
    if (abgleich.length > 0) {
      section("Bestell-Lieferabgleich");

      // Kurzinfo
      const okCount = abgleich.length - abweichungen.length;
      need(20);
      box(ML, y - 4, 80, 18, C.greenBg, 4);
      txt(`✓  ${okCount} korrekt`, ML + 8, y + 1, { font: B, size: 8.5, color: C.green });
      if (abweichungen.length > 0) {
        box(ML + 88, y - 4, 100, 18, C.orangeBg, 4);
        txt(`⚠  ${abweichungen.length} Abweichung(en)`, ML + 96, y + 1, { font: B, size: 8.5, color: C.orange });
      }
      y -= 28;

      const c0 = ML + 8, c1 = ML + CW * 0.52, c2 = ML + CW * 0.66, c3 = W - MR - 8;
      tableHeader([
        { label: "Artikel",    x: c0 },
        { label: "Bestellt",   x: c1 },
        { label: "Geliefert",  x: c2 },
        { label: "Abweichung", x: c3, align: "r" },
      ]);

      abgleich.forEach((item: any, i: number) => {
        need(20);
        const isOk   = item.status === "ok";
        const diff   = item.abweichung ?? 0;
        const diffCol = isOk ? C.green : diff < 0 ? C.red : C.orange;
        const diffStr = isOk ? "—" : (diff > 0 ? "+" : "") + diff;
        tableRow([
          { val: item.artikel || "—", x: c0, maxW: CW * 0.49 },
          { val: String(item.bestellt  ?? "—"), x: c1 },
          { val: String(item.geliefert ?? "—"), x: c2 },
          { val: diffStr, x: c3, align: "r", color: diffCol, bold: !isOk },
        ], i % 2 === 0);
      });
      y -= 6;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PREISABWEICHUNGEN
    // ══════════════════════════════════════════════════════════════════════════
    if (preisAbw.length > 0) {
      section(`Preisabweichungen zur Preisliste (${preisAbw.length})`);
      const c0 = ML + 8, c1 = ML + CW * 0.46, c2 = ML + CW * 0.62, c3 = W - MR - 8;
      tableHeader([
        { label: "Artikel",    x: c0 },
        { label: "Rechnung",   x: c1 },
        { label: "Preisliste", x: c2 },
        { label: "Differenz",  x: c3, align: "r" },
      ]);
      preisAbw.forEach((a: any, i: number) => {
        need(20);
        const diff = parseFloat(a.abweichung_eur ?? 0);
        tableRow([
          { val: a.artikel || "—", x: c0, maxW: CW * 0.44 },
          { val: fmtEur(a.preis_rechnung), x: c1 },
          { val: fmtEur(a.preis_liste),    x: c2 },
          { val: `${diff > 0 ? "+" : ""}${fmtEur(diff)} (${a.abweichung_prozent}%)`, x: c3, align: "r", color: diff > 0 ? C.red : C.green, bold: true },
        ], i % 2 === 0);
      });

      // Summe Preisabweichungen
      const gesamtDiff = preisAbw.reduce((s: number, a: any) => s + parseFloat(a.abweichung_eur ?? 0), 0);
      if (Math.abs(gesamtDiff) > 0.01) {
        need(28);
        y -= 4;
        line(ML, y, W - MR, C.dark, 1);
        y -= 14;
        txt("Gesamte Preisabweichung", ML + 8, y, { font: B, size: 9.5, color: C.dark });
        txt(`${gesamtDiff > 0 ? "+" : ""}${fmtEur(gesamtDiff)}`, W - MR - 8, y, { font: B, size: 11, color: gesamtDiff > 0 ? C.red : C.green, align: "r" });
        y -= 20;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PFAND-SALDO
    // ══════════════════════════════════════════════════════════════════════════
    const pfand: any[] = lieferung.pfand_items?.artikel || [];
    const pfandEintrage: any[] = lieferung.lieferschein_data?.pfand_eintrage || [];
    if (pfand.length > 0) {
      section("Pfand-Saldo");
      const c0 = ML + 8, c1 = ML + CW * 0.50, c2 = ML + CW * 0.68, c3 = W - MR - 8;
      tableHeader([
        { label: "Artikel",    x: c0 },
        { label: "Mitgegeben", x: c1 },
        { label: "Laut Fahrer",x: c2 },
        { label: "Differenz",  x: c3, align: "r" },
      ]);
      pfand.forEach((p: any, i: number) => {
        const fahrer = pfandEintrage.find((f: any) => f.artikel?.toLowerCase() === p.name?.toLowerCase());
        const diff = fahrer ? p.menge - fahrer.menge : p.menge;
        tableRow([
          { val: p.name || "—", x: c0, maxW: CW * 0.48 },
          { val: String(p.menge), x: c1 },
          { val: fahrer ? String(fahrer.menge) : "—", x: c2 },
          { val: diff === 0 ? "0" : (diff > 0 ? "+" : "") + diff, x: c3, align: "r", color: diff !== 0 ? C.red : C.green, bold: diff !== 0 },
        ], i % 2 === 0);
      });
      y -= 6;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // NOTIZ
    // ══════════════════════════════════════════════════════════════════════════
    if (lieferung.notiz?.trim()) {
      section("Notiz");
      need(40);
      box(ML, y - 8, CW, 30, C.greyBg, 4);
      txt(clamp(lieferung.notiz.trim(), R, 9.5, CW - 24), ML + 12, y, { size: 9.5, color: C.dark });
      y -= 44;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FREIGABE-ZEILE
    // ══════════════════════════════════════════════════════════════════════════
    need(70);
    y -= 14;
    line(ML, y, W - MR, C.greyLight, 1);
    y -= 20;
    section("Freigabe & Unterschrift");

    const sigBoxW = (CW - 16) / 2;
    [0, 1].forEach(i => {
      const sx = ML + i * (sigBoxW + 16);
      box(sx, y - 32, sigBoxW, 40, C.greyBg, 4);
      const label = i === 0 ? "Geprüft von" : "Datum / Uhrzeit";
      const value = i === 0
        ? (isAbgeschlossen ? "Freigegeben" : "_____________________")
        : (isAbgeschlossen ? `${fmtDate(lieferung.freigabe_am || lieferung.erstellt_am)}` : "_____________");
      txt(label, sx + 10, y - 6, { size: 7.5, color: C.grey });
      txt(value,  sx + 10, y - 22, { font: B, size: 9.5, color: C.dark });
    });
    y -= 50;

    // ══════════════════════════════════════════════════════════════════════════
    // FOOTER auf allen Seiten
    // ══════════════════════════════════════════════════════════════════════════
    const pages = doc.getPages();
    const total = pages.length;
    pages.forEach((p, i) => {
      p.drawRectangle({ x: 0, y: 0, width: W, height: 28, color: C.navy });
      p.drawText(
        `LieferCheck Pro  ·  Lieferbericht  ·  Generiert am ${new Date().toLocaleDateString("de-DE")}`,
        { x: ML, y: 10, size: 7.5, font: R, color: rgb(0.5, 0.56, 0.70) }
      );
      p.drawText(`Seite ${i + 1} / ${total}`, {
        x: W - MR, y: 10, size: 7.5, font: R,
        color: rgb(0.5, 0.56, 0.70),
      });
    });

    const pdfBytes = await doc.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="lieferbericht-${(lieferung.id || "").slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[PDF-Export] Fehler:", err);
    return NextResponse.json({ error: "PDF-Generierung fehlgeschlagen" }, { status: 500 });
  }
}
