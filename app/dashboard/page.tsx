"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import LogoutButton from "../components/LogoutButton";
import { getAllLieferungen } from "../../lib/database";

export default function DashboardPage() {
  const router = useRouter();
  const [lieferungen, setLieferungen] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLieferungen();
    requestNotificationPermission();
    checkLieferTagNotification();
  }, []);

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  const checkLieferTagNotification = () => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();

    if ((day === 2 || day === 5) && hour === 7) {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Heute ist Liefertag", {
          body: "Pfand bereitstellen nicht vergessen",
          icon: "/icon-192.png",
        });
      }
    }
  };

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

  const getLieferungStatus = (lieferung: any) => {
    if (lieferung.lieferschein_data) {
      return { status: "Abgeschlossen", color: "green" };
    }
    if (lieferung.pfand_items) {
      return { status: "In Bearbeitung", color: "yellow", step: "Schritt 1" };
    }
    return { status: "Neu", color: "gray", step: "Schritt 0" };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

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
                    d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9.75 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
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
            Dashboard
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
            Willkommen bei LieferCheck Pro
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Hier verwalten Sie Ihre Lieferungen und behalten den Überblick über
            eingehende Waren – schnell, übersichtlich und zuverlässig.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="/lieferung/neu"
              className="inline-flex items-center gap-3 rounded-xl bg-accent px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Neue Lieferung prüfen
            </a>
            <a
              href="/analytics"
              className="inline-flex items-center gap-3 rounded-xl border border-border bg-surface-elevated px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-surface-elevated"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                />
              </svg>
              Analyse-Dashboard
            </a>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {(() => {
              const now = new Date();
              const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              
              const completedLieferungen = lieferungen.filter(l => l.ersparnis_eur !== null && l.ersparnis_eur !== undefined);
              const weekLieferungen = completedLieferungen.filter(l => {
                const createdAt = new Date(l.created_at || l.erstellt_am);
                return createdAt >= sevenDaysAgo;
              });
              
              const totalErsparnis = completedLieferungen.reduce((sum, l) => sum + (l.ersparnis_eur || 0), 0);
              const weekErsparnis = weekLieferungen.reduce((sum, l) => sum + (l.ersparnis_eur || 0), 0);
              const avgErsparnis = completedLieferungen.length > 0 ? totalErsparnis / completedLieferungen.length : 0;

              return [
                { 
                  label: "Diese Woche gespart", 
                  value: `${weekErsparnis.toFixed(2)} €`,
                  color: "text-green-400"
                },
                { 
                  label: "Gesamt gespart", 
                  value: `${totalErsparnis.toFixed(2)} €`,
                  color: "text-green-400"
                },
                { 
                  label: "Ø pro Lieferung", 
                  value: `${avgErsparnis.toFixed(2)} €`,
                  color: "text-green-400"
                },
              ];
            })().map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-surface-elevated p-6"
              >
                <p className="text-sm text-muted">{stat.label}</p>
                <p className={`mt-2 text-2xl font-semibold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="text-xl font-semibold text-white">Vergangene Lieferungen</h2>
            <p className="mt-2 text-sm text-muted">
              Übersicht aller bisherigen Lieferungen
            </p>

            {loading ? (
              <div className="mt-6 text-center text-muted">Laden...</div>
            ) : lieferungen.length === 0 ? (
              <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-8 text-center">
                <p className="text-muted">Noch keine Lieferungen vorhanden</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {lieferungen.map((lieferung) => {
                  const status = getLieferungStatus(lieferung);
                  return (
                    <div
                      key={lieferung.id}
                      onClick={() => router.push(`/lieferung/detail?id=${lieferung.id}`)}
                      className="rounded-xl border border-border bg-surface-elevated p-6 transition-colors hover:border-accent/50 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-muted">
                            {formatDate(lieferung.erstellt_am)}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">
                            Lieferung #{lieferung.id?.slice(0, 8)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                            status.color === "green"
                              ? "bg-green-500/20 text-green-400"
                              : status.color === "yellow"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {status.status}
                        </span>
                      </div>
                      {status.step && (
                        <p className="mt-3 text-sm text-muted">{status.step}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
