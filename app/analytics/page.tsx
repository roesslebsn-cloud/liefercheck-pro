"use client";

import { useState, useEffect } from "react";
import AuthGuard from "../components/AuthGuard";
import LogoutButton from "../components/LogoutButton";
import { getAllLieferungen } from "../../lib/database";

export default function AnalyticsPage() {
  const [lieferungen, setLieferungen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLieferungen();
  }, []);

  const loadLieferungen = async () => {
    try {
      const data = await getAllLieferungen();
      setLieferungen(data || []);
    } catch (error) {
      console.error("Fehler beim Laden der Lieferungen:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLast30DaysLieferungen = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return lieferungen.filter((l) => new Date(l.created_at) >= thirtyDaysAgo);
  };

  const getAbweichungsStatistik = () => {
    const abweichungen: { [key: string]: number } = {};
    lieferungen.forEach((lieferung) => {
      if (lieferung.lieferschein_data?.pfand_eintrage) {
        lieferung.lieferschein_data.pfand_eintrage.forEach((eintrag: any) => {
          if (eintrag.hasDifference) {
            const artikel = eintrag.artikel;
            abweichungen[artikel] = (abweichungen[artikel] || 0) + 1;
          }
        });
      }
    });
    return Object.entries(abweichungen)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  };

  const getGelieferteStatistik = () => {
    const statistik: { [key: string]: number } = {};
    lieferungen.forEach((lieferung) => {
      if (lieferung.lieferschein_data?.gelieferte_artikel) {
        lieferung.lieferschein_data.gelieferte_artikel.forEach((artikel: any) => {
          statistik[artikel.artikel] = (statistik[artikel.artikel] || 0) + artikel.menge;
        });
      }
    });
    return Object.entries(statistik)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const last30Days = getLast30DaysLieferungen();
  const abweichungen = getAbweichungsStatistik();
  const gelieferte = getGelieferteStatistik();
  const maxValue = Math.max(...gelieferte.map(([, value]) => value), 1);

  return (
    <AuthGuard>
      <div className="flex min-h-full flex-col">
        <header className="border-b border-border bg-surface-elevated">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted ring-1 ring-accent/30">
                <svg
                  className="h-5 w-5 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                  />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">
                LieferCheck Pro
              </span>
            </div>

            <LogoutButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-muted/50 px-3 py-1 text-xs font-medium text-accent ring-1 ring-accent/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Analyse-Dashboard
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
            Lieferungs-Analyse
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Übersicht über Bestellungen und Lieferungen der letzten 30 Tage
          </p>

          {loading ? (
            <div className="mt-10 text-center text-muted">Laden...</div>
          ) : (
            <div className="mt-10 space-y-10">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface-elevated p-6">
                  <p className="text-sm text-muted">Lieferungen (30 Tage)</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {last30Days.length}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-elevated p-6">
                  <p className="text-sm text-muted">Abgeschlossen</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {last30Days.filter((l) => l.lieferschein_data).length}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-elevated p-6">
                  <p className="text-sm text-muted">In Bearbeitung</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {last30Days.filter((l) => !l.lieferschein_data).length}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-elevated p-6">
                <h2 className="text-lg font-semibold text-white">
                  Meistgelieferte Artikel (30 Tage)
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Top 10 Artikel nach Menge
                </p>
                <div className="mt-6 space-y-4">
                  {gelieferte.length === 0 ? (
                    <p className="text-muted">Keine Daten verfügbar</p>
                  ) : (
                    gelieferte.map(([artikel, menge], index) => (
                      <div key={index}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white">{artikel}</span>
                          <span className="text-muted">{menge}x</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-surface">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${(menge / maxValue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-elevated p-6">
                <h2 className="text-lg font-semibold text-white">
                  Abweichungs-Statistik
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Artikel mit häufigsten Abweichungen
                </p>
                <div className="mt-6 space-y-4">
                  {abweichungen.length === 0 ? (
                    <p className="text-muted">Keine Abweichungen erfasst</p>
                  ) : (
                    abweichungen.map(([artikel, anzahl], index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-white">{artikel}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-400">
                          {anzahl}x Abweichung
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-elevated p-6">
                <h2 className="text-lg font-semibold text-white">
                  Letzte Lieferungen
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Übersicht der letzten 10 Lieferungen
                </p>
                <div className="mt-6 space-y-3">
                  {last30Days.slice(0, 10).map((lieferung) => (
                    <div
                      key={lieferung.id}
                      className="flex items-center justify-between rounded-lg bg-surface p-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">
                          Lieferung #{lieferung.id?.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(lieferung.created_at)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                          lieferung.lieferschein_data
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {lieferung.lieferschein_data
                          ? "Abgeschlossen"
                          : "In Bearbeitung"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-10">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-white"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
              Zurück zum Dashboard
            </a>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
