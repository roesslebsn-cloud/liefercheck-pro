import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, role } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Server nicht konfiguriert. Bitte SUPABASE_SERVICE_ROLE_KEY in .env.local setzen." },
      { status: 500 }
    );
  }

  try {
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { invited_role: role || "mitarbeiter" },
      redirectTo: `${origin}/dashboard`,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, userId: data.user?.id });
  } catch (err: any) {
    console.error("Invite error:", err);
    return NextResponse.json(
      { error: err.message || "Fehler beim Senden der Einladung" },
      { status: 500 }
    );
  }
}
