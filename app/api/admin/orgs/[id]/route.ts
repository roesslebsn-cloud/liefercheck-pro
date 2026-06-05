import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, adminAudit } from "../../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

// GET /api/admin/orgs/[id] – Detailbündel zu einem Kunden (Org).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin } = ctx;
  const { id } = await params;

  try {
    const { data: org, error: orgErr } = await admin
      .from("organisationen")
      .select("id, name, status, features, kontakt_email, notiz, erstellt_am, chef_user_id")
      .eq("id", id)
      .single();
    if (orgErr || !org) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

    const [membersRes, standorteRes, lieferantenRes, liefRes, liefCountRes, authRes] = await Promise.all([
      admin.from("user_settings").select("user_id, vorname, role, zuletzt_aktiv, passwort_temporaer").eq("organisation_id", id),
      admin.from("standorte").select("id, name, adresse, aktiv, erstellt_am").eq("organisation_id", id).order("erstellt_am", { ascending: true }),
      admin.from("lieferanten").select("id, name, aktiv").eq("organisation_id", id),
      admin.from("lieferungen").select("id, erstellt_am, ersparnis_eur, status, freigabe_erteilt, rechnung_data").eq("organisation_id", id).order("erstellt_am", { ascending: false }).limit(10),
      admin.from("lieferungen").select("id, ersparnis_eur", { count: "exact" }).eq("organisation_id", id),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const emailById = new Map<string, string>();
    for (const u of authRes.data?.users ?? []) emailById.set(u.id, u.email || "");

    const members = (membersRes.data || []).map((m) => ({ ...m, email: emailById.get(m.user_id) || null }));
    const standorte = standorteRes.data || [];
    const lieferanten = lieferantenRes.data || [];
    const lieferungen = (liefRes.data || []).map((l) => ({
      id: l.id,
      erstellt_am: l.erstellt_am,
      ersparnis_eur: l.ersparnis_eur,
      status: l.status,
      freigabe_erteilt: l.freigabe_erteilt,
      lieferant: (l.rechnung_data as any)?.lieferant || null,
    }));

    // Audit: Aktionen der Org-Mitglieder + Aktionen auf die Org selbst
    const memberIds = members.map((m) => m.user_id);
    const orFilter = [`entity_id.eq.${id}`, ...(memberIds.length ? [`user_id.in.(${memberIds.join(",")})`] : [])].join(",");
    const { data: audit } = await admin
      .from("audit_log")
      .select("id, erstellt_am, user_email, aktion, entity_type, details")
      .or(orFilter)
      .order("erstellt_am", { ascending: false })
      .limit(20);

    const chefId = org.chef_user_id || members.find((m) => m.role === "chef")?.user_id || null;
    const letzteAktivitaet = members.reduce<string | null>((acc, m) => {
      if (!m.zuletzt_aktiv) return acc;
      return !acc || new Date(m.zuletzt_aktiv) > new Date(acc) ? m.zuletzt_aktiv : acc;
    }, null);
    const ersparnisGesamt = (liefCountRes.data || []).reduce((s, l) => s + (Number(l.ersparnis_eur) || 0), 0);
    const lieferungGesamt = liefCountRes.count ?? (liefCountRes.data || []).length;

    return NextResponse.json({
      org: {
        id: org.id,
        name: org.name,
        status: org.status || "aktiv",
        features: org.features || {},
        kontakt_email: org.kontakt_email || null,
        notiz: org.notiz || null,
        erstellt_am: org.erstellt_am,
        chef_user_id: chefId,
      },
      chef: chefId ? { user_id: chefId, email: emailById.get(chefId) || org.kontakt_email || null, vorname: members.find((m) => m.user_id === chefId)?.vorname || null } : null,
      members,
      standorte,
      lieferanten,
      lieferungen,
      audit: audit || [],
      stats: {
        lieferungAnzahl: lieferungGesamt,
        ersparnis: ersparnisGesamt,
        standortAnzahl: standorte.length,
        mitarbeiterAnzahl: members.length,
      },
      onboarding: {
        kontoEingerichtet: !!letzteAktivitaet,
        standortAngelegt: standorte.length > 0,
        ersteLieferung: lieferungGesamt > 0,
      },
    });
  } catch (e: any) {
    console.error("[Admin/OrgDetail] Fehler:", e);
    return NextResponse.json({ error: e.message || "Fehler beim Laden des Kunden" }, { status: 500 });
  }
}

// PATCH /api/admin/orgs/[id] – Name/Status/Features/Kontakt/Notiz aktualisieren.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin, user } = ctx;
  const { id } = await params;

  try {
    const body = await request.json();
    const update: Record<string, any> = {};
    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
    if (body.kontakt_email !== undefined) update.kontakt_email = body.kontakt_email || null;
    if (body.notiz !== undefined) update.notiz = body.notiz || null;
    if (body.features !== undefined && typeof body.features === "object") update.features = body.features;
    let statusChanged: "gesperrt" | "aktiv" | null = null;
    if (body.status !== undefined) {
      if (body.status !== "aktiv" && body.status !== "gesperrt") {
        return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
      }
      update.status = body.status;
      statusChanged = body.status;
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nichts zu aktualisieren" }, { status: 400 });

    const { data, error: updErr } = await admin.from("organisationen").update(update).eq("id", id).select().single();
    if (updErr) throw updErr;

    const aktion = statusChanged === "gesperrt" ? "org_gesperrt" : statusChanged === "aktiv" ? "org_entsperrt" : "org_aktualisiert";
    await adminAudit(admin, user, aktion, "organisation", id, { felder: Object.keys(update) });

    return NextResponse.json({ ok: true, org: data });
  } catch (e: any) {
    console.error("[Admin/OrgPatch] Fehler:", e);
    return NextResponse.json({ error: e.message || "Aktualisieren fehlgeschlagen" }, { status: 500 });
  }
}

// DELETE /api/admin/orgs/[id] – Kunde samt aller Daten unwiderruflich löschen.
// Explizites Löschen statt Verlass auf FK-Cascades (org-FKs sind teils SET NULL).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin, user } = ctx;
  const { id } = await params;

  try {
    const { data: org } = await admin.from("organisationen").select("id, name").eq("id", id).single();
    if (!org) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

    const { data: members } = await admin.from("user_settings").select("user_id").eq("organisation_id", id);
    const memberIds = (members || []).map((m) => m.user_id).filter(Boolean);

    // 1) Org-skopierte + mitglieds-eigene Daten löschen (preis_historie cascadet via lieferanten)
    await admin.from("lieferungen").delete().eq("organisation_id", id);
    await admin.from("lieferanten").delete().eq("organisation_id", id);
    await admin.from("standorte").delete().eq("organisation_id", id);
    if (memberIds.length) {
      await admin.from("lieferungen").delete().in("user_id", memberIds);
      await admin.from("lieferanten").delete().in("user_id", memberIds);
      await admin.from("standorte").delete().in("user_id", memberIds);
    }

    // 2) Settings + Auth-Nutzer entfernen
    await admin.from("user_settings").delete().eq("organisation_id", id);
    for (const uid of memberIds) {
      try { await admin.auth.admin.deleteUser(uid); } catch (e) { console.error("[Admin/OrgDelete] deleteUser fehlgeschlagen:", uid, e); }
    }

    // 3) Org löschen (team_einladungen + mitarbeiter_anfragen cascaden via organisation_id)
    const { error: delErr } = await admin.from("organisationen").delete().eq("id", id);
    if (delErr) throw delErr;

    // Audit bewusst NACH dem Löschen – entity_id dangelt, bleibt aber als Nachweis erhalten (GoBD)
    await adminAudit(admin, user, "org_geloescht", "organisation", id, { name: org.name, anzahl_nutzer: memberIds.length });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[Admin/OrgDelete] Fehler:", e);
    return NextResponse.json({ error: e.message || "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
