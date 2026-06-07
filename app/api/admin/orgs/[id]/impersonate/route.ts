import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, adminAudit } from "../../../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

// POST /api/admin/orgs/[id]/impersonate – erzeugt einen Magic-Link, mit dem sich
// der Admin als Chef des Kunden anmelden kann (Support). Caveat: der Link ersetzt
// im Zieltab die aktuelle Sitzung.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin, user } = ctx;
  const { id } = await params;

  try {
    const { data: org } = await admin.from("organisationen").select("chef_user_id, kontakt_email").eq("id", id).single();
    let chefId = org?.chef_user_id || null;
    if (!chefId) {
      const { data: chef } = await admin.from("user_settings").select("user_id").eq("organisation_id", id).eq("role", "chef").limit(1).single();
      chefId = chef?.user_id || null;
    }
    if (!chefId) return NextResponse.json({ error: "Kein Chef-Konto für diesen Kunden gefunden" }, { status: 404 });

    // E-Mail des Chefs auflösen
    const { data: chefUser, error: getErr } = await admin.auth.admin.getUserById(chefId);
    if (getErr) throw getErr;
    const email = chefUser?.user?.email;
    if (!email) return NextResponse.json({ error: "Chef-Konto hat keine E-Mail" }, { status: 400 });

    // Auf Vercel enthält new URL(request.url).origin manchmal eine interne URL.
    // x-forwarded-host ist zuverlässiger und enthält immer den echten Hostnamen.
    const fwdHost = request.headers.get("x-forwarded-host");
    const fwdProto = request.headers.get("x-forwarded-proto") || "https";
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (fwdHost ? `${fwdProto}://${fwdHost}` : new URL(request.url).origin);
    const { data, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/dashboard` },
    });
    if (linkErr) throw linkErr;

    const action_link = data?.properties?.action_link;
    if (!action_link) return NextResponse.json({ error: "Konnte keinen Login-Link erzeugen" }, { status: 500 });

    await adminAudit(admin, user, "impersonation", "user", chefId, { organisation_id: id, email });

    return NextResponse.json({ action_link });
  } catch (e: any) {
    console.error("[Admin/Impersonate] Fehler:", e);
    return NextResponse.json({ error: e.message || "Login-Link konnte nicht erzeugt werden" }, { status: 500 });
  }
}
