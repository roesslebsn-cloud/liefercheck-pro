import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function htmlPage(title: string, body: string, color: string = "#1a1a1a") {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px">
  <div style="max-width:480px;text-align:center;padding:32px;border-radius:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">
    <h1 style="margin:0 0 16px;color:${color}">${title}</h1>
    <div style="color:rgba(255,255,255,0.7)">${body}</div>
    <a href="/admin" style="display:inline-block;margin-top:24px;color:#7c3aed;text-decoration:none">Zum Admin-Bereich &rarr;</a>
  </div>
</body></html>`;
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey);

  const token = request.nextUrl.searchParams.get("token");
  const aktion = request.nextUrl.searchParams.get("aktion");

  if (!token || !aktion || !["approve", "reject"].includes(aktion)) {
    return new NextResponse(htmlPage("Ungültiger Link", "Bitte den vollständigen Link aus der E-Mail öffnen.", "#dc2626"), {
      headers: { "Content-Type": "text/html" },
      status: 400,
    });
  }

  const { data: anfrage } = await admin
    .from("mitarbeiter_anfragen")
    .select("*")
    .eq("approval_token", token)
    .single();

  if (!anfrage) {
    return new NextResponse(htmlPage("Anfrage nicht gefunden", "Möglicherweise wurde sie bereits bearbeitet oder der Token ist ungültig.", "#dc2626"), {
      headers: { "Content-Type": "text/html" },
      status: 404,
    });
  }

  if (anfrage.status !== "pending") {
    return new NextResponse(htmlPage(
      "Bereits bearbeitet",
      `Diese Anfrage wurde bereits am ${new Date(anfrage.bearbeitet_am).toLocaleString("de-DE")} ${anfrage.status === "approved" ? "angenommen" : "abgelehnt"}.`,
      "#f59e0b"
    ), {
      headers: { "Content-Type": "text/html" },
      status: 200,
    });
  }

  if (aktion === "reject") {
    await admin
      .from("mitarbeiter_anfragen")
      .update({ status: "rejected", bearbeitet_am: new Date().toISOString() })
      .eq("id", anfrage.id);

    await admin.from("audit_log").insert({
      aktion: "anfrage_abgelehnt",
      entity_type: "mitarbeiter_anfrage",
      entity_id: anfrage.id,
      details: { email: anfrage.email, organisation_id: anfrage.organisation_id },
    });

    return new NextResponse(htmlPage(
      "Anfrage abgelehnt",
      `Die Anfrage für <b style="color:#fff">${anfrage.email}</b> wurde abgelehnt.<br>Es wurde kein Account angelegt.`,
      "#dc2626"
    ), { headers: { "Content-Type": "text/html" } });
  }

  // APPROVE
  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: anfrage.email,
      password: anfrage.passwort,
      email_confirm: true,
      user_metadata: {
        vorname: anfrage.vorname,
        organisation_id: anfrage.organisation_id,
        role: anfrage.rolle,
      },
    });
    if (createError) throw createError;

    const newUserId = created.user?.id;
    if (newUserId) {
      await admin.from("user_settings").upsert({
        user_id: newUserId,
        role: anfrage.rolle,
        vorname: anfrage.vorname,
        organisation_id: anfrage.organisation_id,
        wochen_bericht_aktiv: false,
        passwort_temporaer: false,
      });
    }

    await admin
      .from("mitarbeiter_anfragen")
      .update({ status: "approved", bearbeitet_am: new Date().toISOString() })
      .eq("id", anfrage.id);

    await admin.from("audit_log").insert({
      aktion: "anfrage_angenommen",
      entity_type: "mitarbeiter_anfrage",
      entity_id: anfrage.id,
      details: {
        email: anfrage.email,
        vorname: anfrage.vorname,
        rolle: anfrage.rolle,
        organisation_id: anfrage.organisation_id,
        new_user_id: newUserId,
      },
    });

    return new NextResponse(htmlPage(
      "Anfrage angenommen",
      `Der Account für <b style="color:#fff">${anfrage.email}</b> wurde angelegt.<br>Der Chef wurde benachrichtigt und kann der Person Email + Passwort mitteilen.`,
      "#16a34a"
    ), { headers: { "Content-Type": "text/html" } });
  } catch (err: any) {
    return new NextResponse(htmlPage(
      "Fehler beim Anlegen",
      `Konnte den Account nicht erstellen: ${err.message}.<br>Möglicherweise existiert die E-Mail-Adresse bereits.`,
      "#dc2626"
    ), { headers: { "Content-Type": "text/html" }, status: 500 });
  }
}
