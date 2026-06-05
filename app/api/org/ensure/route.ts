import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}

// Stellt sicher, dass ein Chef einer Organisation angehoert.
// Hat ein Chef keine Org (Alt-Account / Direkt-Signup), wird automatisch eine
// angelegt und verknuepft – so kann "Team (0)" nicht mehr entstehen.
// Super-Admins (Host) werden bewusst KEINER Org zugeordnet.
export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!serviceKey) return NextResponse.json({ error: "Server nicht konfiguriert" }, { status: 503 });

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const token = authHeader.slice("Bearer ".length);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

    // Host nie einer Org zuordnen
    if (isSuperAdmin(user.email)) return NextResponse.json({ ok: true, skipped: "superadmin" });

    const admin = createClient(url, serviceKey);
    const { data: me } = await admin
      .from("user_settings")
      .select("role, organisation_id, vorname")
      .eq("user_id", user.id)
      .single();

    // Nur Chefs ohne Org behandeln
    if (!me || me.role !== "chef" || me.organisation_id) {
      return NextResponse.json({ ok: true, organisation_id: me?.organisation_id ?? null });
    }

    const name = me.vorname ? `${me.vorname}s Betrieb` : "Mein Betrieb";
    const { data: org, error: orgError } = await admin
      .from("organisationen")
      .insert({ name, chef_user_id: user.id })
      .select()
      .single();
    if (orgError) throw orgError;

    await admin.from("user_settings").update({ organisation_id: org.id }).eq("user_id", user.id);

    // Bestehende org-lose Lieferungen des Chefs der neuen Org zuordnen
    await admin
      .from("lieferungen")
      .update({ organisation_id: org.id })
      .eq("user_id", user.id)
      .is("organisation_id", null);

    return NextResponse.json({ ok: true, organisation_id: org.id, created: true });
  } catch (error: any) {
    console.error("[Org/Ensure] Fehler:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
