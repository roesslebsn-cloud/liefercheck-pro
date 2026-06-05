import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, adminAudit } from "../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/announcement – aktuelle Plattform-Ankündigung (Single-Row id=1).
export async function GET(request: NextRequest) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin } = ctx;

  try {
    const { data } = await admin
      .from("plattform_einstellungen")
      .select("ankuendigung_text, ankuendigung_aktiv, ankuendigung_typ, aktualisiert_am")
      .eq("id", 1)
      .single();
    return NextResponse.json(data || { ankuendigung_text: "", ankuendigung_aktiv: false, ankuendigung_typ: "info" });
  } catch (e: any) {
    console.error("[Admin/Announcement GET] Fehler:", e);
    return NextResponse.json({ error: e.message || "Fehler beim Laden" }, { status: 500 });
  }
}

// PUT /api/admin/announcement – Ankündigung setzen/aktualisieren.
export async function PUT(request: NextRequest) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin, user } = ctx;

  try {
    const { ankuendigung_text, ankuendigung_aktiv, ankuendigung_typ } = await request.json();
    const typ = ["info", "warnung", "wartung"].includes(ankuendigung_typ) ? ankuendigung_typ : "info";

    const { data, error: upErr } = await admin
      .from("plattform_einstellungen")
      .upsert({
        id: 1,
        ankuendigung_text: ankuendigung_text || null,
        ankuendigung_aktiv: !!ankuendigung_aktiv,
        ankuendigung_typ: typ,
        aktualisiert_am: new Date().toISOString(),
      })
      .select()
      .single();
    if (upErr) throw upErr;

    await adminAudit(admin, user, "ankuendigung_aktualisiert", "plattform", null, { aktiv: !!ankuendigung_aktiv, typ });
    return NextResponse.json({ ok: true, einstellungen: data });
  } catch (e: any) {
    console.error("[Admin/Announcement PUT] Fehler:", e);
    return NextResponse.json({ error: e.message || "Speichern fehlgeschlagen" }, { status: 500 });
  }
}
