"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import LogoutButton from "../components/LogoutButton";
import { getAllLieferungen, deleteLieferung, getUserRole, initUserSettingsIfNeeded, getStandorte, markZuletztAktiv } from "../../lib/database";
import { isSuperAdminEmail } from "../../lib/admin";
import { supabase } from "../../lib/supabase";
import { Standort } from "../../lib/types";
import { useCountUp } from "../../lib/useCountUp";

type Filter = {
  status: "alle" | "abgeschlossen" | "in_bearbeitung";
  datum: "alle" | "heute" | "woche" | "monat";
  abweichungen: "alle" | "mit" | "ohne";
};

// ─── Animated number for KPI cards ─────────────────────
function AnimatedNumber({ value, prefix = "", decimals = 0, ready }: { value: number; prefix?: string; decimals?: number; ready: boolean }) {
  const animated = useCountUp(value, 1100, ready);
  return <>{prefix}{animated.toFixed(decimals)}</>;
}

// ─── Spotlight card wrapper (mouse-following glow) ─────
function SpotlightCard({ children, className = "", onClick, style }: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };
  return (
    <div className={`spotlight-card spotlight-border ${className}`} onMouseMove={handleMouseMove} onClick={onClick} style={style}>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [lieferungen, setLieferungen] = useState<any[]>([]);
  const [standorte, setStandorte] = useState<Standort[]>([]);
  const [aktiverStandort, setAktiverStandort] = useState<string>("alle");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"chef" | "mitarbeiter">("mitarbeiter");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<Filter>({ status: "alle", datum: "alle", abweichungen: "alle" });
  const [search, setSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    await initUserSettingsIfNeeded();
    const [data, role, standortData, { data: { user } }] = await Promise.all([
      getAllLieferungen(),
      getUserRole(),
      getStandorte(),
      supabase.auth.getUser(),
    ]);
    setStandorte(standortData);
    setLieferungen(data || []);
    setUserRole(role);
    setIsAdmin(isSuperAdminEmail(user?.email));
    markZuletztAktiv();
    setLoading(false);
  };

  const getLieferungStatus = (l: any) => {
    if (l.status === "abgeschlossen" || (l.rechnung_data && l.lieferschein_data)) return { label: "Abgeschlossen", color: "green", step: 5 };
    if (l.abgleich_data) return { label: "Schritt 3/5", color: "blue", step: 3 };
    if (l.lieferschein_data) return { label: "Schritt 2/5", color: "yellow", step: 2 };
    if (l.pfand_items) return { label: "Schritt 1/5", color: "yellow", step: 1 };
    return { label: "Neu", color: "gray", step: 0 };
  };

  const getFiltered = () => {
    const byStandort = aktiverStandort === "alle" ? lieferungen : lieferungen.filter(l => l.standort_id === aktiverStandort);
    return byStandort.filter(l => {
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
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const fields = [l.rechnung_data?.lieferant, l.id, l.rechnung_data?.rechnungs_nummer, l.notiz].join(" ").toLowerCase();
        if (!fields.includes(q)) return false;
      }
      return true;
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { await deleteLieferung(deleteId); setLieferungen(prev => prev.filter(l => l.id !== deleteId)); }
    finally { setDeleting(false); setDeleteId(null); }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });

  const stats = (() => {
    const now = new Date(); const w = new Date(now); w.setDate(now.getDate()-7);
    const done = lieferungen.filter(l => l.ersparnis_eur != null);
    const thisWeek = done.filter(l => new Date(l.erstellt_am || l.created_at) >= w);
    const total = done.reduce((s, l) => s + (l.ersparnis_eur || 0), 0);
    const week = thisWeek.reduce((s, l) => s + (l.ersparnis_eur || 0), 0);
    const mitAb = lieferungen.filter(l => l.abgleich_data?.abgleich?.some((a: any) => a.status !== "ok")).length;
    return { total, week, count: lieferungen.length, mitAb };
  })();

  const filtered = getFiltered();
  const activeFilters = (filter.status !== "alle" ? 1 : 0) + (filter.datum !== "alle" ? 1 : 0) + (filter.abweichungen !== "alle" ? 1 : 0);

  const navItems = [
    { label: "Analyse", path: "/analytics" },
    { label: "Lieferanten", path: "/lieferanten" },
    { label: "Standorte", path: "/standorte" },
    { label: "Team", path: "/team" },
    { label: "Einstellungen", path: "/einstellungen" },
    ...(isAdmin ? [{ label: "Admin", path: "/admin" }] : []),
  ];

  return (
    <AuthGuard>
      <div className="min-h-screen relative">
        {/* Aurora background — slow animated gradient */}
        <div className="aurora-bg" />
        <div className="fixed inset-0 grid-bg pointer-events-none" style={{ zIndex: -1, maskImage: "radial-gradient(ellipse at center, #000 0%, transparent 70%)" }} />

        {/* ─── Header ─────────────────────────────────────── */}
        <header className="header-backdrop sticky top-0 z-30">
          <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md relative overflow-hidden" style={{ background: "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)" }}>
                  <svg className="h-3.5 w-3.5 text-white relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9.75 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                  </svg>
                </div>
                <span className="text-[14px] font-semibold tracking-tight text-white">LieferCheck</span>
                {userRole === "chef" && <span className="badge badge-blue">Chef</span>}
              </div>

              <nav className="hidden sm:flex items-center gap-4">
                {navItems.map(item => (
                  <button key={item.path} onClick={() => router.push(item.path)}
                    className="underline-grow text-[13px] font-medium text-muted hover:text-white transition-colors py-1.5">
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <LogoutButton />
            </div>

            <button className="sm:hidden p-2 rounded-md text-muted hover:text-white" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                {mobileNavOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
              </svg>
            </button>
          </div>

          {mobileNavOpen && (
            <div className="sm:hidden border-t border-border bg-surface px-5 py-3 space-y-1 animate-slide-up">
              {navItems.map(item => (
                <button key={item.path} onClick={() => { router.push(item.path); setMobileNavOpen(false); }}
                  className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-surface-elevated hover:text-white transition-colors">
                  {item.label}
                </button>
              ))}
              <LogoutButton />
            </div>
          )}
        </header>

        {/* ─── Main ─────────────────────────────────────── */}
        <main className="mx-auto max-w-[1200px] px-5 sm:px-8 pt-10 pb-20 relative">

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 reveal">
            <div>
              <h1 className="text-[32px] font-semibold tracking-tight gradient-text leading-none">Dashboard</h1>
              <p className="mt-2.5 text-[13.5px] text-muted">Übersicht aller Lieferungen und erkannter Abweichungen.</p>
            </div>
            <button onClick={() => router.push("/lieferung/neu")} className="btn-primary btn-magnetic glow-ring">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Neue Lieferung
            </button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {[
              { label: "Lieferungen gesamt", value: stats.count, sub: stats.count === 1 ? "Lieferung" : "Lieferungen", decimals: 0 },
              { label: "Diese Woche gespart", value: stats.week, prefix: "€", decimals: 2, sub: stats.week > 0 ? "Erkannte Überzahlungen" : "Noch keine Ersparnis", accent: stats.week > 0 },
              { label: "Gesamt gespart", value: stats.total, prefix: "€", decimals: 2, sub: "Seit Start", accent: stats.total > 0 },
              { label: "Abweichungen", value: stats.mitAb, decimals: 0, sub: stats.mitAb === 1 ? "Lieferung betroffen" : "Lieferungen betroffen", warning: stats.mitAb > 0 },
            ].map((s, i) => (
              <SpotlightCard key={s.label}
                className="rounded-lg p-5 reveal"
                style={{
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-inset)",
                  animationDelay: `${i * 0.08}s`,
                }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted">{s.label}</p>
                  {(s.accent || s.warning) && (
                    <span className="status-dot" style={{ color: s.warning ? "var(--orange)" : "var(--accent)", background: s.warning ? "var(--orange)" : "var(--accent)" }} />
                  )}
                </div>
                <p className="text-[30px] font-semibold tracking-tight leading-none tabular-nums"
                  style={{ color: s.warning ? "var(--orange)" : s.accent ? "var(--accent)" : "var(--text)" }}>
                  <AnimatedNumber value={s.value} prefix={s.prefix || ""} decimals={s.decimals} ready={!loading} />
                </p>
                <p className="mt-2.5 text-[11.5px] text-muted">{s.sub}</p>
              </SpotlightCard>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-6 reveal" style={{ animationDelay: "0.3s" }}>
            <div className="relative flex-1">
              <svg className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Lieferanten, Rechnungsnummer, Notiz ..."
                className="input pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: filter.status, options: [["alle","Status"],["abgeschlossen","Abgeschlossen"],["in_bearbeitung","In Bearbeitung"]], onChange: (v: string) => setFilter(f => ({ ...f, status: v as any })) },
                { value: filter.datum, options: [["alle","Zeitraum"],["heute","Heute"],["woche","Diese Woche"],["monat","Dieser Monat"]], onChange: (v: string) => setFilter(f => ({ ...f, datum: v as any })) },
                { value: filter.abweichungen, options: [["alle","Abweichungen"],["mit","Mit"],["ohne","Ohne"]], onChange: (v: string) => setFilter(f => ({ ...f, abweichungen: v as any })) },
              ].map((sel, i) => (
                <select key={i} value={sel.value} onChange={e => sel.onChange(e.target.value)}
                  className={`input cursor-pointer ${sel.value !== "alle" ? "text-accent" : "text-muted"}`}
                  style={{ width: "auto", paddingRight: "30px" }}>
                  {sel.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}

              {standorte.length > 0 && (
                <select value={aktiverStandort} onChange={e => setAktiverStandort(e.target.value)}
                  className={`input cursor-pointer ${aktiverStandort !== "alle" ? "text-accent" : "text-muted"}`}
                  style={{ width: "auto", paddingRight: "30px" }}>
                  <option value="alle">Alle Standorte</option>
                  {standorte.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}

              {(activeFilters > 0 || search) && (
                <button onClick={() => { setFilter({ status: "alle", datum: "alle", abweichungen: "alle" }); setSearch(""); }}
                  className="btn-ghost text-[12px]">
                  Zurücksetzen
                </button>
              )}
            </div>
          </div>

          {/* Lieferungen Grid */}
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="skeleton rounded-lg h-[140px]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg p-16 text-center reveal" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
              <div className="mx-auto h-12 w-12 rounded-full bg-surface flex items-center justify-center mb-4 animate-float">
                <svg className="h-6 w-6 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 7.5 9l3.75 3.75M7.5 9v9M16.5 21V9.75A2.25 2.25 0 0 1 18.75 7.5h.75M16.5 21H7.5M16.5 21h2.25c1.243 0 2.25-1.007 2.25-2.25V6.75A2.25 2.25 0 0 0 18.75 4.5H5.25A2.25 2.25 0 0 0 3 6.75v12c0 1.243 1.007 2.25 2.25 2.25H7.5" />
                </svg>
              </div>
              <p className="text-[14px] font-medium text-white mb-1">{lieferungen.length === 0 ? "Noch keine Lieferungen" : "Keine Treffer"}</p>
              <p className="text-[13px] text-muted mb-6">
                {lieferungen.length === 0 ? "Starte mit der ersten Lieferprüfung." : "Passe Suche oder Filter an."}
              </p>
              {lieferungen.length === 0 && (
                <button onClick={() => router.push("/lieferung/neu")} className="btn-primary btn-magnetic">Erste Lieferung anlegen</button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((l, idx) => {
                const status = getLieferungStatus(l);
                const hatAb = l.abgleich_data?.abgleich?.some((a: any) => a.status !== "ok");
                const stepPct = (status.step / 5) * 100;
                const dateStr = l.erstellt_am || l.created_at;
                return (
                  <SpotlightCard key={l.id}
                    onClick={() => router.push("/lieferung/detail?id=" + l.id)}
                    className="group cursor-pointer p-5 rounded-lg reveal hover-lift"
                    style={{
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      boxShadow: "var(--shadow-inset)",
                      animationDelay: `${Math.min(idx * 0.04, 0.3)}s`,
                    }}>

                    {/* Top accent stripe — animated progress */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden rounded-t-lg">
                      <div className="h-full transition-all duration-700" style={{
                        background: status.color === "green" ? "linear-gradient(90deg, var(--green), transparent)"
                          : status.color === "blue" ? "linear-gradient(90deg, var(--accent), transparent)"
                          : status.color === "yellow" ? "linear-gradient(90deg, var(--orange), transparent)"
                          : "transparent",
                        width: `${stepPct}%`,
                      }} />
                    </div>

                    {/* Header: Date + Status badge */}
                    <div className="flex items-start justify-between mb-4 gap-2">
                      <div className="min-w-0">
                        <p className="text-[10.5px] uppercase tracking-wider font-medium mb-1.5" style={{ color: "var(--text-faint)" }}>
                          {fmt(dateStr)}
                        </p>
                        <p className="text-[14.5px] font-semibold text-white truncate leading-tight">
                          {l.rechnung_data?.lieferant || `Lieferung #${l.id?.slice(0,8)}`}
                        </p>
                        <p className="text-[11.5px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>
                          {l.rechnung_data?.rechnungs_nummer ? `Rechnung ${l.rechnung_data.rechnungs_nummer}` : `#${l.id?.slice(0,8)}`}
                        </p>
                      </div>
                      <span className={`badge shrink-0 ${
                        status.color === "green" ? "badge-green" :
                        status.color === "blue"  ? "badge-blue"  :
                        status.color === "yellow"? "badge-orange":
                        "badge-gray"
                      }`}>
                        {status.color !== "gray" && status.color !== "green" && (
                          <span className="status-dot" style={{ width: "5px", height: "5px", background: "currentColor", color: "currentColor", marginRight: "1px" }} />
                        )}
                        {status.label}
                      </span>
                    </div>

                    {/* Progress bar - only for in-progress */}
                    {status.step > 0 && status.step < 5 && (
                      <div className="mb-4">
                        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "var(--surface)" }}>
                          <div className="h-full transition-all duration-1000 ease-out" style={{
                            width: `${stepPct}%`,
                            background: "linear-gradient(90deg, var(--accent), #a78bfa)",
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Footer: Ersparnis + actions */}
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2 min-w-0">
                        {l.ersparnis_eur > 0 ? (
                          <span className="flex items-center gap-1 text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--green)" }}>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                            </svg>
                            +€{Number(l.ersparnis_eur).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[12px] text-muted">Keine Ersparnis</span>
                        )}
                        {hatAb && <span className="badge badge-orange">Abweichung</span>}
                      </div>

                      {userRole === "chef" && (
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteId(l.id); }}
                          className="opacity-0 group-hover:opacity-100 rounded p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </SpotlightCard>
                );
              })}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <p className="mt-6 text-center text-[11.5px] text-muted reveal" style={{ animationDelay: "0.4s" }}>
              {filtered.length} von {lieferungen.length} {lieferungen.length === 1 ? "Lieferung" : "Lieferungen"}
            </p>
          )}
        </main>

        {/* ─── Delete Modal ─────────────────────────────────────── */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ background: "rgba(8,9,12,0.7)", backdropFilter: "blur(8px)" }}>
            <div className="w-full max-w-sm rounded-lg p-6 animate-scale-in" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-hover)", boxShadow: "var(--shadow-lg)" }}>
              <div className="flex items-start gap-3 mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md flex-shrink-0" style={{ background: "var(--red-muted)" }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: "var(--red)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-white">Lieferung löschen</h3>
                  <p className="text-[12.5px] mt-1 text-muted">Diese Aktion ist nicht rückgängig zu machen.</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteId(null)} className="btn-secondary">Abbrechen</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="rounded-md px-4 py-2 text-[13px] font-medium text-white transition-colors disabled:opacity-50"
                  style={{ background: "var(--red)" }}>
                  {deleting ? "Lösche..." : "Löschen"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
