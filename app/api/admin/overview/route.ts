import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

// Kumulierte Zeitreihe nach Monat (für TrendChart). Gibt [] bei zu wenig Daten.
function buildCumulativeByMonth(dates: (string | null | undefined)[]): { label: string; value: number }[] {
  const valid = dates.filter(Boolean).map((d) => new Date(d as string)).filter((d) => !isNaN(d.getTime()));
  if (valid.length === 0) return [];
  const byMonth = new Map<string, number>();
  for (const d of valid) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) || 0) + 1);
  }
  const keys = Array.from(byMonth.keys()).sort();
  let cum = 0;
  return keys.map((k) => {
    cum += byMonth.get(k)!;
    const [y, m] = k.split("-");
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
    return { label, value: cum };
  });
}

export async function GET(request: NextRequest) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin } = ctx;

  try {
    const now = Date.now();

    const [orgsRes, settingsRes, liefRes, anfragenRes, auditRes, authRes] = await Promise.all([
      admin.from("organisationen").select("id, name, status, erstellt_am, chef_user_id").order("erstellt_am", { ascending: true }),
      admin.from("user_settings").select("user_id, organisation_id, role, zuletzt_aktiv"),
      admin.from("lieferungen").select("id, organisation_id, erstellt_am, ersparnis_eur"),
      admin.from("mitarbeiter_anfragen").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("audit_log").select("id, erstellt_am, user_email, aktion, entity_type, entity_id, details").order("erstellt_am", { ascending: false }).limit(15),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const orgs = orgsRes.data || [];
    const settings = settingsRes.data || [];
    const lieferungen = liefRes.data || [];
    const offeneAnfragen = anfragenRes.count || 0;
    const feed = auditRes.data || [];

    // Super-Admins aus der Nutzerzählung ausschließen
    const superEmails = new Set(
      (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    );
    const superIds = new Set<string>();
    for (const u of authRes.data?.users ?? []) {
      if (superEmails.has((u.email || "").toLowerCase())) superIds.add(u.id);
    }
    const realMembers = settings.filter((s) => !superIds.has(s.user_id));

    // Letzte Aktivität je Org
    const lastActiveByOrg = new Map<string, number>();
    for (const s of realMembers) {
      if (!s.organisation_id || !s.zuletzt_aktiv) continue;
      const t = new Date(s.zuletzt_aktiv).getTime();
      if (t > (lastActiveByOrg.get(s.organisation_id) || 0)) lastActiveByOrg.set(s.organisation_id, t);
    }
    const kundenAktiv30 = orgs.filter((o) => (lastActiveByOrg.get(o.id) || 0) >= now - 30 * DAY).length;

    const lieferungenWoche = lieferungen.filter((l) => l.erstellt_am && new Date(l.erstellt_am).getTime() >= now - 7 * DAY).length;
    const gesamtErsparnis = lieferungen.reduce((s, l) => s + (Number(l.ersparnis_eur) || 0), 0);

    const kpis = {
      kundenGesamt: orgs.length,
      kundenAktiv30,
      nutzerGesamt: realMembers.length,
      lieferungenGesamt: lieferungen.length,
      lieferungenWoche,
      gesamtErsparnis,
      offeneAnfragen,
    };

    const kundenVerlauf = buildCumulativeByMonth(orgs.map((o) => o.erstellt_am));
    const lieferungenVerlauf = buildCumulativeByMonth(lieferungen.map((l) => l.erstellt_am));

    // "Aufmerksamkeit nötig"
    const liefCountByOrg = new Map<string, number>();
    for (const l of lieferungen) {
      if (l.organisation_id) liefCountByOrg.set(l.organisation_id, (liefCountByOrg.get(l.organisation_id) || 0) + 1);
    }
    const achtung: { orgId: string; name: string; grund: string }[] = [];
    for (const o of orgs) {
      if (o.status === "gesperrt") { achtung.push({ orgId: o.id, name: o.name, grund: "gesperrt" }); continue; }
      const last = lastActiveByOrg.get(o.id) || 0;
      const liefCount = liefCountByOrg.get(o.id) || 0;
      if (liefCount === 0) achtung.push({ orgId: o.id, name: o.name, grund: "noch keine Lieferung" });
      else if (last && last < now - 14 * DAY) achtung.push({ orgId: o.id, name: o.name, grund: "seit 14+ Tagen inaktiv" });
    }

    return NextResponse.json({ kpis, kundenVerlauf, lieferungenVerlauf, feed, achtung });
  } catch (e: any) {
    console.error("[Admin/Overview] Fehler:", e);
    return NextResponse.json({ error: e.message || "Fehler beim Laden der Übersicht" }, { status: 500 });
  }
}
