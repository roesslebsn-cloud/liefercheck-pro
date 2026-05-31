"use client";

import { useState, useEffect } from "react";
import AuthGuard from "../components/AuthGuard";
import { supabase } from "../../lib/supabase";
import { getEingehendeRechnungen, updateEingehendeRechnung, getUserSettings, updateUserSettings } from "../../lib/database";

export default function EinstellungenPage() {
  const [userId, setUserId] = useState<string>("");
  const [forwardingEmail, setForwardingEmail] = useState<string>("");
  const [eingehendeRechnungen, setEingehendeRechnungen] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [wochenBerichtAktiv, setWochenBerichtAktiv] = useState(true);

  useEffect(() => {
    loadUserData();
    loadEingehendeRechnungen();
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      const settings = await getUserSettings();
      if (settings) {
        setWochenBerichtAktiv(settings.wochen_bericht_aktiv !== false);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Benutzereinstellungen:", error);
    }
  };

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Generate forwarding email based on user ID
        const email = `${user.id}@rechnungen.liefercheck.de`;
        setForwardingEmail(email);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Benutzerdaten:", error);
    }
  };

  const loadEingehendeRechnungen = async () => {
    try {
      setLoading(true);
      const data = await getEingehendeRechnungen();
      setEingehendeRechnungen(data || []);
    } catch (error) {
      console.error("Fehler beim Laden der eingehenden Rechnungen:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePruefen = async (rechnung: any) => {
    try {
      // Update status to verarbeitet
      await updateEingehendeRechnung(rechnung.id, { status: "verarbeitet" });

      // Save rechnung data to localStorage for freigabe flow
      if (rechnung.rechnung_data) {
        localStorage.setItem("rechnungData", JSON.stringify(rechnung.rechnung_data));
      }

      // Redirect to freigabe page
      window.location.href = "/lieferung/freigabe";
    } catch (error) {
      console.error("Fehler beim Starten der Prüfung:", error);
    }
  };

  const handleWochenBerichtToggle = async () => {
    try {
      const newValue = !wochenBerichtAktiv;
      setWochenBerichtAktiv(newValue);
      await updateUserSettings({ wochen_bericht_aktiv: newValue });
    } catch (error) {
      console.error("Fehler beim Aktualisieren der Einstellung:", error);
      // Revert on error
      setWochenBerichtAktiv(!wochenBerichtAktiv);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "neu":
        return "bg-blue-500/20 text-blue-400";
      case "verarbeitet":
        return "bg-green-500/20 text-green-400";
      case "fehler":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "neu":
        return "Neu";
      case "verarbeitet":
        return "Verarbeitet";
      case "fehler":
        return "Fehler";
      default:
        return status;
    }
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
                    d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.78-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">
                LieferCheck Pro
              </span>
            </div>
            <a
              href="/dashboard"
              className="text-sm text-muted transition-colors hover:text-white"
            >
              Zurück zum Dashboard
            </a>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Einstellungen
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Verwalten Sie Ihre Einstellungen für LieferCheck Pro.
          </p>

          {/* Email Forwarding Setup */}
          <div className="mt-10 rounded-xl border border-border bg-surface-elevated p-6">
            <h2 className="text-lg font-semibold text-white">
              E-Mail-Weiterleitung einrichten
            </h2>
            <p className="mt-2 text-sm text-muted">
              Richten Sie eine automatische Weiterleitung von Lieferantenrechnungen ein, um diese direkt in LieferCheck Pro zu verarbeiten.
            </p>

            <div className="mt-6 rounded-lg bg-surface p-4">
              <p className="text-xs text-muted mb-2">Ihre Weiterleitungs-E-Mail:</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded border border-border bg-surface-elevated px-4 py-2 text-sm text-accent font-mono">
                  {forwardingEmail || "Wird geladen..."}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(forwardingEmail);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-white transition-colors hover:border-accent/50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                  </svg>
                  Kopieren
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-yellow-400 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-400">Hinweis</p>
                  <p className="mt-1 text-xs text-muted">
                    Richten Sie in Ihrem E-Mail-Client eine Weiterleitung an diese Adresse ein. Rechnungen werden automatisch erkannt und in LieferCheck Pro zur Verfügung gestellt.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Report Settings */}
          <div className="mt-10 rounded-xl border border-border bg-surface-elevated p-6">
            <h2 className="text-lg font-semibold text-white">
              Wöchentlicher Bericht
            </h2>
            <p className="mt-2 text-sm text-muted">
              Erhalten Sie jeden Montag eine Zusammenfassung Ihrer Lieferungen und Ersparnisse per E-Mail.
            </p>

            <div className="mt-6 flex items-center justify-between rounded-lg bg-surface p-4">
              <div>
                <p className="text-sm font-medium text-white">Wöchentlichen Bericht erhalten</p>
                <p className="mt-1 text-xs text-muted">
                  Jeden Montag um 8:00 Uhr
                </p>
              </div>
              <button
                onClick={handleWochenBerichtToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  wochenBerichtAktiv ? "bg-accent" : "bg-surface-elevated"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    wochenBerichtAktiv ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Eingehende Rechnungen */}
          <div className="mt-10 rounded-xl border border-border bg-surface-elevated p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Eingehende Rechnungen
              </h2>
              <button
                onClick={loadEingehendeRechnungen}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-white transition-colors hover:border-accent/50 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Aktualisieren
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="h-8 w-8 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : eingehendeRechnungen.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                <p className="mt-4 text-sm text-muted">
                  Keine eingehenden Rechnungen vorhanden.
                </p>
                <p className="mt-1 text-xs text-muted">
                  Richten Sie die E-Mail-Weiterleitung ein, um Rechnungen automatisch zu empfangen.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {eingehendeRechnungen.map((rechnung) => (
                  <div
                    key={rechnung.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(rechnung.status)}`}>
                          {getStatusText(rechnung.status)}
                        </span>
                        <p className="text-sm font-medium text-white truncate">
                          {rechnung.betreff}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted">
                        <span>Absender: {rechnung.absender}</span>
                        <span>Anhang: {rechnung.anhang_name}</span>
                        <span>Empfangen: {formatDate(rechnung.empfangen_am)}</span>
                      </div>
                    </div>
                    {rechnung.status === "neu" && rechnung.rechnung_data && (
                      <button
                        onClick={() => handlePruefen(rechnung)}
                        className="ml-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        Jetzt prüfen
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
