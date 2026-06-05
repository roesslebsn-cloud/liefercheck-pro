import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { isSuperAdminEmail } from "./admin";

// ─────────────────────────────────────────────────────────────────────────────
// Geteilter Auth-Boilerplate für alle /api/admin/* Routen.
// Verifiziert den Bearer-Token, prüft Super-Admin-Status und liefert einen
// Service-Role-Client (umgeht RLS – nötig, da der Host keiner Org angehört).
// Vorlage: app/api/admin/create-chef/route.ts, app/api/org/ensure/route.ts
// ─────────────────────────────────────────────────────────────────────────────

export type SuperAdminContext = {
  user: User;
  admin: SupabaseClient; // Service-Role-Client – umgeht RLS komplett
};

type RequireResult =
  | { ctx: SuperAdminContext; error?: undefined }
  | { ctx?: undefined; error: NextResponse };

/**
 * Gibt entweder den Super-Admin-Kontext zurück oder eine fertige Fehler-Response,
 * die die Route direkt zurückgeben kann:
 *
 *   const { ctx, error } = await requireSuperAdmin(request);
 *   if (error) return error;
 *   const { user, admin } = ctx;
 */
export async function requireSuperAdmin(request: NextRequest): Promise<RequireResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!serviceKey) {
    return { error: NextResponse.json({ error: "Server nicht konfiguriert (Service Role Key fehlt)" }, { status: 503 }) };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 }) };
  }
  const token = authHeader.slice("Bearer ".length);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 }) };
  }
  if (!isSuperAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: "Nur Super-Admins" }, { status: 403 }) };
  }

  const admin = createClient(url, serviceKey);
  return { ctx: { user, admin } };
}

/**
 * Schreibt einen Eintrag ins audit_log. Fehler werden geschluckt (Logging darf
 * die eigentliche Aktion nie scheitern lassen). user_id/email = der handelnde Admin.
 */
export async function adminAudit(
  admin: SupabaseClient,
  actor: User,
  aktion: string,
  entity_type: string,
  entity_id: string | null,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await admin.from("audit_log").insert({
      user_id: actor.id,
      user_email: actor.email,
      aktion,
      entity_type,
      entity_id,
      details: details ?? {},
    });
  } catch (e) {
    console.error("[adminAudit] Konnte audit_log nicht schreiben:", e);
  }
}
