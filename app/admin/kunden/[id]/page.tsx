"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminFetch } from "../../../../lib/adminClient";

type Detail = {
  org: { id: string; name: string; status: "aktiv" | "gesperrt"; features: Record<string, boolean>; kontakt_email: string | null; notiz: string | null; erstellt_am: string; chef_user_id: string | null };
  chef: { user_id: string; email: string | null; vorname: string | null } | null;
  members: { user_id: string; vorname: string | null; role: string; zuletzt_aktiv: string | null; email: string | null; passwort_temporaer?: boolean }[];
  standorte: { id: string; name: string; adresse: string | null; aktiv: boolean; erstellt_am: string }[];
  lieferanten: { id: string; name: string; aktiv: boolean }[];
  lieferungen: { id: string; erstellt_am: string; ersparnis_eur: number | null; status: string | null; freigabe_erteilt: boolean; lieferant: string | null }[];
  audit: { id: string; erstellt_am: string; user_email: string | null; aktion: string; entity_type: string; details: any }[];
  stats: { lieferungAnzahl: number; ersparnis: number; standortAnzahl: number; mitarbeiterAnzahl: number };
  onboarding: { kontoEingerichtet: boolean; standortAngelegt: boolean; ersteLieferung: boolean };
};

const FEATURES: { key: string; label: string; hint: string }[] = [
  { key: "analytics", label: "Analyse-Seite", hint: "Statistiken & Auswertungen" },
  { key: "erechnung", label: "E-Rechnung (XML)", hint: "XRechnung/ZUGFeRD-Import" },
  { key: "standorte", label: "Mehrere Standorte", hint: "Filial-Verwaltung" },
  { key: "team", label: "Team-Verwaltung", hint: "Mitarbeiter einladen" },
];

