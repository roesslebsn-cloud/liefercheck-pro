"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import LogoutButton from "../components/LogoutButton";
import { getAllLieferungen, deleteLieferung, getUserRole, initUserSettingsIfNeeded } from "../../lib/database";

type Filter = {
  status: "alle" | "abgeschlossen" | "in_bearbeitung";
  datum: "alle" | "heute" | "woche" | "monat";
  abweichungen: "alle" | "mit" | "ohne";
};

export default function DashboardPage() {
  const router = useRouter();
  const [lieferungen, setLieferungen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"chef" | "mitarbeiter">("mitarbeiter");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<Filter>({ status: "alle", datum: "alle", abweichungen: "alle" });

  useEffect(() => { init(); }, []);

  const init = async () => {
    await initUserSettingsIfNeeded();
    const [data, role] = await Promise.all([getAllLieferungen(), getUserRole()]);
    setLieferungen(data || []);
    setUserRole(role);
    setLoading(false);
  };

  const getLieferungStatus = (l: any) => {
    if (l.rechnung_data && l.lieferschein_data) return { label: "Abgeschlossen", color: "green" };
    if (l.abgleich_data) return { label: "Schritt 3/5", color: "blue" };
    if (l.lieferschein_data) return { label: "Schritt 2/5", color: "yellow" };
    if (l.pfand_items) return { label: "Schritt 1/5", color: "yellow" };
    return { label: "Neu", color: "gray" };
  };

  const getFiltered = () => lieferungen.filter(l => {
    const status = getLieferungStatus(l);
    if (filter.status === "abgeschlossen" && status.color !== "green") return false;
    if (filter.status === "in_bearbeitung" && status.color === "green") return false;
    if (filter.datum !== "alle") {
      const created = new Date(l.erstellt_am || l.created_at);
      const now = new Date();
      if (filter.datum === "heute" && created.toDateString() !== now.toDateString()) return false;
      if (filter.datum === "woche") { const w = new Date(now); w.setDate(now.getDate()-7); if (created < w) return false; }
      if (filter.datum === "monat") { const m = new Date(now); m.setMonth(now.getMonth()-1); if (created < m) return false; }
    }
    if (filter.abweichungen !== "alle") {
      const hat = l.abgleich_data?.abgleich?.some((a: any) => a.status !== "ok") || false;
      if (filter.abweichungen === "mit" && !hat) return false;
      if (filter.abweichungen === "ohne" && hat) return false;
    }
    return true;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteLieferung(deleteId); setLieferungen(prev => prev.filter(l => l.id !== deleteId)); }
    finally { setDeleting(false); setDeleteId(null); }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const stats = (() => {
    const now = new Date(); const w = new Date(now); w.setDate(now.getDate()-7);
    const done = lieferungen.filter(l => l.ersparnis_eur != null);
    const thisWeek = done.filter(l => new Date(l.erstellt_am || l.created_at) >= w);
    const total = done.reduce((s, l) => s + (l.ersparnis_eur || 0), 0);
    const week = thisWeek.reduce((s, l) => s + (l.ersparnis_eur || 0), 0);
    return { total, week, avg: done.length ? total/done.length : 0, count: lieferungen.length };
  })();

  const filtered = getFiltered();

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <header className="sticky top-0 z-10 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9.75 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-tight">LieferCheck Pro</span>
              {userRole === "chef" && (
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400 ring-1 ring-blue-500/20">Chef</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push("/analytics")} className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/5 hover:text-white transition-colors">
                Analyse
              </button>
              {userRole === "chef" && (
                <button onClick={() => router.push("/einstellungen")} className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/5 hover:text-white transition-colors">
                  Einstellungen
                </button>
              )}
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Lieferungen", value: stats.count.toString() },
              { label: "Diese Woche gespart", value: "€" + stats.week.toFixed(2), green: true },
              { label: "Gesamt gespart", value: "€" + stats.total.toFixed(2), green: true },
              { label: "Ø pro Lieferung", value: "€" + stats.avg.toFixed(2), green: true },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-xs text-white/40 mb-2">{s.label}</p>
                <p className={"text-xl font-bold " + (s.green ? "text-emerald-400" : "text-white")}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <button onClick={() => router.push("/lieferung/neu")} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Neue Lieferung
            </button>
            <div className="flex flex-wrap gap-2">
              <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value as any }))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none cursor-pointer">
                <option value="alle">Alle Status</option>
                <option value="abgeschlossen">Abgeschlossen</option>
                <option value="in_bearbeitung">In Bearbeitung</option>
              </select>
              <select value={filter.datum} onChange={e => setFilter(f => ({ ...f, datum: e.target.value as any }))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none cursor-pointer">
                <option value="alle">Alle Daten</option>
                <option value="heute">Heute</option>
                <option value="woche">Diese Woche</option>
                <option value="monat">Dieser Monat</option>
              </select>
              <select value={filter.abweichungen} onChange={e => setFilter(f => ({ ...f, abweichungen: e.target.value as any }))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:outline-none cursor-pointer">
                <option value="alle">Alle Abweichungen</option>
                <option value="mit">Mit Abweichungen</option>
                <option value="ohne">Ohne Abweichungen</option>
              </select>
              {(filter.status !== "alle" || filter.datum !== "alle" || filter.abweichungen !== "alle") && (
                <button onClick={() => setFilter({ status: "alle", datum: "alle", abweichungen: "alle" })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 hover:text-white transition-colors">✕ Reset</button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3].map(i => <div key={i} className="h-28 rounded-xl border border-white/5 bg-white/[0.02] animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center">
              <p className="text-3xl mb-3">📭</p>
              <p className="text-sm text-white/40">{lieferungen.length === 0 ? "Noch keine Lieferungen. Starten Sie jetzt!" : "Keine Lieferungen für diesen Filter."}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(l => {
                const status = getLieferungStatus(l);
                const hatAb = l.abgleich_data?.abgleich?.some((a: any) => a.status !== "ok");
                return (
                  <div key={l.id} onClick={() => router.push("/lieferung/detail?id=" + l.id)} className="group relative rounded-xl border border-white/5 bg-white/[0.02] p-5 hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-[11px] text-white/30 mb-1">{fmt(l.erstellt_am || l.created_at)}</p>
                        <p className="text-sm font-semibold text-white">Lieferung #{l.id?.slice(0,8)}</p>
                        {l.rechnung_data?.lieferant && <p className="text-xs text-white/40 mt-0.5">{l.rechnung_data.lieferant}</p>}
                      </div>
                      <span className={"shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold " + (
                        status.color === "green" ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                        : status.color === "blue" ? "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
                        : status.color === "yellow" ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                        : "bg-white/5 text-white/40 ring-1 ring-white/10"
                      )}>{status.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {l.ersparnis_eur != null && <span className="text-xs font-semibold text-emerald-400">+€{Number(l.ersparnis_eur).toFixed(2)}</span>}
                        {hatAb && <span className="text-[10px] text-amber-400/80">⚠ Abweichungen</span>}
                      </div>
                      {userRole === "chef" && (
                        <button onClick={e => { e.stopPropagation(); setDeleteId(l.id); }} className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Löschen">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111116] p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-white mb-1">Lieferung löschen?</h3>
              <p className="text-sm text-white/40 mb-6">Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors">Abbrechen</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                  {deleting ? "Löschen..." : "Ja, löschen"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}