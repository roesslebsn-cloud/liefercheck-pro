import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, adminAudit } from "../../../../../../lib/adminAuth";

export const dynamic = "force-dynamic";

// Ermittelt den Chef-User der Org (für standorte.user_id, das NOT NULL ist).
async function chefIdFor(admin: any, orgId: string): Promise<string | null> {
  const { data: org } = await admin.from("organisationen").select("chef_user_id").eq("id", orgId).single();
  if (org?.chef_user_id) return org.chef_user_id;
  const { data: chef } = await admin.from("user_settings").select("user_id").eq("organisation_id", orgId).eq("role", "chef").limit(1).single();
  return chef?.user_id || null;
}

// POST – neuen Standort im Namen des Kunden anlegen.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin, user } = ctx;
  const { id } = await params;

  try {
    const { name, adresse } = await request.json();
    if (!name || !name.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });

    const chefId = await chefIdFor(admin, id);
    if (!chefId) return NextResponse.json({ error: "Kein Chef-Konto – Standort kann nicht zugeordnet werden" }, { status: 400 });

    const { data, error: insErr } = await admin
      .from("standorte")
      .insert({ name: name.trim(), adresse: adresse || null, organisation_id: id, user_id: chefId, aktiv: true })
      .select()
      .single();
    if (insErr) throw insErr;

    await adminAudit(admin, user, "standort_angelegt", "standort", data.id, { organisation_id: id, name: data.name });
    return NextResponse.json({ ok: true, standort: data });
  } catch (e: any) {
    console.error("[Admin/Standorte POST] Fehler:", e);
    return NextResponse.json({ error: e.message || "Anlegen fehlgeschlagen" }, { status: 500 });
  }
}

// PATCH – Standort bearbeiten (name/adresse/aktiv).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin, user } = ctx;
  const { id } = await params;

  try {
    const { standort_id, name, adresse, aktiv } = await request.json();
    if (!standort_id) return NextResponse.json({ error: "standort_id erforderlich" }, { status: 400 });
    const update: Record<string, any> = {};
    if (name !== undefined) update.name = name;
    if (adresse !== undefined) update.adresse = adresse || null;
    if (aktiv !== undefined) update.aktiv = !!aktiv;

    const { error: updErr } = await admin.from("standorte").update(update).eq("id", standort_id).eq("organisation_id", id);
    if (updErr) throw updErr;

    await adminAudit(admin, user, "standort_aktualisiert", "standort", standort_id, { organisation_id: id });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[Admin/Standorte PATCH] Fehler:", e);
    return NextResponse.json({ error: e.message || "Aktualisieren fehlgeschlagen" }, { status: 500 });
  }
}

// DELETE – Standort entfernen.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireSuperAdmin(request);
  if (error) return error;
  const { admin, user } = ctx;
  const { id } = await params;

  try {
    const { standort_id } = await request.json();
    if (!standort_id) return NextResponse.json({ error: "standort_id erforderlich" }, { status: 400 });

    const { error: delErr } = await admin.from("standorte").delete().eq("id", standort_id).eq("organisation_id", id);
    if (delErr) throw delErr;

    await adminAudit(admin, user, "standort_geloescht", "standort", standort_id, { organisation_id: id });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[Admin/Standorte DELETE] Fehler:", e);
    return NextResponse.json({ error: e.message || "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
