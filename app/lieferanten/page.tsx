"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import AppHeader from "../components/AppHeader";
import { getLieferanten, saveLieferant, updateLieferant, deleteLieferant } from "../../lib/database";
import { getUserRole } from "../../lib/database";
import { Lieferant } from "../../lib/types";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const emptyForm: Omit<Lieferant, "id" | "user_id" | "erstellt_am"> = {
  name: "",
  email: "",
  telefon: "",
  iban: "",
  kundennummer: "",
  liefertage: [],
  preisliste: {},
  aktiv: true,
};

export default function LieferantenPage() {
  const router = useRouter();
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChef, setIsChef] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [preisArtikel, setPreisArtikel] = useState("");
  const [preisWert, setPreisWert] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getLieferanten(), getUserRole()])
      .then(([data, role]) => {
        setLieferanten(data);
        setIsChef(role === "chef");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openNew = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setPreisArtikel("");
    setPreisWert("");
    setShowForm(true);
  };

  const openEdit = (l: Lieferant) => {
    setForm({
      name: l.name,
      email: l.email || "",
      telefon: l.telefon || "",
      iban: l.iban || "",
      kundennummer: l.kundennummer || "",
      liefertage: l.liefertage || [],
      preisliste: l.preisliste || {},
      aktiv: l.aktiv ?? true,
    });
    setEditId(l.id!);
    setPreisArtikel("");
    setPreisWert("");
    setShowForm(true);
  };

  const handleToggleTag = (tag: string) => {
    setForm(f => ({
      ...f,
      liefertage: f.liefertage?.includes(tag)
        ? f.liefertage.filter(t => t !== tag)
        : [...(f.liefertage || []), tag],
    }));
  };

  const handleAddPreis = () => {
    if (!preisArtikel.trim() || !preisWert.trim()) return;
    const wert = parseFloat(preisWert.replace(",", "."));
    if (isNaN(wert)) return;
    setForm(f => ({ ...f, preisliste: { ...f.preisliste, [preisArtikel.trim()]: wert } }));
    setPreisArtikel("");
    setPreisWert("");
  };

  const handleRemovePreis = (artikel: string) => {
    setForm(f => {
      const pl = { ...f.preisliste };
      delete pl[artikel];
      return { ...f, preisliste: pl };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name ist Pflichtfeld."); return; }
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        const updated = await updateLieferant(editId, form);
        setLieferanten(prev => prev.map(l => l.id === editId ? updated : l));
      } else {
        const created = await saveLieferant(form);
        setLieferanten(prev => [...prev, created]);
      }
      setShowForm(false);
    } catch (e: any) {
      setError("Fehler beim Speichern: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Lieferant wirklich löschen?")) return;
    try {
      await deleteLieferant(id);
      setLieferanten(prev => prev.filter(l => l.id !== id));
    } catch (e: any) {
      alert("Fehler beim Löschen: " + e.message);
    }
  };

  const handleToggleAktiv = async (l: Lieferant) => {
    try {
      const updated = await updateLieferant(l.id!, { aktiv: !l.aktiv });
      setLieferanten(prev => prev.map(x => x.id === l.id ? updated : x));
    } catch (e: any) {
      alert("Fehler: " + e.message);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen relative">
        <div className="aurora-bg" />
        <AppHeader />

        <main className="mx-auto w-full max-w-[1200px] px-5 sm:px-8 pt-10 pb-20 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 reveal">
            <div>
              <h1 className="text-[32px] font-semibold tracking-tight gradient-text leading-none">Lieferanten</h1>
              <p className="mt-2.5 text-[13.5px] text-muted">Stammdaten und Preislisten verwalten.</p>
            </div>
            <button onClick={openNew} className="btn-primary btn-magnetic">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Neuer Lieferant
            </button>
          </div>

          {loading ? (
            <div className="mt-16 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : lieferanten.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-muted">Noch keine Lieferanten angelegt.</p>
              <button onClick={openNew} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors">
                Ersten Lieferanten anlegen
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {lieferanten.map((l, idx) => (
                <div key={l.id}
                  className="spotlight-card spotlight-border rounded-xl border border-border bg-surface-elevated p-5 hover-lift reveal"
                  style={{ animationDelay: `${Math.min(idx * 0.04, 0.3)}s` }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-white truncate">{l.name}</h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${l.aktiv ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          {l.aktiv ? "Aktiv" : "Inaktiv"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                        {l.email && <span>{l.email}</span>}
                        {l.telefon && <span>{l.telefon}</span>}
                        {l.kundennummer && <span>KdNr: {l.kundennummer}</span>}
                        {l.liefertage && l.liefertage.length > 0 && (
                          <span>Liefertage: {l.liefertage.join(", ")}</span>
                        )}
                      </div>
                      {l.preisliste && Object.keys(l.preisliste).length > 0 && (
                        <p className="mt-1 text-xs text-muted">{Object.keys(l.preisliste).length} Artikel in Preisliste</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleToggleAktiv(l)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-white hover:border-accent/50 transition-colors">
                        {l.aktiv ? "Deaktivieren" : "Aktivieren"}
                      </button>
                      <button onClick={() => openEdit(l)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-white hover:border-accent/50 transition-colors">
                        Bearbeiten
                      </button>
                      {isChef && (
                        <button onClick={() => handleDelete(l.id!)} className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                          Löschen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Formular-Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-elevated shadow-xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-lg font-semibold text-white">{editId ? "Lieferant bearbeiten" : "Neuer Lieferant"}</h2>
                <button onClick={() => setShowForm(false)} className="text-muted hover:text-white transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 px-6 py-5">
                {error && <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-400">{error}</p>}

                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                    placeholder="z.B. Getränke Müller GmbH" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">E-Mail</label>
                    <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                      placeholder="bestellung@..." type="email" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Telefon</label>
                    <input value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                      placeholder="+49..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Kundennummer</label>
                    <input value={form.kundennummer} onChange={e => setForm(f => ({ ...f, kundennummer: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                      placeholder="12345" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">IBAN</label>
                    <input value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                      placeholder="DE..." />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted mb-2">Liefertage</label>
                  <div className="flex gap-2 flex-wrap">
                    {WOCHENTAGE.map(tag => (
                      <button key={tag} type="button" onClick={() => handleToggleTag(tag)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          form.liefertage?.includes(tag)
                            ? "border-accent bg-accent/20 text-accent"
                            : "border-border text-muted hover:text-white"
                        }`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted mb-2">Preisliste</label>
                  {form.preisliste && Object.keys(form.preisliste).length > 0 && (
                    <div className="mb-2 space-y-1">
                      {Object.entries(form.preisliste).map(([artikel, preis]) => (
                        <div key={artikel} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm">
                          <span className="text-white">{artikel}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-muted">€{preis.toFixed(2)}</span>
                            <button onClick={() => handleRemovePreis(artikel)} className="text-red-400 hover:text-red-300">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input value={preisArtikel} onChange={e => setPreisArtikel(e.target.value)}
                      className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                      placeholder="Artikel (z.B. Augustiner 0.5l)" />
                    <input value={preisWert} onChange={e => setPreisWert(e.target.value)}
                      className="w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                      placeholder="€" />
                    <button onClick={handleAddPreis} className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-white hover:border-accent/50 transition-colors">
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                <button onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-white transition-colors">
                  Abbrechen
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors">
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
