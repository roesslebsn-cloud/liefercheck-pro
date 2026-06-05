import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Loescht eine Lieferung serverseitig (Service-Role, umgeht RLS).
// Nur Chefs duerfen loeschen – und nur Lieferungen der eigenen Organisation
// bzw. eigene (organisation_id NULL).
export async function POST(request: NextRequest) {
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

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Keine Lieferungs-ID" }, { status: 400 });

    // Aktuellen Nutzer verifizieren
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

    const admin = createClient(url, serviceKey);

    // Rolle + Org des Nutzers laden (Service-Role, umgeht RLS)
    const { data: me } = await admin
      .from("user_settings")
      .select("role, organisation_id")
      .eq("user_id", user.id)
      .single();

    if (me?.role !== "chef") {
      return NextResponse.json({ error: "Nur Chefs duerfen Lieferungen loeschen" }, { status: 403 });
    }

    // Lieferung laden und Zugehoerigkeit pruefen
    const { data: lief } = await admin
      .from("lieferungen")
      .select("id, user_id, organisation_id")
      .eq("id", id)
      .single();

    if (!lief) return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });

    const sameOrg = me.organisation_id && lief.organisation_id === me.organisation_id;
    const ownNullOrg = !lief.organisation_id && lief.user_id === user.id;
    if (!sameOrg && !ownNullOrg) {
      return NextResponse.json({ error: "Keine Berechtigung fuer diese Lieferung" }, { status: 403 });
    }

    const { error: delError } = await admin.from("lieferungen").delete().eq("id", id);
    if (delError) throw delError;

    // Audit-Eintrag (best effort)
    await admin.from("audit_log").insert({
      user_id: user.id,
      user_email: user.email,
      aktion: "lieferung_geloescht",
      entity_type: "lieferung",
      entity_id: id,
      details: { organisation_id: lief.organisation_id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Lieferung/Delete] Fehler:", error);
    return NextResponse.json({ error: error.message || "Loeschen fehlgeschlagen" }, { status: 500 });
  }
}
