"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "../../lib/adminClient";
import { SpotlightCard } from "../components/SpotlightCard";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { TrendChart, TrendPoint } from "../components/TrendChart";
import { AdminRequestsQueue } from "../components/AdminRequestsQueue";

type Overview = {
  kpis: {
    kundenGesamt: number;
    kundenAktiv30: number;
    nutzerGesamt: number;
    lieferungenGesamt: number;
    lieferungenWoche: number;
    gesamtErsparnis: number;
    offeneAnfragen: number;
  };
  kundenVerlauf: TrendPoint[];
  lieferungenVerlauf: TrendPoint[];
  feed: { id: string; erstellt_am: string; user_email?: string; aktion: string; entity_type: string; details?: any }[];
  achtung: { orgId: string; name: string; grund: string }[];
};

// audit_log-Aktionen lesbar machen
const AKTION_LABEL: Record<string, string> = {
  chef_angelegt: "Chef angelegt",
  freigabe: "Lieferung freigegeben",
  org_gesperrt: "Kunde gesperrt",
  org_entsperrt: "Kunde entsperrt",
  org_geloescht: "Kunde gelöscht",
  org_aktualisiert: "Kunde bearbeitet",
  passwort_zurueckgesetzt: "Passwort zurückgesetzt",
  impersonation: "Als Kunde eingeloggt",
  standort_angelegt: "Standort angelegt",
  ankuendigung_aktualisiert: "Ankündigung geändert",
};

function aktionLabel(a: string) {
  return AKTION_LABEL[a] || a.replace(/_/g, " ");
}

function grundFarbe(grund: string) {
  if (grund === "gesperrt") return { bg: "var(--red-muted)", fg: "var(--red)" };
  if (grund.includes("inaktiv")) return { bg: "rgba(245,158,11,0.12)", fg: "#f59e0b" };
  return { bg: "var(--surface)", fg: "var(--text-muted)" };
}

export default function AdminUebersichtPage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      setData(await adminFetch<Overview>("/api/admin/overview"));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const k = data?.kpis;

  const kpiCards = [
    { label: "Kunden gesamt", value: k?.kundenGesamt ?? 0, sub: `${k?.kundenAktiv30 ?? 0} aktiv (30 T)` },
    { label: "Nutzer gesamt", value: k?.nutzerGesamt ?? 0, sub: "über alle Betriebe" },
    { label: "Lieferungen geprüft", value: k?.lieferungenGesamt ?? 0, sub: `${k?.lieferungenWoche ?? 0} diese Woche` },
  ];

  return (
    <>
      <div className="mb-8 reveal">
        <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-white">Übersicht</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">Dein Plattform-Cockpit – Kunden, Aktivität und Wachstum auf einen Blick.</p>
      </div>

      {err && (
        <div className="mb-6 rounded-lg p-4 text-sm" style={{ background: "var(--red-muted)", color: "var(--red)" }}>
          {err}
        </div>
      )}

      {/* Offene Mitarbeiter-Anfragen (zeigt sich nur, wenn welche offen sind) */}
      <AdminRequestsQueue onChange={load} />

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6">
        {kpiCards.map((s, i) => (
          <SpotlightCard
            key={s.label}
            className="relative overflow-hidden rounded-xl p-4 reveal hover-lift"
            style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-inset)", animationDelay: `${i * 0.07}s` }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{s.label}</p>
            <p className="mt-1.5 text-[24px] font-semibold tracking-tight leading-none tabular-nums text-white">
              <AnimatedNumber value={s.value} prefix={s.prefix || ""} decimals={s.decimals || 0} ready={!loading} />
            </p>
            <p className="mt-1.5 text-[11px] text-muted">{s.sub}</p>
          </SpotlightCard>
        ))}
      </div>

      {/* Wachstums-Charts */}
      <div className="grid gap-3 lg:grid-cols-2 mb-6">
        {[
          { title: "Kundenwachstum", points: data?.kundenVerlauf || [], color: "var(--accent)", fmt: (n: number) => `${n} Kunden` },
          { title: "Geprüfte Lieferungen", points: data?.lieferungenVerlauf || [], color: "var(--green)", fmt: (n: number) => `${n} Lieferungen` },
        ].map((c) => (
          <div key={c.title} className="rounded-xl p-4 sm:p-5 reveal" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-inset)" }}>
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted mb-4">{c.title}</p>
            {loading ? <div className="skeleton h-[120px] rounded-lg" /> : <TrendChart data={c.points} color={c.color} formatValue={c.fmt} emptyHint="Wächst, sobald mehr Daten da sind." />}
          </div>
        ))}
      </div>

      {/* Aktivität + Aufmerksamkeit */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Aktivitäts-Feed */}
        <div className="lg:col-span-2 rounded-xl p-4 sm:p-5 reveal" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-inset)" }}>
          <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted mb-4">Letzte Aktivität</p>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
          ) : (data?.feed.length ?? 0) === 0 ? (
            <p className="text-[12.5px] text-muted py-6 text-center">Noch keine Ereignisse.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data!.feed.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-white truncate">{aktionLabel(f.aktion)}</p>
                    <p className="text-[11px] text-muted truncate">{f.user_email || "System"}</p>
                  </div>
                  <span className="shrink-0 text-[10.5px] text-muted tabular-nums">
                    {new Date(f.erstellt_am).toLocaleDateString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Aufmerksamkeit nötig */}
        <div className="rounded-xl p-4 sm:p-5 reveal" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-inset)" }}>
          <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted mb-4">Aufmerksamkeit nötig</p>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
          ) : (data?.achtung.length ?? 0) === 0 ? (
            <p className="text-[12.5px] text-muted py-6 text-center">Alles im grünen Bereich. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {data!.achtung.map((a) => {
                const c = grundFarbe(a.grund);
                return (
                  <li key={a.orgId}>
                    <button onClick={() => router.push(`/admin/kunden/${a.orgId}`)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface">
                      <span className="text-[12.5px] font-medium text-white truncate">{a.name}</span>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: c.bg, color: c.fg }}>{a.grund}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
