import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/standorte – zentrale Liste aller Standorte über alle Kunden.
export async function GET(request: NextRequest) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin } = ctx;

  try {
    const { data, error: qErr } = await admin
      .from("standorte")
      .select("id, name, adresse, aktiv, erstellt_am, organisation_id, organisationen(name)")
      .order("erstellt_am", { ascending: false });
    if (qErr) throw qErr;

    const result = (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      adresse: s.adresse,
      aktiv: s.aktiv,
      erstellt_am: s.erstellt_am,
      organisation_id: s.organisation_id,
      organisation_name: s.organisationen?.name || "—",
    }));

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[Admin/Standorte central] Fehler:", e);
    return NextResponse.json({ error: e.message || "Fehler beim Laden der Standorte" }, { status: 500 });
  }
}
