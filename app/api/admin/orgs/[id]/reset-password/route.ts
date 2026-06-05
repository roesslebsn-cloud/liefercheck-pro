import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, adminAudit } from "../../../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

// POST /api/admin/orgs/[id]/reset-password – setzt ein neues temporäres Passwort
// für das Chef-Konto der Organisation und markiert es als "temporär".
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin, user } = ctx;
  const { id } = await params;

  try {
    const { password } = await request.json();
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen lang sein" }, { status: 400 });
    }

    // Chef ermitteln: org.chef_user_id, sonst Chef-Mitglied
    const { data: org } = await admin.from("organisationen").select("chef_user_id").eq("id", id).single();
    let chefId = org?.chef_user_id || null;
    if (!chefId) {
      const { data: chef } = await admin.from("user_settings").select("user_id").eq("organisation_id", id).eq("role", "chef").limit(1).single();
      chefId = chef?.user_id || null;
    }
    if (!chefId) return NextResponse.json({ error: "Kein Chef-Konto für diesen Kunden gefunden" }, { status: 404 });

    const { error: updErr } = await admin.auth.admin.updateUserById(chefId, { password });
    if (updErr) throw updErr;

    await admin.from("user_settings").update({ passwort_temporaer: true }).eq("user_id", chefId);
    await adminAudit(admin, user, "passwort_zurueckgesetzt", "user", chefId, { organisation_id: id });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[Admin/ResetPassword] Fehler:", e);
    return NextResponse.json({ error: e.message || "Zurücksetzen fehlgeschlagen" }, { status: 500 });
  }
}
