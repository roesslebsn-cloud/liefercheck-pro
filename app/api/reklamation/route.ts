import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Absender per ENV konfigurierbar. Default = Resend-Test-Absender (funktioniert ohne
// verifizierte Domain, sendet aber nur an die eigene Resend-Account-Adresse).
// Nach Domain-Verifizierung einfach RESEND_FROM_EMAIL setzen, z.B.:
//   RESEND_FROM_EMAIL="LieferCheck Pro <reklamation@deine-domain.de>"
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "LieferCheck Pro <onboarding@resend.dev>";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "E-Mail-Versand nicht konfiguriert (RESEND_API_KEY fehlt)." },
        { status: 500 }
      );
    }

    const { lieferung, empfaengerEmail, absenderName, zusatzText, pdfBase64 } = await request.json();

    if (!empfaengerEmail) {
      return NextResponse.json({ error: "Empfänger-E-Mail fehlt" }, { status: 400 });
    }

    const r = lieferung?.rechnung_data;
    const abgleich = lieferung?.abgleich_data?.abgleich?.filter((a: any) => a.status !== "ok") || [];
    const preisAbweichungen = r?.preisabweichungen || [];

    const rechnungsNr = r?.rechnungs_nummer || lieferung?.id?.slice(0, 8) || "-";
    const lieferant = r?.lieferant || "Ihr Unternehmen";
    const datum = lieferung?.erstellt_am
      ? new Date(lieferung.erstellt_am).toLocaleDateString("de-DE")
      : new Date().toLocaleDateString("de-DE");

    const mengenAbweichungenHtml = abgleich.length > 0
      ? `<h3 style="margin-top:24px;margin-bottom:8px;font-size:14px;font-weight:600;color:#1f2937;">Mengenabweichungen</h3>
         <table style="width:100%;border-collapse:collapse;font-size:13px;">
           <thead>
             <tr style="background:#f3f4f6;">
               <th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb;">Artikel</th>
               <th style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;">Bestellt</th>
               <th style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;">Geliefert</th>
               <th style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;">Differenz</th>
             </tr>
           </thead>
           <tbody>
             ${abgleich.map((a: any) => `
               <tr>
                 <td style="padding:8px 12px;border:1px solid #e5e7eb;">${a.artikel}</td>
                 <td style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;">${a.bestellt}</td>
                 <td style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;">${a.geliefert}</td>
                 <td style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;color:${a.abweichung < 0 ? "#dc2626" : "#d97706"};">${a.abweichung > 0 ? "+" : ""}${a.abweichung}</td>
               </tr>
             `).join("")}
           </tbody>
         </table>`
      : "";

    const preisAbweichungenHtml = preisAbweichungen.length > 0
      ? `<h3 style="margin-top:24px;margin-bottom:8px;font-size:14px;font-weight:600;color:#1f2937;">Preisabweichungen</h3>
         <table style="width:100%;border-collapse:collapse;font-size:13px;">
           <thead>
             <tr style="background:#f3f4f6;">
               <th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb;">Artikel</th>
               <th style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;">Rechnung</th>
               <th style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;">Vereinbart</th>
               <th style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;">Differenz</th>
             </tr>
           </thead>
           <tbody>
             ${preisAbweichungen.map((a: any) => `
               <tr>
                 <td style="padding:8px 12px;border:1px solid #e5e7eb;">${a.artikel}</td>
                 <td style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;">€${parseFloat(a.preis_rechnung).toFixed(2)}</td>
                 <td style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;">€${parseFloat(a.preis_liste).toFixed(2)}</td>
                 <td style="padding:8px 12px;text-align:right;border:1px solid #e5e7eb;color:#dc2626;">${a.abweichung_eur > 0 ? "+" : ""}€${parseFloat(a.abweichung_eur).toFixed(2)} (${a.abweichung_prozent}%)</td>
               </tr>
             `).join("")}
           </tbody>
         </table>`
      : "";

    const gesamtAbweichungEur = preisAbweichungen.reduce((sum: number, a: any) => sum + (a.abweichung_eur > 0 ? a.abweichung_eur : 0), 0);

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#374151;max-width:640px;margin:0 auto;padding:32px 16px;">
  <div style="border-bottom:2px solid #3b82f6;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0;">Reklamation – Lieferung vom ${datum}</h1>
    <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Rechnungsnummer: ${rechnungsNr}</p>
  </div>

  <p>Sehr geehrte Damen und Herren,</p>

  <p>vielen Dank für Ihre Lieferung vom <strong>${datum}</strong>. Bei der Überprüfung der Lieferung mit unserer Warenwirtschaft wurden folgende Abweichungen festgestellt, zu denen wir Sie um Prüfung und Rückmeldung bitten:</p>

  ${mengenAbweichungenHtml}
  ${preisAbweichungenHtml}

  ${gesamtAbweichungEur > 0.01 ? `<div style="margin-top:24px;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
    <p style="margin:0;font-weight:600;color:#dc2626;">Bitte stellen Sie eine Gutschrift über €${gesamtAbweichungEur.toFixed(2)} aus.</p>
  </div>` : ""}

  ${zusatzText ? `<p style="margin-top:16px;">${zusatzText}</p>` : ""}

  <p style="margin-top:24px;">Wir bitten Sie, die aufgeführten Abweichungen zu prüfen und uns bis spätestens 14 Tage nach Erhalt dieses Schreibens eine Rückmeldung zukommen zu lassen.</p>

  <p>Mit freundlichen Grüßen,<br><strong>${absenderName || "Ihre Gastronomie"}</strong></p>

  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
    Erstellt mit LieferCheck Pro – automatische Lieferprüfung für die Gastronomie
  </div>
</body>
</html>`;

    // Optionaler PDF-Anhang (Lieferbericht)
    const attachments: { filename: string; content: Buffer }[] = [];
    if (pdfBase64) {
      try {
        const cleaned = pdfBase64.replace(/^data:.*?;base64,/, "");
        attachments.push({
          filename: `lieferbericht-${(lieferung?.id || "").slice(0, 8)}.pdf`,
          content: Buffer.from(cleaned, "base64"),
        });
      } catch {
        // Anhang optional – ignorieren
      }
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: empfaengerEmail,
      subject: `Reklamation Lieferung ${datum} – Rechnungsnr. ${rechnungsNr}`,
      html,
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    if (error) {
      console.error("[Reklamation] Resend Fehler:", error);
      // Echte Resend-Meldung durchreichen (z.B. "domain not verified",
      // "you can only send to your own email address")
      const msg = (error as any)?.message || "E-Mail-Versand fehlgeschlagen";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Reklamation] Fehler:", error);
    return NextResponse.json({ error: "Reklamation fehlgeschlagen" }, { status: 500 });
  }
}
