import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const userToken = authHeader.slice("Bearer ".length);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

    const { neues_passwort } = await request.json();
    if (!neues_passwort || neues_passwort.length < 8) {
      return NextResponse.json({ error: "Passwort muss mind. 8 Zeichen lang sein" }, { status: 400 });
    }

    const { error: pwError } = await userClient.auth.updateUser({ password: neues_passwort });
    if (pwError) throw pwError;

    // passwort_temporaer Flag entfernen
    if (serviceKey) {
      const admin = createClient(url, serviceKey);
      await admin
        .from("user_settings")
        .update({ passwort_temporaer: false })
        .eq("user_id", user.id);

      await admin.from("audit_log").insert({
        user_id: user.id,
        user_email: user.email,
        aktion: "passwort_geaendert",
        entity_type: "user",
        entity_id: user.id,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Passwort-Aendern] Fehler:", error);
    return NextResponse.json({ error: error.message || "Fehler" }, { status: 500 });
  }
}
