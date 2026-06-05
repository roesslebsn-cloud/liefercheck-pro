import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/team/audit?userId=<uuid>
// Liefert das Audit-Protokoll (GoBD) eines Mitarbeiters.
// Nur Chefs der gleichen Organisation duerfen lesen. Service-Role + Org-Check
// garantieren strikte Mandantentrennung (kein Cross-Org-Leak ueber RLS).
// Ohne userId-Param: Aktivitaet aller Org-Mitglieder (Team-Feed).
// ─────────────────────────────────────────────────────────────────────────────
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

    // Aktuellen User verifizieren
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

    const admin = createClient(url, serviceKey);

    // Org + Rolle des Anfragers via Service-Role (umgeht RLS)
    const { data: mySettings } = await admin
      .from("user_settings")
      .select("organisation_id, role")
      .eq("user_id", user.id)
      .single();

    if (mySettings?.role !== "chef") {
      return NextResponse.json({ error: "Nur Chefs duerfen das Protokoll einsehen" }, { status: 403 });
    }
    if (!mySettings?.organisation_id) {
      return NextResponse.json([]);
    }

    // Alle user_ids dieser Organisation ermitteln (Org-Grenze)
    const { data: members } = await admin
      .from("user_settings")
      .select("user_id")
      .eq("organisation_id", mySettings.organisation_id);
    const orgUserIds = new Set((members || []).map((m) => m.user_id));

    const targetUserId = request.nextUrl.searchParams.get("userId");
    if (targetUserId && !orgUserIds.has(targetUserId)) {
      return NextResponse.json({ error: "Mitarbeiter nicht in dieser Organisation" }, { status: 403 });
    }

    const userIds = targetUserId ? [targetUserId] : Array.from(orgUserIds);
    if (userIds.length === 0) return NextResponse.json([]);

    const { data: eintraege, error } = await admin
      .from("audit_log")
      .select("id, erstellt_am, user_id, user_email, aktion, entity_type, entity_id, details")
      .in("user_id", userIds)
      .order("erstellt_am", { ascending: false })
      .limit(200);

    if (error) throw error;

    return NextResponse.json(eintraege || []);
  } catch (error: any) {
    console.error("[Team/Audit] Fehler:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
