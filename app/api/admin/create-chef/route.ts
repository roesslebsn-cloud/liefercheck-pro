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

    const { email, vorname, restaurant, password } = await request.json();
    if (!email || !restaurant || !password) {
      return NextResponse.json({ error: "E-Mail, Restaurantname und Passwort erforderlich" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen lang sein" }, { status: 400 });
    }

    const admin = createClient(url, serviceKey);

    const { data: org, error: orgError } = await admin
      .from("organisationen")
      .insert({ name: restaurant })
      .select()
      .single();
    if (orgError) throw orgError;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { vorname, organisation_id: org.id, role: "chef" },
    });
    if (createError) throw createError;

    const newUserId = created.user?.id;
    if (newUserId) {
      await admin.from("user_settings").upsert({
        user_id: newUserId,
        role: "chef",
        vorname: vorname || null,
        organisation_id: org.id,
        wochen_bericht_aktiv: true,
        passwort_temporaer: true,
      });
      await admin.from("organisationen").update({ chef_user_id: newUserId }).eq("id", org.id);

      await admin.from("audit_log").insert({
        user_id: user!.id,
        user_email: user!.email,
        aktion: "chef_angelegt",
        entity_type: "user",
        entity_id: newUserId,
        details: { email, vorname, restaurant, organisation_id: org.id },
      });
    }

    return NextResponse.json({ ok: true, organisation: org, user_id: newUserId });
  } catch (error: any) {
    console.error("[Admin/CreateChef] Fehler:", error);
    return NextResponse.json({ error: error.message || "Anlegen fehlgeschlagen" }, { status: 500 });
  }
}
