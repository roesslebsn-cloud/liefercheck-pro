import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!serviceKey) {
      return NextResponse.json({ error: "Server nicht konfiguriert" }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const token = authHeader.slice("Bearer ".length);

    // Verify current user
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

    const admin = createClient(url, serviceKey);

    // Get current user's org via service role (bypasses RLS completely)
    const { data: mySettings } = await admin
      .from("user_settings")
      .select("organisation_id")
      .eq("user_id", user.id)
      .single();

    if (!mySettings?.organisation_id) {
      return NextResponse.json([]);
    }

    // Get all members of this org
    const { data: members, error } = await admin
      .from("user_settings")
      .select("user_id, vorname, role, zuletzt_aktiv")
      .eq("organisation_id", mySettings.organisation_id);

    if (error) throw error;

    // Build superadmin user_id set by cross-referencing auth.users
    const superAdminEmails = new Set(
      (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "")
        .split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
    );

    const superAdminUserIds = new Set<string>();
    if (superAdminEmails.size > 0) {
      const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of authData?.users ?? []) {
        if (superAdminEmails.has(u.email?.toLowerCase() ?? "")) {
          superAdminUserIds.add(u.id);
        }
      }
    }

    const filtered = (members || []).filter(m => !superAdminUserIds.has(m.user_id));

    return NextResponse.json(filtered);
  } catch (error: any) {
    console.error("[Team/Members] Fehler:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
