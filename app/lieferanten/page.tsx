"use client";

import { useState, useEffect } from "react";
import AuthGuard from "../components/AuthGuard";
import AppHeader from "../components/AppHeader";
import { getLieferanten, saveLieferant, updateLieferant, deleteLieferant, getUserRole, getPreisHistorie } from "../../lib/database";
import { Lieferant, PreisHistorieEintrag, LieferantKategorie } from "../../lib/types";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const emptyForm: Omit<Lieferant, "id" | "user_id" | "erstellt_am"> = {
  name: "",
  email: "",
  telefon: "",
  iban: "",
  kundennummer: "",
  liefertage: [],
  aktiv: true,
  kategorie: "getraenke",
};

const KATEGORIE_LABEL: Record<LieferantKategorie, string> = {
  getraenke: "🍺 Getränke",
  food: "🍽 Food",
  beides: "Getränke & Food",
};

export default function LieferantenPage() {
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChef, setIsChef] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [preisHistorie, setPreisHistorie] = useState<PreisHistorieEintrag[]>([]);
  const [loadingHistorie, setLoadingHistorie] = useState(false);

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
      aktiv: l.aktiv ?? true,
      kategorie: l.kategorie || "getraenke",
    });
    setEditId(l.id!);
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
      if (expandedId === id) setExpandedId(null);
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

  const handleTogglePreise = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setPreisHistorie([]);
      return;
    }
    setExpandedId(id);
    setLoadingHistorie(true);
    try {
      const data = await getPreisHistorie(id);
      setPreisHistorie(data);
    } catch {
      setPreisHistorie([]);
    } finally {
      setLoadingHistorie(false);
    }
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Group history by normalized article name
  const buildPreisEntwicklung = (historie: PreisHistorieEintrag[]) => {
    const grouped: Record<string, PreisHistorieEintrag[]> = {};
    for (const e of historie) {
      if (!grouped[e.artikel]) grouped[e.artikel] = [];
      grouped[e.artikel].push(e);
    }
    return grouped;
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
              <p className="mt-2.5 text-[13.5px] text-muted">Stammdaten und Preishistorie verwalten.</p>
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
                  className="spotlight-card spotlight-border rounded-xl border border-border bg-surface-elevated reveal"
                  style={{ animationDelay: `${Math.min(idx * 0.04, 0.3)}s` }}>

                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-4 p-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-white truncate">{l.name}</h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${l.aktiv ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          {l.aktiv ? "Aktiv" : "Inaktiv"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted border border-border">
                          {KATEGORIE_LABEL[l.kategorie || "getraenke"]}
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
                        <p className="mt-1 text-xs text-muted">
                          {Object.keys(l.preisliste).length} Artikel in Preisliste
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleTogglePreise(l.id!)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          expandedId === l.id
                            ? "border-accent/50 bg-accent/10 text-accent"
                            : "border-border text-muted hover:text-white hover:border-accent/50"
                        }`}
                      >
                        Preise
                      </button>
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

                  {/* Preishistorie – aufklappbar */}
                  {expandedId === l.id && (
                    <div className="border-t border-border px-5 pb-5 pt-4">
                      {loadingHistorie ? (
                        <div className="flex justify-center py-6">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        </div>
                      ) : (
                        <>
                          {/* Aktuelle Preise */}
                          <div className="mb-5">
                            <h4 className="text-sm font-semibold text-white mb-3">Aktuelle Preise</h4>
                            {l.preisliste && Object.keys(l.preisliste).length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="pb-2 text-left font-medium text-muted">Artikel</th>
                                      <th className="pb-2 text-right font-medium text-muted">Preis</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(l.preisliste).map(([artikel, preis]) => (
                                      <tr key={artikel} className="border-b border-border/50 last:border-0">
                                        <td className="py-2 text-white">{artikel}</td>
                                        <td className="py-2 text-right text-white">€{(preis as number).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-muted rounded-lg bg-surface p-3">
                                Noch keine Preise vorhanden. Preise werden automatisch aus eingehenden Rechnungen übernommen.
                              </p>
                            )}
                          </div>

                          {/* Preisentwicklung – Chart + Tabelle */}
                          {preisHistorie.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-3">Preisentwicklung</h4>

                              {/* Recharts Line-Chart: eine Linie pro Artikel */}
                              {(() => {
                                const grouped = buildPreisEntwicklung(preisHistorie);
                                const artikelKeys = Object.keys(grouped).slice(0, 6); // max 6 Linien

                                // Build unified timeline: alle Daten sortiert, pro Datum ein Eintrag
                                const datumSet = new Set<string>();
                                artikelKeys.forEach(k => grouped[k].forEach(e => datumSet.add(e.erstellt_am!.split("T")[0])));
                                const daten = Array.from(datumSet).sort();
                                const chartData = daten.map(d => {
                                  const row: any = { datum: new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) };
                                  artikelKeys.forEach(k => {
                                    const match = grouped[k].find(e => e.erstellt_am!.startsWith(d));
                                    if (match) row[k] = match.einzelpreis;
                                  });
                                  return row;
                                });

                                const COLORS = ["#3b82f6", "#f97316", "#10b981", "#a78bfa", "#f43f5e", "#facc15"];

                                return daten.length >= 2 ? (
                                  <div className="mb-6 h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="datum" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={48} />
                                        <Tooltip
                                          contentStyle={{ background: "#0f1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
                                          labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}
                                          itemStyle={{ fontSize: 12 }}
                                          formatter={(value: any, name: any) => [`€${parseFloat(value).toFixed(2)}`, grouped[name]?.[0]?.artikel_original || String(name)]}
                                        />
                                        {artikelKeys.length > 1 && <Legend formatter={(value) => grouped[value]?.[0]?.artikel_original || value} wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />}
                                        {artikelKeys.map((k, i) => (
                                          <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                                        ))}
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                ) : null;
                              })()}

                              {/* Detail-Tabellen pro Artikel */}
                              {Object.entries(buildPreisEntwicklung(preisHistorie)).map(([artikel, eintraege]) => (
                                <div key={artikel} className="mb-4">
                                  <p className="text-xs font-medium text-muted mb-1">{eintraege[0].artikel_original || artikel}</p>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-border">
                                          <th className="pb-1.5 text-left font-medium text-muted">Datum</th>
                                          <th className="pb-1.5 text-right font-medium text-muted">Preis</th>
                                          <th className="pb-1.5 text-right font-medium text-muted">Änderung</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {eintraege.map((e, i) => {
                                          const prev = eintraege[i + 1];
                                          const delta = prev ? +(e.einzelpreis - prev.einzelpreis).toFixed(2) : null;
                                          const deltaPct = prev ? +((delta! / prev.einzelpreis) * 100).toFixed(1) : null;
                                          return (
                                            <tr key={e.id} className="border-b border-border/40 last:border-0">
                                              <td className="py-1.5 text-muted">{formatDate(e.erstellt_am!)}</td>
                                              <td className="py-1.5 text-right text-white">€{e.einzelpreis.toFixed(2)}</td>
                                              <td className="py-1.5 text-right">
                                                {delta != null ? (
                                                  <span className={delta > 0 ? "text-red-400" : delta < 0 ? "text-green-400" : "text-muted"}>
                                                    {delta > 0 ? "+" : ""}{delta.toFixed(2)} € ({deltaPct}%)
                                                  </span>
                                                ) : (
                                                  <span className="text-muted">—</span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {preisHistorie.length === 0 && !(l.preisliste && Object.keys(l.preisliste).length > 0) && (
                            <div className="rounded-lg border border-border bg-surface p-4 text-center">
                              <p className="text-sm text-muted">Noch keine Rechnungen verarbeitet.</p>
                              <p className="text-xs text-muted mt-1">Preise werden automatisch beim nächsten Rechnungseingang eingetragen.</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
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

                <div>
                  <label className="block text-xs font-medium text-muted mb-2">Kategorie</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["getraenke", "food", "beides"] as LieferantKategorie[]).map((kat) => (
                      <button key={kat} type="button" onClick={() => setForm(f => ({ ...f, kategorie: kat }))}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                          (form.kategorie || "getraenke") === kat
                            ? "border-accent bg-accent/20 text-accent"
                            : "border-border text-muted hover:text-white"
                        }`}>
                        {KATEGORIE_LABEL[kat]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">Bestimmt, in welchem Workflow (Getränke/Food) dieser Lieferant zur Auswahl steht.</p>
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

                <div className="rounded-lg bg-surface/50 border border-border/50 px-4 py-3">
                  <p className="text-xs text-muted">
                    Preise werden automatisch aus eingehenden Rechnungen übernommen und sind im Preise-Reiter einsehbar.
                  </p>
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
