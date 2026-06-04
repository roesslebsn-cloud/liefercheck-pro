import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function isAuthorized(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "";
  const list = raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "Server nicht konfiguriert (Service Role Key fehlt)" }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const token = authHeader.slice("Bearer ".length);

    const userClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!isAuthorized(user?.email)) {
      return NextResponse.json({ error: "Nur Super-Admins" }, { status: 403 });
    }

    const { email, vorname, restaurant } = await request.json();
    if (!email || !restaurant) {
      return NextResponse.json({ error: "E-Mail und Restaurantname erforderlich" }, { status: 400 });
    }

    const admin = createClient(url, serviceKey);

    // 1. Organisation anlegen
    const { data: org, error: orgError } = await admin
      .from("organisationen")
      .insert({ name: restaurant })
      .select()
      .single();
    if (orgError) throw orgError;

    // 2. Magic-Link / Invite an Chef schicken
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { vorname, organisation_id: org.id, role: "chef" },
    });
    if (inviteError) throw inviteError;

    const newUserId = inviteData.user?.id;
    if (newUserId) {
      // 3. user_settings anlegen mit Org-Verknüpfung
      await admin.from("user_settings").upsert({
        user_id: newUserId,
        role: "chef",
        vorname: vorname || null,
        organisation_id: org.id,
        wochen_bericht_aktiv: true,
      });
      // 4. chef_user_id in Organisation setzen
      await admin.from("organisationen").update({ chef_user_id: newUserId }).eq("id", org.id);
    }

    return NextResponse.json({ ok: true, organisation: org, user_id: newUserId });
  } catch (error: any) {
    console.error("[Admin/CreateChef] Fehler:", error);
    return NextResponse.json({ error: error.message || "Anlegen fehlgeschlagen" }, { status: 500 });
  }
}
