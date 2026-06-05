import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/requests – offene Mitarbeiter-Anfragen über alle Orgs.
// Entscheidung läuft danach über die bestehende /api/anfrage/entscheiden-Route (Token).
export async function GET(request: NextRequest) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin } = ctx;

  try {
    const { data, error: qErr } = await admin
      .from("mitarbeiter_anfragen")
      .select("id, email, vorname, rolle, angefragt_von_email, organisation_id, erstellt_am, approval_token, organisationen(name)")
      .eq("status", "pending")
      .order("erstellt_am", { ascending: false });
    if (qErr) throw qErr;

    const result = (data || []).map((a: any) => ({
      id: a.id,
      email: a.email,
      vorname: a.vorname,
      rolle: a.rolle,
      angefragt_von_email: a.angefragt_von_email,
      organisation_id: a.organisation_id,
      organisation_name: a.organisationen?.name || null,
      erstellt_am: a.erstellt_am,
      approval_token: a.approval_token,
    }));

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[Admin/Requests] Fehler:", e);
    return NextResponse.json({ error: e.message || "Fehler beim Laden der Anfragen" }, { status: 500 });
  }
}
