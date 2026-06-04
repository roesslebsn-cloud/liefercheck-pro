import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "Server nicht konfiguriert" }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const userToken = authHeader.slice("Bearer ".length);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

    const { data: settings } = await userClient
      .from("user_settings")
      .select("organisation_id, role")
      .eq("user_id", user.id)
      .single();

    if (!settings?.organisation_id) {
      return NextResponse.json({ error: "Keine Organisation" }, { status: 400 });
    }
    if (settings.role !== "chef") {
      return NextResponse.json({ error: "Nur Chefs duerfen Anfragen senden" }, { status: 403 });
    }

    const { email, vorname, password, rolle } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "E-Mail und Passwort erforderlich" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Passwort muss mind. 8 Zeichen lang sein" }, { status: 400 });
    }

    const admin = createClient(url, serviceKey);

    const { data: org } = await admin
      .from("organisationen")
      .select("name")
      .eq("id", settings.organisation_id)
      .single();

    const { data: anfrage, error: anfrageError } = await admin
      .from("mitarbeiter_anfragen")
      .insert({
        organisation_id: settings.organisation_id,
        angefragt_von: user.id,
        angefragt_von_email: user.email,
        email,
        vorname: vorname || null,
        passwort: password,
        rolle: rolle || "mitarbeiter",
        status: "pending",
      })
      .select()
      .single();
    if (anfrageError) throw anfrageError;

    // Email an Admin schicken
    const resendKey = process.env.RESEND_API_KEY;
    const adminEmails = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";

    if (resendKey && adminEmails.length > 0) {
      const approveUrl = `${origin}/api/anfrage/entscheiden?token=${anfrage.approval_token}&aktion=approve`;
      const rejectUrl = `${origin}/api/anfrage/entscheiden?token=${anfrage.approval_token}&aktion=reject`;

      const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="margin:0 0 16px">Neue Mitarbeiter-Anfrage</h2>
  <p>Chef <strong>${user.email}</strong> (Organisation: <strong>${org?.name || "?"}</strong>) moechte einen neuen ${rolle === "chef" ? "Chef" : "Mitarbeiter"} anlegen:</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>E-Mail</b></td><td style="padding:8px;border-bottom:1px solid #eee">${email}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Vorname</b></td><td style="padding:8px;border-bottom:1px solid #eee">${vorname || "-"}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Rolle</b></td><td style="padding:8px;border-bottom:1px solid #eee">${rolle || "mitarbeiter"}</td></tr>
  </table>
  <div style="margin:24px 0">
    <a href="${approveUrl}" style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:8px">Annehmen</a>
    <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Ablehnen</a>
  </div>
  <p style="color:#777;font-size:13px">Oder im Admin-Bereich: <a href="${origin}/admin">${origin}/admin</a></p>
</body></html>`;

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "LieferCheck <noreply@resend.dev>",
            to: adminEmails,
            subject: `Neue Mitarbeiter-Anfrage von ${org?.name || user.email}`,
            html,
          }),
        });
      } catch (e) {
        console.error("[Anfrage] Email-Versand fehlgeschlagen:", e);
      }
    }

    return NextResponse.json({ ok: true, anfrage_id: anfrage.id });
  } catch (error: any) {
    console.error("[Anfrage/Erstellen] Fehler:", error);
    return NextResponse.json({ error: error.message || "Anfrage fehlgeschlagen" }, { status: 500 });
  }
}