function randomPw(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default function KundeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Modals
  const [modal, setModal] = useState<null | "edit" | "resetpw" | "impersonate" | "delete" | "standort">(null);

  const load = useCallback(async () => {
    try {
      setD(await adminFetch<Detail>(`/api/admin/orgs/${id}`));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const patch = async (body: Record<string, any>, okMsg: string) => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/orgs/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
      flash(okMsg);
    } catch (e: any) {
      flash("Fehler: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleSperre = () => {
    const neu = d!.org.status === "gesperrt" ? "aktiv" : "gesperrt";
    patch({ status: neu }, neu === "gesperrt" ? "Kunde gesperrt." : "Kunde entsperrt.");
  };

  const toggleFeature = (key: string, enabled: boolean) => {
    const features = { ...(d!.org.features || {}), [key]: enabled };
    patch({ features }, "Feature aktualisiert.");
  };

  if (loading) {
    return <div className="space-y-3"><div className="skeleton h-12 w-64 rounded" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div><div className="skeleton h-64 rounded-xl" /></div>;
  }
  if (err || !d) {
    return <div className="rounded-lg p-6 text-sm" style={{ background: "var(--red-muted)", color: "var(--red)" }}>{err || "Kunde nicht gefunden."} <button onClick={() => router.push("/admin/kunden")} className="ml-2 underline">Zurück</button></div>;
  }

  const ob = [
    { label: "Konto eingerichtet", done: d.onboarding.kontoEingerichtet },
    { label: "Standort angelegt", done: d.onboarding.standortAngelegt },
    { label: "Erste Lieferung", done: d.onboarding.ersteLieferung },
  ];

  const stats = [
    { label: "Lieferungen", value: String(d.stats.lieferungAnzahl) },
    { label: "Ersparnis", value: `€${d.stats.ersparnis.toFixed(2)}` },
    { label: "Standorte", value: String(d.stats.standortAnzahl) },
    { label: "Team", value: String(d.stats.mitarbeiterAnzahl) },
  ];

  return (
    <>
      {/* Kopf */}
      <button onClick={() => router.push("/admin/kunden")} className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-white transition-colors">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        Alle Kunden
      </button>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-white truncate">{d.org.name}</h1>
            <span className={`badge ${d.org.status === "gesperrt" ? "badge-red" : "badge-green"}`}>{d.org.status === "gesperrt" ? "Gesperrt" : "Aktiv"}</span>
          </div>
          <p className="mt-1.5 text-[13px] text-muted">
            {d.chef?.vorname ? `${d.chef.vorname} · ` : ""}{d.chef?.email || d.org.kontakt_email || "kein Chef-Konto"} · angelegt {fmt(d.org.erstellt_am)}
          </p>
          {d.org.notiz && <p className="mt-2 max-w-xl text-[12.5px] rounded-lg px-3 py-2" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>📝 {d.org.notiz}</p>}
        </div>
      </div>

      {/* Aktions-Toolbar */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button onClick={() => setModal("edit")} className="btn-secondary">Bearbeiten</button>
        <button onClick={() => setModal("resetpw")} className="btn-secondary">Passwort zurücksetzen</button>
        <button onClick={() => setModal("impersonate")} className="btn-secondary">Als Kunde einloggen</button>
        <button onClick={toggleSperre} disabled={busy} className="btn-secondary">{d.org.status === "gesperrt" ? "Entsperren" : "Sperren"}</button>
        <button onClick={() => setModal("delete")} className="rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors" style={{ background: "var(--red-muted)", color: "var(--red)" }}>Löschen</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-inset)" }}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{s.label}</p>
            <p className="mt-1.5 text-[22px] font-semibold tracking-tight tabular-nums text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Onboarding */}
      <div className="mb-6 rounded-xl p-4 sm:p-5" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted mb-3">Onboarding</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {ob.map((o) => (
            <div key={o.label} className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: o.done ? "var(--green-muted)" : "var(--surface)", color: o.done ? "var(--green)" : "var(--text-faint)" }}>
                {o.done ? <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={`text-[12.5px] ${o.done ? "text-white" : "text-muted"}`}>{o.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Team */}
        <Section title={`Team (${d.members.length})`}>
          {d.members.length === 0 ? <Empty>Keine Mitglieder.</Empty> : (
            <ul className="divide-y divide-border">
              {d.members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-white truncate">{m.vorname || m.email || m.user_id.slice(0, 8)}</p>
                    <p className="text-[11px] text-muted truncate">{m.email}</p>
                  </div>
                  <span className={`badge ${m.role === "chef" ? "badge-blue" : "badge-gray"}`}>{m.role}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Standorte */}
        <Section title={`Standorte (${d.standorte.length})`} action={<button onClick={() => setModal("standort")} className="text-[12px] text-accent hover:underline">+ Anlegen</button>}>
          {d.standorte.length === 0 ? <Empty>Noch keine Standorte.</Empty> : (
            <ul className="divide-y divide-border">
              {d.standorte.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-white truncate">{s.name}</p>
                    {s.adresse && <p className="text-[11px] text-muted truncate">{s.adresse}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {!s.aktiv && <span className="badge badge-gray">inaktiv</span>}
                    <button onClick={() => deleteStandort(s.id)} className="text-muted hover:text-red-400" aria-label="Standort löschen">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9M18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397M4.772 5.79a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916" /></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Lieferanten */}
        <Section title={`Lieferanten (${d.lieferanten.length})`}>
          {d.lieferanten.length === 0 ? <Empty>Keine Lieferanten.</Empty> : (
            <ul className="divide-y divide-border">
              {d.lieferanten.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-[12.5px] font-medium text-white truncate">{l.name}</span>
                  {!l.aktiv && <span className="badge badge-gray">inaktiv</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Letzte Lieferungen */}
        <Section title="Letzte Lieferungen">
          {d.lieferungen.length === 0 ? <Empty>Noch keine Lieferungen.</Empty> : (
            <ul className="divide-y divide-border">
              {d.lieferungen.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-white truncate">{l.lieferant || `#${l.id.slice(0, 8)}`}</p>
                    <p className="text-[11px] text-muted">{fmt(l.erstellt_am)}</p>
                  </div>
                  {l.ersparnis_eur ? <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--green)" }}>+€{Number(l.ersparnis_eur).toFixed(2)}</span> : <span className="text-[11px] text-muted">—</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Feature-Flags */}
      <div className="mt-6 rounded-xl p-4 sm:p-5" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted mb-3">Feature-Flags</p>
        <p className="text-[11.5px] text-muted mb-4">Standardmäßig sind alle Features aktiv. Hier kannst du sie für diesen Kunden gezielt abschalten.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FEATURES.map((f) => {
            const enabled = d.org.features?.[f.key] !== false;
            return (
              <label key={f.key} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 cursor-pointer" style={{ background: "var(--surface)" }}>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-white">{f.label}</p>
                  <p className="text-[11px] text-muted">{f.hint}</p>
                </div>
                <button type="button" onClick={() => toggleFeature(f.key, !enabled)} disabled={busy}
                  className="relative h-5 w-9 shrink-0 rounded-full transition-colors" style={{ background: enabled ? "var(--green)" : "var(--border-hover)" }}>
                  <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: enabled ? "18px" : "2px" }} />
                </button>
              </label>
            );
          })}
        </div>
      </div>

      {/* Audit */}
      <div className="mt-6">
        <Section title="Verlauf (Audit-Log)">
          {d.audit.length === 0 ? <Empty>Keine Ereignisse.</Empty> : (
            <ul className="divide-y divide-border">
              {d.audit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-white truncate">{a.aktion.replace(/_/g, " ")}</p>
                    <p className="text-[11px] text-muted truncate">{a.user_email || "System"} · {a.entity_type}</p>
                  </div>
                  <span className="shrink-0 text-[10.5px] text-muted tabular-nums">{new Date(a.erstellt_am).toLocaleDateString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2.5 text-[13px] font-medium text-white animate-slide-up" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-hover)", boxShadow: "var(--shadow-lg)" }}>
          {toast}
        </div>
      )}

      {/* Modals */}
      {modal === "edit" && <EditModal d={d} busy={busy} onClose={() => setModal(null)} onSave={(body) => { setModal(null); patch(body, "Gespeichert."); }} />}
      {modal === "resetpw" && <ResetPwModal id={id} chefEmail={d.chef?.email || d.org.kontakt_email || ""} onClose={() => setModal(null)} onDone={(msg) => { setModal(null); flash(msg); }} />}
      {modal === "impersonate" && <ImpersonateModal id={id} chefEmail={d.chef?.email || ""} onClose={() => setModal(null)} />}
      {modal === "delete" && <DeleteModal id={id} name={d.org.name} onClose={() => setModal(null)} onDeleted={() => router.push("/admin/kunden")} />}
      {modal === "standort" && <StandortModal id={id} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); flash("Standort angelegt."); }} />}
    </>
  );

  async function deleteStandort(sid: string) {
    if (!confirm("Diesen Standort wirklich löschen?")) return;
    try {
      await adminFetch(`/api/admin/orgs/${id}/standorte`, { method: "DELETE", body: JSON.stringify({ standort_id: sid }) });
      await load();
      flash("Standort gelöscht.");
    } catch (e: any) {
      flash("Fehler: " + e.message);
    }
  }
}

// ─── Bausteine ───────────────────────────────────────────────────────────────
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 sm:p-5" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-inset)" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-muted py-5 text-center">{children}</p>;
}
function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ background: "rgba(8,9,12,0.7)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6 animate-scale-in" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-hover)", boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-semibold text-white mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function EditModal({ d, busy, onClose, onSave }: { d: Detail; busy: boolean; onClose: () => void; onSave: (b: Record<string, any>) => void }) {
  const [name, setName] = useState(d.org.name);
  const [kontakt, setKontakt] = useState(d.org.kontakt_email || "");
  const [notiz, setNotiz] = useState(d.org.notiz || "");
  return (
    <ModalShell title="Kunde bearbeiten" onClose={onClose}>
      <div className="space-y-3">
        <div><label className="block text-[11px] font-medium text-muted mb-1.5">Betriebsname</label><input value={name} onChange={(e) => setName(e.target.value)} className="input" /></div>
        <div><label className="block text-[11px] font-medium text-muted mb-1.5">Kontakt-E-Mail</label><input type="email" value={kontakt} onChange={(e) => setKontakt(e.target.value)} placeholder="optional" className="input" /></div>
        <div><label className="block text-[11px] font-medium text-muted mb-1.5">Interne Notiz</label><textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={3} placeholder="nur für dich sichtbar" className="input resize-none" /></div>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={() => onSave({ name, kontakt_email: kontakt || null, notiz: notiz || null })} disabled={busy} className="btn-primary">Speichern</button>
        </div>
      </div>
    </ModalShell>
  );
}

function ResetPwModal({ id, chefEmail, onClose, onDone }: { id: string; chefEmail: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [pw, setPw] = useState(randomPw());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await adminFetch(`/api/admin/orgs/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password: pw }) });
      onDone(`Neues Passwort für ${chefEmail || "den Chef"}: ${pw}`);
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <ModalShell title="Passwort zurücksetzen" onClose={onClose}>
      <p className="text-[12.5px] text-muted mb-3">Setzt ein neues temporäres Passwort für das Chef-Konto {chefEmail ? <span className="text-white">{chefEmail}</span> : ""}.</p>
      <div className="flex items-center justify-between mb-1.5"><label className="text-[11px] font-medium text-muted">Neues Passwort</label><button onClick={() => setPw(randomPw())} className="text-[11px] text-accent hover:underline">Neu generieren</button></div>
      <input value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} className="input font-mono" />
      {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end pt-4"><button onClick={onClose} className="btn-secondary">Abbrechen</button><button onClick={submit} disabled={busy || pw.length < 8} className="btn-primary">{busy ? "…" : "Zurücksetzen"}</button></div>
    </ModalShell>
  );
}

function ImpersonateModal({ id, chefEmail, onClose }: { id: string; chefEmail: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    try {
      const { action_link } = await adminFetch<{ action_link: string }>(`/api/admin/orgs/${id}/impersonate`, { method: "POST" });
      window.open(action_link, "_blank", "noopener");
      onClose();
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <ModalShell title="Als Kunde einloggen" onClose={onClose}>
      <p className="text-[12.5px] text-muted">Öffnet eine echte Sitzung als {chefEmail ? <span className="text-white">{chefEmail}</span> : "der Chef"} in einem neuen Tab – für Support-Zwecke.</p>
      <div className="mt-3 rounded-lg p-3 text-[12px]" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
        ⚠️ Hinweis: Der Login-Link ersetzt im neuen Tab deine aktuelle Sitzung. Um wieder als Admin zu arbeiten, melde dich dort anschließend ab oder nutze ein separates Browser-Profil.
      </div>
      {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
      <p className="mt-2 text-[11px] text-muted">
        Tipp: Falls du auf eine Fehlerseite weitergeleitet wirst, stelle sicher, dass deine Vercel-Domain in den Supabase-Einstellungen unter Authentication → URL Configuration als erlaubte Redirect-URL eingetragen ist.
      </p>
      <div className="flex gap-2 justify-end pt-4"><button onClick={onClose} className="btn-secondary">Abbrechen</button><button onClick={go} disabled={busy} className="btn-primary">{busy ? "…" : "Login-Link öffnen"}</button></div>
    </ModalShell>
  );
}

function DeleteModal({ id, name, onClose, onDeleted }: { id: string; name: string; onClose: () => void; onDeleted: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await adminFetch(`/api/admin/orgs/${id}`, { method: "DELETE" });
      onDeleted();
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <ModalShell title="Kunde löschen" onClose={onClose}>
      <p className="text-[12.5px] text-muted">Das löscht <span className="text-white font-medium">{name}</span> samt aller Nutzer, Lieferungen, Standorte und Lieferanten – <span className="text-red-400">unwiderruflich</span>.</p>
      <p className="mt-3 text-[11px] text-muted">Tippe zur Bestätigung den Betriebsnamen:</p>
      <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={name} className="input mt-1.5" />
      {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end pt-4">
        <button onClick={onClose} className="btn-secondary">Abbrechen</button>
        <button onClick={submit} disabled={busy || confirmText !== name} className="rounded-md px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40" style={{ background: "var(--red)" }}>{busy ? "Lösche…" : "Endgültig löschen"}</button>
      </div>
    </ModalShell>
  );
}

function StandortModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [adresse, setAdresse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await adminFetch(`/api/admin/orgs/${id}/standorte`, { method: "POST", body: JSON.stringify({ name, adresse: adresse || null }) });
      onSaved();
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <ModalShell title="Standort anlegen" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="block text-[11px] font-medium text-muted mb-1.5">Name</label><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Filiale Mitte" className="input" /></div>
        <div><label className="block text-[11px] font-medium text-muted mb-1.5">Adresse</label><input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="optional" className="input" /></div>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        <div className="flex gap-2 justify-end pt-1"><button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button><button type="submit" disabled={busy} className="btn-primary">{busy ? "…" : "Anlegen"}</button></div>
      </form>
    </ModalShell>
  );
}
