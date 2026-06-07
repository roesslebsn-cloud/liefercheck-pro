import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { name, firma, email, telefon, paket, nachricht } = await req.json();

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name und E-Mail erforderlich." }, { status: 400 });
  }

  // ─── 1. In Supabase speichern ─────────────────────────────────────────
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await sb.from("interessenten").insert({ name, firma, email, telefon, paket, nachricht });
  } catch (e) {
    // Tabelle existiert noch nicht → Migration ausstehend. Kein harter Fehler.
    console.warn("[kontakt] DB-Insert fehlgeschlagen (Migration ausstehend?):", e);
  }

  // ─── 2. E-Mail an Admin senden ────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY;
  const adminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "liefercheck.pro@gmail.com")
    .split(",").map((s) => s.trim()).filter(Boolean);

  if (resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "LieferCheck Pro <onboarding@resend.dev>",
          to: adminEmails,
          subject: `🆕 Neue Anfrage: ${name}${firma ? ` – ${firma}` : ""} [${paket || "kein Paket"}]`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#6366f1;">Neue Interessenten-Anfrage</h2>
              <table style="border-collapse:collapse;width:100%;">
                <tr><td style="padding:8px 0;color:#666;width:140px;">Name</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Betrieb / Firma</td><td style="padding:8px 0;">${firma || "–"}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">E-Mail</td><td style="padding:8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
                <tr><td style="padding:8px 0;color:#666;">Telefon</td><td style="padding:8px 0;">${telefon || "–"}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Gewähltes Paket</td><td style="padding:8px 0;">${paket || "–"}</td></tr>
                <tr><td style="padding:8px 0;color:#666;">Nachricht</td><td style="padding:8px 0;">${nachricht || "–"}</td></tr>
              </table>
              <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
              <p style="color:#999;font-size:13px;">Im Admin-Dashboard ansehen: <a href="https://liefercheck-pro.vercel.app/admin/anfragen">Admin → Anfragen</a></p>
            </div>
          `,
        }),
      });
    } catch (e) {
      console.error("[kontakt] Resend-Fehler:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
