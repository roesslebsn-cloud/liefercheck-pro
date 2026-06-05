import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/orgs – alle Organisationen mit Aggregaten für die Kunden-Tabelle.
export async function GET(request: NextRequest) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin } = ctx;

  try {
    const [orgsRes, settingsRes, standorteRes, liefRes, authRes] = await Promise.all([
      admin.from("organisationen").select("id, name, status, erstellt_am, chef_user_id, kontakt_email").order("erstellt_am", { ascending: false }),
      admin.from("user_settings").select("user_id, organisation_id, vorname, role, zuletzt_aktiv"),
      admin.from("standorte").select("id, organisation_id"),
      admin.from("lieferungen").select("id, organisation_id, ersparnis_eur"),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const orgs = orgsRes.data || [];
    const settings = settingsRes.data || [];
    const standorte = standorteRes.data || [];
    const lieferungen = liefRes.data || [];

    const emailById = new Map<string, string>();
    for (const u of authRes.data?.users ?? []) emailById.set(u.id, u.email || "");

    const superEmails = new Set(
      (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    );

    // Aggregationen je Org vorbereiten
    const membersByOrg = new Map<string, typeof settings>();
    for (const s of settings) {
      if (!s.organisation_id) continue;
      if (superEmails.has((emailById.get(s.user_id) || "").toLowerCase())) continue; // Host nicht mitzählen
      const arr = membersByOrg.get(s.organisation_id) || [];
      arr.push(s);
      membersByOrg.set(s.organisation_id, arr);
    }
    const standortByOrg = new Map<string, number>();
    for (const s of standorte) if (s.organisation_id) standortByOrg.set(s.organisation_id, (standortByOrg.get(s.organisation_id) || 0) + 1);

    const liefByOrg = new Map<string, { count: number; ersparnis: number }>();
    for (const l of lieferungen) {
      if (!l.organisation_id) continue;
      const cur = liefByOrg.get(l.organisation_id) || { count: 0, ersparnis: 0 };
      cur.count += 1;
      cur.ersparnis += Number(l.ersparnis_eur) || 0;
      liefByOrg.set(l.organisation_id, cur);
    }

    const result = orgs.map((o) => {
      const members = membersByOrg.get(o.id) || [];
      const chefSetting = members.find((m) => m.role === "chef") || (o.chef_user_id ? members.find((m) => m.user_id === o.chef_user_id) : undefined);
      const lief = liefByOrg.get(o.id) || { count: 0, ersparnis: 0 };
      const letzteAktivitaet = members.reduce<string | null>((acc, m) => {
        if (!m.zuletzt_aktiv) return acc;
        return !acc || new Date(m.zuletzt_aktiv) > new Date(acc) ? m.zuletzt_aktiv : acc;
      }, null);
      const standortAnzahl = standortByOrg.get(o.id) || 0;

      return {
        id: o.id,
        name: o.name,
        status: o.status || "aktiv",
        erstellt_am: o.erstellt_am,
        chef: {
          user_id: o.chef_user_id || chefSetting?.user_id || null,
          vorname: chefSetting?.vorname || null,
          email: o.chef_user_id ? emailById.get(o.chef_user_id) || o.kontakt_email || null : chefSetting ? emailById.get(chefSetting.user_id) || null : o.kontakt_email || null,
        },
        mitarbeiterAnzahl: members.length,
        standortAnzahl,
        lieferungAnzahl: lief.count,
        ersparnis: lief.ersparnis,
        letzteAktivitaet,
        onboarding: {
          kontoEingerichtet: !!letzteAktivitaet,
          standortAngelegt: standortAnzahl > 0,
          ersteLieferung: lief.count > 0,
        },
      };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[Admin/Orgs] Fehler:", e);
    return NextResponse.json({ error: e.message || "Fehler beim Laden der Kunden" }, { status: 500 });
  }
}
