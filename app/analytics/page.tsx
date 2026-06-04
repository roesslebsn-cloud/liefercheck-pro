"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import AppHeader from "../components/AppHeader";
import { getAllLieferungen } from "../../lib/database";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";

type Zeitraum = "30" | "90" | "365";

export default function AnalyticsPage() {
  const router = useRouter();
  const [lieferungen, setLieferungen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zeitraum, setZeitraum] = useState<Zeitraum>("30");

  useEffect(() => {
    getAllLieferungen()
      .then(data => setLieferungen(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const gefilterteListening = lieferungen.filter(l => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(zeitraum));
    return new Date(l.erstellt_am || l.created_at) >= cutoff;
  });

  // KPI-Werte
  const totalErsparnis = gefilterteListening.reduce((sum, l) => sum + (l.ersparnis_eur || 0), 0);
  const abgeschlossen = gefilterteListening.filter(l => l.status === "abgeschlossen").length;
  const mitAbweichung = gefilterteListening.filter(l => {
    const abgleich = l.abgleich_data?.abgleich || [];
    return abgleich.some((a: any) => a.status !== "ok");
  }).length;
  const abweichungsQuote = gefilterteListening.length > 0
    ? Math.round((mitAbweichung / gefilterteListening.length) * 100)
    : 0;

  // Linienchart: Ersparnis pro Lieferung (chronologisch)
  const ersparnisChartData = [...gefilterteListening]
    .filter(l => l.ersparnis_eur != null)
    .sort((a, b) => new Date(a.erstellt_am || a.created_at).getTime() - new Date(b.erstellt_am || b.created_at).getTime())
    .map(l => ({
      datum: new Date(l.erstellt_am || l.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
      ersparnis: parseFloat((l.ersparnis_eur || 0).toFixed(2)),
    }));

  // Balkendiagramm: Abweichungen nach Artikel
  const abweichungsMap: Record<string, number> = {};
  gefilterteListening.forEach(l => {
    (l.abgleich_data?.abgleich || []).forEach((item: any) => {
      if (item.status !== "ok") {
        abweichungsMap[item.artikel] = (abweichungsMap[item.artikel] || 0) + 1;
      }
    });
  });
  const abweichungsChartData = Object.entries(abweichungsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([artikel, count]) => ({ artikel: artikel.length > 18 ? artikel.slice(0, 18) + "…" : artikel, count }));

  const ACCENT = "#3b82f6";
  const ORANGE = "#f97316";

  const CustomTooltipErsparnis = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-white/10 bg-[#0f1117] px-4 py-3 shadow-xl">
          <p className="text-xs text-white/50 mb-1">{label}</p>
          <p className="text-sm font-semibold text-blue-400">€{payload[0].value.toFixed(2)} gespart</p>
        </div>
      );
    }
    return null;
  };

  const CustomTooltipAbweichung = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-white/10 bg-[#0f1117] px-4 py-3 shadow-xl">
          <p className="text-xs text-white/50 mb-1">{label}</p>
          <p className="text-sm font-semibold text-orange-400">{payload[0].value}x Abweichung</p>
        </div>
      );
    }
    return null;
  };

  return (
    <AuthGuard>
      <div className="min-h-screen relative">
        <div className="aurora-bg" />
        <AppHeader />

        <main className="mx-auto w-full max-w-[1200px] px-5 sm:px-8 pt-10 pb-20 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 reveal">
            <div>
              <h1 className="text-[32px] font-semibold tracking-tight gradient-text leading-none">Analyse</h1>
              <p className="mt-2.5 text-[13.5px] text-muted">
                {zeitraum === "30" ? "Letzte 30 Tage" : zeitraum === "90" ? "Letzte 90 Tage" : "Letztes Jahr"}
                {" · "}{gefilterteListening.length} Lieferungen
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-md p-1" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
              {(["30", "90", "365"] as Zeitraum[]).map(z => (
                <button key={z} onClick={() => setZeitraum(z)}
                  className="rounded px-3 py-1.5 text-[12px] font-medium transition-all"
                  style={{
                    background: zeitraum === z ? "var(--accent)" : "transparent",
                    color: zeitraum === z ? "#fff" : "var(--text-muted)",
                  }}>
                  {z === "30" ? "30 Tage" : z === "90" ? "90 Tage" : "1 Jahr"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="mt-32 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : (
            <div className="mt-10 space-y-8">

              {/* KPI-Kacheln */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Gesamt gespart",
                    value: `€${totalErsparnis.toFixed(2)}`,
                    sub: "durch Abweichungserkennung",
                    color: "from-blue-500/20 to-blue-500/5",
                    border: "border-blue-500/20",
                    valueColor: "text-blue-400",
                    icon: (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                      </svg>
                    ),
                  },
                  {
                    label: "Abgeschlossen",
                    value: abgeschlossen,
                    sub: `von ${gefilterteListening.length} gesamt`,
                    color: "from-green-500/20 to-green-500/5",
                    border: "border-green-500/20",
                    valueColor: "text-green-400",
                    icon: (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                    ),
                  },
                  {
                    label: "Mit Abweichung",
                    value: mitAbweichung,
                    sub: `${abweichungsQuote}% Abweichungsquote`,
                    color: "from-orange-500/20 to-orange-500/5",
                    border: "border-orange-500/20",
                    valueColor: "text-orange-400",
                    icon: (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                    ),
                  },
                  {
                    label: "Offene Prüfungen",
                    value: gefilterteListening.filter(l => l.status !== "abgeschlossen").length,
                    sub: "noch nicht freigegeben",
                    color: "from-purple-500/20 to-purple-500/5",
                    border: "border-purple-500/20",
                    valueColor: "text-purple-400",
                    icon: (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                    ),
                  },
                ].map((kpi, i) => (
                  <div key={i}
                    className="spotlight-card spotlight-border relative overflow-hidden rounded-lg p-5 hover-lift reveal"
                    style={{
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      boxShadow: "var(--shadow-inset)",
                      animationDelay: `${i * 0.08}s`,
                    }}>
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted">{kpi.label}</p>
                      <div className={`${kpi.valueColor}`}>{kpi.icon}</div>
                    </div>
                    <p className={`text-[30px] font-semibold tracking-tight leading-none tabular-nums ${kpi.valueColor}`}>{kpi.value}</p>
                    <p className="mt-2.5 text-[11.5px] text-muted">{kpi.sub}</p>
                  </div>
                ))}
              </div>

              {/* Linienchart: Ersparnis */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                <h2 className="text-base font-semibold text-white">Ersparnis pro Lieferung</h2>
                <p className="mt-1 text-xs text-white/40">Erkannte Überzahlungen in Euro</p>
                {ersparnisChartData.length < 2 ? (
                  <div className="mt-10 flex items-center justify-center h-40 text-white/20 text-sm">
                    Noch nicht genug Daten für einen Chart
                  </div>
                ) : (
                  <div className="mt-6 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ersparnisChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="datum" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                        <Tooltip content={<CustomTooltipErsparnis />} />
                        <Line
                          type="monotone"
                          dataKey="ersparnis"
                          stroke={ACCENT}
                          strokeWidth={2.5}
                          dot={{ fill: ACCENT, strokeWidth: 0, r: 4 }}
                          activeDot={{ r: 6, fill: ACCENT }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Balkendiagramm: Top-5 Abweichungen */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                <h2 className="text-base font-semibold text-white">Top-5 Abweichungsartikel</h2>
                <p className="mt-1 text-xs text-white/40">Artikel mit den meisten Abweichungen</p>
                {abweichungsChartData.length === 0 ? (
                  <div className="mt-10 flex items-center justify-center h-40 text-white/20 text-sm">
                    Keine Abweichungen im Zeitraum
                  </div>
                ) : (
                  <div className="mt-6 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={abweichungsChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="artikel" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltipAbweichung />} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                          {abweichungsChartData.map((_, index) => (
                            <Cell key={index} fill={index === 0 ? ORANGE : `rgba(249,115,22,${0.7 - index * 0.1})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Letzte Lieferungen */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                <h2 className="text-base font-semibold text-white">Letzte Lieferungen</h2>
                <div className="mt-4 space-y-2">
                  {gefilterteListening.slice(0, 8).map(l => {
                    const hatAbweichung = (l.abgleich_data?.abgleich || []).some((a: any) => a.status !== "ok");
                    return (
                      <button
                        key={l.id}
                        onClick={() => router.push(`/lieferung/detail?id=${l.id}`)}
                        className="w-full flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3 hover:bg-white/[0.05] hover:border-white/10 transition-all text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">
                            Lieferung #{l.id?.slice(0, 8)}
                          </p>
                          <p className="text-xs text-white/30 mt-0.5">
                            {new Date(l.erstellt_am || l.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {l.ersparnis_eur > 0 && (
                            <span className="text-xs font-medium text-blue-400">€{l.ersparnis_eur.toFixed(2)}</span>
                          )}
                          {hatAbweichung && (
                            <span className="rounded-full bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 text-xs text-orange-400">Abweichung</span>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            l.status === "abgeschlossen"
                              ? "bg-green-500/10 border border-green-500/20 text-green-400"
                              : "bg-white/5 border border-white/10 text-white/40"
                          }`}>
                            {l.status === "abgeschlossen" ? "Abgeschlossen" : "Offen"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {gefilterteListening.length === 0 && (
                    <p className="text-center text-white/20 py-8 text-sm">Keine Lieferungen im gewählten Zeitraum</p>
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
