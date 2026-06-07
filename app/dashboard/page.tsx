"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import LogoutButton from "../components/LogoutButton";
import { getAllLieferungen, deleteLieferung, getUserRole, initUserSettingsIfNeeded, getStandorte, markZuletztAktiv, ensureOrganisation, getUserSettings, getAktiveAnkuendigung, getMeineFeatures } from "../../lib/database";
import { isSuperAdminEmail } from "../../lib/admin";
import { supabase } from "../../lib/supabase";
import { Standort, PlattformEinstellungen } from "../../lib/types";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { SpotlightCard } from "../components/SpotlightCard";

type Filter = {
  status: "alle" | "abgeschlossen" | "in_bearbeitung";
  datum: "alle" | "heute" | "woche" | "monat";
  abweichungen: "alle" | "mit" | "ohne";
};

// ─── Ersparnis-Verlauf: dependency-freier SVG-Trend mit Hover-Tooltip ─────
function SavingsTrend({ lieferungen, ready }: { lieferungen: any[]; ready: boolean }) {
  const [hover, setHover] = useState<number | null>(null);

  const points = (() => {
    const done = lieferungen
      .filter(l => l.ersparnis_eur != null)
      .map(l => ({ date: new Date(l.erstellt_am || l.created_at), val: Number(l.ersparnis_eur) || 0 }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    let cum = 0;
    return done.map(d => { cum += d.val; return { date: d.date, val: d.val, cum }; });
  })();

  const fmtD = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
  const total = points.length ? points[points.length - 1].cum : 0;
  const maxCum = Math.max(1, ...points.map(p => p.cum));

  // Koordinaten in 0..100 (preserveAspectRatio="none" → matcht HTML-Overlay %)
  const coords = points.map((p, i) => ({
    x: points.length === 1 ? 50 : (i / (points.length - 1)) * 100,
    y: 92 - (p.cum / maxCum) * 78, // 14..92
    ...p,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ");
  const areaPath = coords.length
    ? `${linePath} L 100 100 L 0 100 Z`
    : "";

  return (
    <SpotlightCard
      className="relative overflow-hidden rounded-xl p-4 sm:p-5 reveal hover-lift mb-6"
      style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-inset)", animationDelay: "0.28s" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted">Ersparnis-Verlauf</p>
          <p className="mt-1.5 text-[22px] font-semibold tracking-tight leading-none tabular-nums" style={{ color: "var(--green)" }}>
            <AnimatedNumber value={total} prefix="€" decimals={2} ready={ready} />
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted">kumuliert über alle geprüften Lieferungen</p>
        </div>
        <span className="badge badge-green">
          <span className="status-dot" style={{ width: 5, height: 5, background: "currentColor", color: "currentColor" }} />
          {points.length} {points.length === 1 ? "Abschluss" : "Abschlüsse"}
        </span>
      </div>

      {coords.length < 2 ? (
        <div className="mt-5 flex h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full animate-float" style={{ background: "var(--green-muted)", color: "var(--green)" }}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
            </svg>
          </div>
          <p className="mt-3 text-[13px] font-medium text-white">Dein Ersparnis-Verlauf entsteht hier</p>
          <p className="mt-1 text-[11.5px] text-muted">Schließe Lieferungen ab – die Kurve wächst mit jeder erkannten Überzahlung.</p>
        </div>
      ) : (
        <>
          <div className="relative mt-5 h-[120px] w-full"
            onMouseLeave={() => setHover(null)}>
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(16,185,129,0.28)" />
                  <stop offset="100%" stopColor="rgba(16,185,129,0)" />
                </linearGradient>
              </defs>
              <path className="trend-area" d={areaPath} fill="url(#trendFill)" />
              <path className="trend-line" d={linePath} fill="none" stroke="var(--green)" strokeWidth={2}
                vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>

            {/* Hover-Marker */}
            {hover !== null && coords[hover] && (
              <>
                <div className="pointer-events-none absolute top-0 bottom-0 w-px"
                  style={{ left: `${coords[hover].x}%`, background: "rgba(16,185,129,0.35)" }} />
                <div className="pointer-events-none absolute h-2.5 w-2.5 rounded-full ring-2"
                  style={{ left: `${coords[hover].x}%`, top: `${coords[hover].y}%`, transform: "translate(-50%,-50%)", background: "var(--green)", boxShadow: "0 0 0 4px rgba(16,185,129,0.18)" }} />
                <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-center"
                  style={{ left: `${Math.min(88, Math.max(12, coords[hover].x))}%`, top: 0, background: "var(--surface-hover)", border: "1px solid var(--border-hover)", boxShadow: "var(--shadow)" }}>
                  <p className="text-[11px] font-semibold tabular-nums text-white">€{coords[hover].cum.toFixed(2)}</p>
                  <p className="text-[10px] text-muted">{fmtD(coords[hover].date)} · +€{coords[hover].val.toFixed(2)}</p>
                </div>
              </>
            )}

            {/* Unsichtbare Hover-Spalten */}
            <div className="absolute inset-0 flex">
              {coords.map((_, i) => (
                <div key={i} className="h-full flex-1 cursor-crosshair" onMouseEnter={() => setHover(i)} />
              ))}
            </div>
          </div>

          <div className="mt-2 flex justify-between text-[10.5px] text-muted">
            <span>{fmtD(coords[0].date)}</span>
            <span>{fmtD(coords[coords.length - 1].date)}</span>
          </div>
        </>
      )}
    </SpotlightCard>
  );
}

// ─── Persönliche, warme Begrüßung (Tageszeit + Psychologie) ───────────────
function GreetingHero({ vorname, stats, pending, onNew }: { vorname: string; stats: any; pending: number; onNew: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [variant, setVariant] = useState(0);

  useEffect(() => {
    setMounted(true);
    // Streak (Don't-break-the-chain): aufeinanderfolgende Besuchstage via localStorage
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const raw = localStorage.getItem("lc_streak");
      let count = 1;
      if (raw) {
        const parsed = JSON.parse(raw);
        const last = new Date(parsed.last);
        const diff = Math.round((today.getTime() - last.getTime()) / 86400000);
        if (diff === 0) count = parsed.count || 1;
        else if (diff === 1) count = (parsed.count || 0) + 1;
        else count = 1;
      }
      localStorage.setItem("lc_streak", JSON.stringify({ last: today.toISOString(), count }));
      setStreak(count);
    } catch {}
    setVariant(Math.floor(Math.random() * 4)); // variable Belohnung: wechselnde Zeile pro Besuch
  }, []);

  const now = new Date();
  const h = now.getHours();
  const period = h < 5 ? "nacht" : h < 11 ? "morgen" : h < 14 ? "mittag" : h < 18 ? "tag" : h < 22 ? "abend" : "nacht";
  const greetMap: Record<string, string> = {
    morgen: "Guten Morgen", mittag: "Guten Mittag", tag: "Schönen Nachmittag", abend: "Guten Abend", nacht: "Schön, dass du da bist",
  };
  const themeMap: Record<string, [string, string]> = {
    morgen: ["#fbbf24", "#fb923c"],
    mittag: ["#fcd34d", "#34d399"],
    tag:    ["#5b6cff", "#34d399"],
    abend:  ["#fb7185", "#a78bfa"],
    nacht:  ["#818cf8", "#6366f1"],
  };
  const greeting = greetMap[period];
  const [c1, c2] = themeMap[period];
  const isNight = period === "nacht";

  const total = stats.total || 0;
  const hours = Math.round((stats.zeitMin || 0) / 60);
  const firstName = vorname || "";

  // Tagline-Pool – datengetrieben, warm, motivierend (Anker + Goal-Gradient)
  const lines: string[] = [];
  if (pending > 0) {
    lines.push(`${pending} ${pending === 1 ? "Lieferung wartet" : "Lieferungen warten"} auf dich – in wenigen Minuten erledigt.`);
  }
  if (total > 0) {
    lines.push(`Schon €${total.toFixed(0)} zu viel Berechnetes zurückgeholt. Stark.`);
    if (hours >= 1) lines.push(`Deine Prüfungen haben dir rund ${hours} ${hours === 1 ? "Stunde" : "Stunden"} erspart.`);
    const milestone = Math.ceil((total + 0.01) / 100) * 100;
    lines.push(`Nur noch €${(milestone - total).toFixed(0)} bis zu €${milestone} gespart – du packst das.`);
    lines.push("Du bist deinen Lieferanten einen Schritt voraus. 💪");
  }
  if (lines.length === 0) lines.push("Schön, dass du da bist. Deine erste Prüfung dauert keine 5 Minuten.");
  // Offene Lieferungen haben Vorrang (handlungsleitend), sonst rotierende Belohnung
  const tagline = pending > 0 ? lines[0] : lines[variant % lines.length];

  const dateStr = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });

  const sunPath = "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z";
  const moonPath = "M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z";

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl reveal"
      style={{ border: "1px solid var(--border)", background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0))" }}>
      {/* warme Tageszeit-Lichter */}
      <div className="pointer-events-none absolute -top-20 -left-12 h-64 w-96 rounded-full soft-glow"
        style={{ background: `radial-gradient(circle, ${c1}33, transparent 70%)` }} />
      <div className="pointer-events-none absolute -bottom-24 right-8 h-56 w-80 rounded-full"
        style={{ background: `radial-gradient(circle, ${c2}22, transparent 70%)` }} />

      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="kpi-icon flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: `${c1}1f`, color: c1, boxShadow: `0 0 28px ${c1}40` }}>
              <svg className="h-6 w-6 animate-float" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={isNight ? moonPath : sunPath} />
              </svg>
            </div>
            {mounted && streak >= 2 && (
              <span className="badge animate-fade-in"
                style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.22)" }}>
                🔥 {streak} Tage in Folge
              </span>
            )}
          </div>

          <h1 className="mt-4 text-[28px] sm:text-[34px] font-semibold tracking-tight leading-[1.1]">
            <span style={{ background: `linear-gradient(120deg, ${c1}, ${c2})`, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {mounted ? greeting : "Willkommen zurück"}{firstName ? `, ${firstName}` : ""}
            </span>
            <span className="text-white">.</span>
          </h1>

          <p className="mt-2.5 max-w-xl text-[13.5px] text-muted">{tagline}</p>
          {mounted && (
            <p className="mt-1 text-[11.5px] capitalize" style={{ color: "var(--text-faint)" }}>{dateStr}</p>
          )}
        </div>

        <button onClick={onNew} className="btn-primary btn-magnetic glow-ring shrink-0 self-start sm:self-auto">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Neue Lieferung
        </button>
      </div>
    </div>
  );
}

// Stil des Plattform-Banners nach Typ (vom Admin gesetzt)
const ANK_STYLE: Record<string, React.CSSProperties> = {
  info:    { background: "rgba(91,108,255,0.1)",  color: "var(--accent)", border: "1px solid rgba(91,108,255,0.3)" },
  warnung: { background: "rgba(245,158,11,0.1)",  color: "#f59e0b",       border: "1px solid rgba(245,158,11,0.3)" },
  wartung: { background: "rgba(239,68,68,0.1)",   color: "var(--red)",    border: "1px solid rgba(239,68,68,0.3)" },
};

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
  const [vorname, setVorname] = useState("");
  const [ankuendigung, setAnkuendigung] = useState<PlattformEinstellungen | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  useEffect(() => { init(); }, []);

  const init = async () => {
    await initUserSettingsIfNeeded();
    await ensureOrganisation();
    const [data, role, standortData, settings, { data: { user } }, ank, feat] = await Promise.all([
      getAllLieferungen(),
      getUserRole(),
      getStandorte(),
      getUserSettings().catch(() => null),
      supabase.auth.getUser(),
      getAktiveAnkuendigung().catch(() => null),
      getMeineFeatures().catch(() => ({})),
    ]);
    setAnkuendigung(ank);
    setFeatures(feat);
    setStandorte(standortData);
    setLieferungen(data || []);
    setUserRole(role);
    setIsAdmin(isSuperAdminEmail(user?.email));
    // Vorname für die persönliche Begrüßung (Settings → user_metadata → E-Mail-Präfix)
    const vn = (settings?.vorname || (user?.user_metadata as any)?.vorname || "").trim();
    setVorname(vn);
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
    try {
      await deleteLieferung(deleteId);
      setLieferungen(prev => prev.filter(l => l.id !== deleteId));
      setDeleteId(null);
    } catch (e: any) {
      alert("Löschen fehlgeschlagen: " + (e?.message || "Unbekannter Fehler"));
    } finally {
      setDeleting(false);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });

  // Wo soll die Bearbeitung fortgesetzt werden? -> nächster offener Schritt
  const getResumeUrl = (l: any) => {
    const d = l.erstellt_am || l.created_at;
    const dateStr = d ? new Date(d).toISOString().split("T")[0] : "";
    const params = `?id=${l.id}${dateStr ? `&date=${dateStr}` : ""}`;
    let step = "pfand";
    if (!l.pfand_items) step = "pfand";
    else if (!l.lieferschein_data) step = "lieferschein";
    else if (!l.abgleich_data) step = "abgleich";
    else if (!l.rechnung_data) step = "rechnung";
    else step = "freigabe";
    return `/lieferung/${step}${params}`;
  };

  const MINUTEN_PRO_LIEFERUNG = 15; // gesparte Prüfzeit je durchgecheckter Lieferung

  const stats = (() => {
    const done = lieferungen.filter(l => l.ersparnis_eur != null);
    const total = done.reduce((s, l) => s + (l.ersparnis_eur || 0), 0);
    // "durchgecheckt" = vollständig geprüfte / freigegebene Lieferung
    const checked = lieferungen.filter(
      l => l.ersparnis_eur != null || l.freigabe_erteilt || l.status === "abgeschlossen"
    ).length;
    const zeitMin = checked * MINUTEN_PRO_LIEFERUNG;
    const mitAb = lieferungen.filter(l => l.abgleich_data?.abgleich?.some((a: any) => a.status !== "ok")).length;
    return { total, count: lieferungen.length, checked, zeitMin, mitAb };
  })();

  // Zeit hübsch formatieren: < 60 Min -> "X Min", sonst "Y,Z Std"
  const zeitWert = stats.zeitMin >= 60 ? stats.zeitMin / 60 : stats.zeitMin;
  const zeitSuffix = stats.zeitMin >= 60 ? " Std" : " Min";
  const zeitDecimals = stats.zeitMin >= 60 ? 1 : 0;

  const filtered = getFiltered();
  const activeFilters = (filter.status !== "alle" ? 1 : 0) + (filter.datum !== "alle" ? 1 : 0) + (filter.abweichungen !== "alle" ? 1 : 0);

  // Feature-Flags (vom Admin gesteuert): ein Eintrag erscheint, solange er nicht
  // explizit auf false gesetzt ist (Default = an).
  const navItems = [
    ...(features.analytics !== false ? [{ label: "Analyse", path: "/analytics" }] : []),
    { label: "Lieferanten", path: "/lieferanten" },
    ...(features.standorte !== false ? [{ label: "Standorte", path: "/standorte" }] : []),
    ...(features.team !== false ? [{ label: "Team", path: "/team" }] : []),
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

          {/* Plattform-Ankündigung (vom Admin gesteuert) */}
          {ankuendigung?.ankuendigung_text && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] reveal" style={ANK_STYLE[ankuendigung.ankuendigung_typ || "info"]}>
              <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              <span>{ankuendigung.ankuendigung_text}</span>
            </div>
          )}

          {/* Persönliche Begrüßung */}
          <GreetingHero
            vorname={vorname}
            stats={stats}
            pending={lieferungen.filter((l: any) => !l.freigabe_erteilt).length}
            onNew={() => router.push("/lieferung/neu")}
          />

          {/* KPI Cards — kompakt, Lieferungen stehen im Fokus */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
            {[
              {
                label: "Lieferungen gesamt",
                value: stats.count, decimals: 0,
                sub: stats.count === 1 ? "geprüfte Lieferung" : "geprüfte Lieferungen",
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9.75 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />,
              },
              {
                label: "Zeit gespart",
                value: zeitWert, decimals: zeitDecimals, suffix: zeitSuffix,
                sub: `${MINUTEN_PRO_LIEFERUNG} Min pro Prüfung`,
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
              },
              {
                label: "Abweichungen erkannt",
                value: stats.mitAb, decimals: 0,
                sub: stats.mitAb === 1 ? "Lieferung korrigiert" : "Lieferungen korrigiert",
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />,
              },
            ].map((s, i) => (
              <SpotlightCard key={s.label}
                className="group relative overflow-hidden rounded-xl p-4 reveal hover-lift"
                style={{
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-inset)",
                  animationDelay: `${i * 0.07}s`,
                }}>
                <div className="kpi-accent absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: "linear-gradient(90deg, var(--green), rgba(16,185,129,0))", animationDelay: `${0.18 + i * 0.07}s` }} />

                <div className="flex items-center justify-between mb-3">
                  <div className="kpi-icon flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: "var(--green-muted)", color: "var(--green)", animationDelay: `${0.12 + i * 0.07}s` }}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">{s.icon}</svg>
                  </div>
                  <span className="status-dot" style={{ color: "var(--green)", background: "var(--green)" }} />
                </div>

                <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{s.label}</p>
                <p className="mt-1 text-[22px] font-semibold tracking-tight leading-none tabular-nums" style={{ color: "var(--green)" }}>
                  <AnimatedNumber value={s.value} prefix={s.prefix || ""} suffix={s.suffix || ""} decimals={s.decimals} ready={!loading} />
                </p>
                <p className="mt-1.5 text-[11px] text-muted">{s.sub}</p>
              </SpotlightCard>
            ))}
          </div>

          {/* Ersparnis-Verlauf — füllt die Breite, interaktiv */}
          <SavingsTrend lieferungen={lieferungen} ready={!loading} />

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-6 reveal" style={{ animationDelay: "0.3s" }}>
            <div className="relative flex-1">
              <svg className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Lieferanten, Rechnungsnummer, Notiz ..."
                className="input !pl-9"
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

                      <div className="flex items-center gap-1">
                        {!l.freigabe_erteilt && (
                          <button
                            onClick={e => { e.stopPropagation(); router.push(getResumeUrl(l)); }}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11.5px] font-medium text-white transition-colors hover:border-accent/50 hover:text-accent">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 0 1 0 1.971l-11.54 6.347a1.125 1.125 0 0 1-1.667-.985V5.653Z" />
                            </svg>
                            Fortsetzen
                          </button>
                        )}
                        {userRole === "chef" && (
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteId(l.id); }}
                            aria-label="Lieferung löschen"
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 rounded p-2 -m-0.5 text-muted hover:text-red-400 hover:bg-red-500/10 transition-all">
                            <svg className="h-4 w-4 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
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
