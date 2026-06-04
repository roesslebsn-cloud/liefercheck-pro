"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import AppHeader from "../components/AppHeader";
import { getStandorte, saveStandort, updateStandort, deleteStandort, getUserRole } from "../../lib/database";
import { Standort } from "../../lib/types";

const emptyForm = { name: "", adresse: "", aktiv: true };

export default function StandortePage() {
  const router = useRouter();
  const [standorte, setStandorte] = useState<Standort[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChef, setIsChef] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getStandorte(), getUserRole()])
      .then(([data, role]) => { setStandorte(data); setIsChef(role === "chef"); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openNew = () => { setForm({ ...emptyForm }); setEditId(null); setShowForm(true); };
  const openEdit = (s: Standort) => { setForm({ name: s.name, adresse: s.adresse || "", aktiv: s.aktiv ?? true }); setEditId(s.id!); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name ist Pflichtfeld."); return; }
    setSaving(true); setError(null);
    try {
      if (editId) {
        const updated = await updateStandort(editId, form);
        setStandorte(prev => prev.map(s => s.id === editId ? updated : s));
      } else {
        const created = await saveStandort(form);
        setStandorte(prev => [...prev, created]);
      }
      setShowForm(false);
    } catch (e: any) {
      setError("Fehler: " + e.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Standort wirklich löschen?")) return;
    try { await deleteStandort(id); setStandorte(prev => prev.filter(s => s.id !== id)); }
    catch (e: any) { alert("Fehler: " + e.message); }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen relative">
        <div className="aurora-bg" />
        <AppHeader />

        <main className="mx-auto w-full max-w-[1200px] px-5 sm:px-8 pt-10 pb-20 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 reveal">
            <div>
              <h1 className="text-[32px] font-semibold tracking-tight gradient-text leading-none">Standorte</h1>
              <p className="mt-2.5 text-[13.5px] text-muted">Filialen verwalten und Lieferungen pro Standort filtern.</p>
            </div>
            {isChef && (
              <button onClick={openNew} className="btn-primary btn-magnetic">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Neuer Standort
              </button>
            )}
          </div>

          {loading ? (
            <div className="mt-16 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>
          ) : standorte.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-muted">Noch keine Standorte angelegt.</p>
              {isChef && <button onClick={openNew} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors">Ersten Standort anlegen</button>}
            </div>
          ) : (
            <div className="mt-2 space-y-3">
              {standorte.map((s, idx) => (
                <div key={s.id}
                  className="spotlight-card spotlight-border rounded-xl border border-border bg-surface-elevated p-5 flex items-center justify-between gap-4 hover-lift reveal"
                  style={{ animationDelay: `${Math.min(idx * 0.04, 0.3)}s` }}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md" style={{ background: "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)" }}>
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-[14.5px]">{s.name}</h3>
                        <span className={`badge ${s.aktiv ? "badge-green" : "badge-gray"}`}>
                          {s.aktiv && <span className="status-dot" style={{ width: "5px", height: "5px", background: "currentColor", color: "currentColor" }} />}
                          {s.aktiv ? "Aktiv" : "Inaktiv"}
                        </span>
                      </div>
                      {s.adresse && <p className="mt-1 text-[12px] text-muted">{s.adresse}</p>}
                    </div>
                  </div>
                  {isChef && (
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)} className="btn-secondary">Bearbeiten</button>
                      <button onClick={() => handleDelete(s.id!)} className="rounded-md border border-red-500/30 px-3 py-1.5 text-[12.5px] font-medium text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all">Löschen</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-surface-elevated shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-lg font-semibold text-white">{editId ? "Standort bearbeiten" : "Neuer Standort"}</h2>
                <button onClick={() => setShowForm(false)} className="text-muted hover:text-white transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-4 px-6 py-5">
                {error && <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-400">{error}</p>}
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                    placeholder="z.B. Hauptrestaurant München" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Adresse</label>
                  <input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                    placeholder="Musterstraße 1, 80333 München" />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-surface px-4 py-3">
                  <p className="text-sm font-medium text-white">Aktiv</p>
                  <button onClick={() => setForm(f => ({ ...f, aktiv: !f.aktiv }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.aktiv ? "bg-accent" : "bg-surface-elevated"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.aktiv ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                <button onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-white transition-colors">Abbrechen</button>
                <button onClick={handleSave} disabled={saving} className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors">
                  {saving ? "Speichern..." : "Speichern"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
