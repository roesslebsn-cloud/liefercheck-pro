import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, role, vorname } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!serviceKey) {
      return NextResponse.json(
        { error: "Server nicht konfiguriert. SUPABASE_SERVICE_ROLE_KEY fehlt." },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const userToken = authHeader.slice("Bearer ".length);

    // Wer lädt ein? -> dessen Organisation lesen
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { data: inviterSettings } = await userClient
      .from("user_settings")
      .select("organisation_id, role")
      .eq("user_id", user.id)
      .single();

    if (!inviterSettings?.organisation_id) {
      return NextResponse.json({ error: "Keine Organisation gefunden" }, { status: 400 });
    }
    if (inviterSettings.role !== "chef") {
      return NextResponse.json({ error: "Nur Chefs duerfen einladen" }, { status: 403 });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";

    // Supabase Invite verschicken (Magic Link Email)
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        invited_role: role || "mitarbeiter",
        vorname: vorname || null,
        organisation_id: inviterSettings.organisation_id,
      },
      redirectTo: `${origin}/setup`,
    });

    if (error) throw error;

    const newUserId = data.user?.id;
    if (newUserId) {
      await adminClient.from("user_settings").upsert({
        user_id: newUserId,
        role: role || "mitarbeiter",
        vorname: vorname || null,
        organisation_id: inviterSettings.organisation_id,
        wochen_bericht_aktiv: false,
      });
    }

    // Einladungs-Eintrag fuer Audit (auch falls user bereits existiert)
    await adminClient.from("team_einladungen").insert({
      organisation_id: inviterSettings.organisation_id,
      eingeladen_von: user.id,
      email,
      vorname: vorname || null,
      rolle: role || "mitarbeiter",
      angenommen_am: newUserId ? new Date().toISOString() : null,
    });

    return NextResponse.json({ success: true, userId: newUserId });
  } catch (err: any) {
    console.error("Invite error:", err);
    return NextResponse.json(
      { error: err.message || "Fehler beim Senden der Einladung" },
      { status: 500 }
    );
  }
}
