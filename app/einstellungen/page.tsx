"use client";
import { usePushNotifications } from "../../lib/usePushNotifications";

import { useState, useEffect } from "react";
import AuthGuard from "../components/AuthGuard";
import AppHeader from "../components/AppHeader";
import { supabase } from "../../lib/supabase";
import { getEingehendeRechnungen, updateEingehendeRechnung, getUserSettings, updateUserSettings, updateMyVorname, getAllLieferungen, updateLieferung, getLieferanten, berechnePreisabweichungen, findLieferantByName, speicherPreisHistorie } from "../../lib/database";

export default function EinstellungenPage() {
  const [userId, setUserId] = useState<string>("");
  const [forwardingEmail, setForwardingEmail] = useState<string>("");
  const [eingehendeRechnungen, setEingehendeRechnungen] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [zuordnenRechnung, setZuordnenRechnung] = useState<any>(null);
  const [offeneLieferungen, setOffeneLieferungen] = useState<any[]>([]);
  const [selectedLieferungId, setSelectedLieferungId] = useState<string>("");
  const [zuordnenLoading, setZuordnenLoading] = useState(false);
  const [wochenBerichtAktiv, setWochenBerichtAktiv] = useState(true);
  const [vorname, setVorname] = useState("");
  const [vornameSaved, setVornameSaved] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { supported: pushSupported, subscribed: pushSubscribed, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications();

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
        setVorname(settings.vorname || "");
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
      const alle = await getAllLieferungen();
      const offen = alle.filter((l: any) => l.status !== "abgeschlossen");
      setOffeneLieferungen(offen);
      setSelectedLieferungId(offen[0]?.id || "__neu__");
      setZuordnenRechnung(rechnung);
    } catch (error) {
      console.error("Fehler beim Laden der Lieferungen:", error);
    }
  };

  const handleZuordnen = async () => {
    if (!zuordnenRechnung) return;
    setZuordnenLoading(true);
    try {
      await updateEingehendeRechnung(zuordnenRechnung.id, { status: "verarbeitet" });

      if (selectedLieferungId && selectedLieferungId !== "__neu__") {
        if (zuordnenRechnung.rechnung_data) {
          const data = zuordnenRechnung.rechnung_data;
          // Preisabgleich gegen Lieferanten-Preisliste durchführen
          let rechnungDataMitAbweichungen = data;
          try {
            const lieferanten = await getLieferanten();
            const abweichungen = berechnePreisabweichungen(data.positionen, lieferanten, data.lieferant);
            rechnungDataMitAbweichungen = { ...data, preisabweichungen: abweichungen };

            // Preishistorie befüllen (best-effort)
            if (data.positionen?.length > 0 && data.lieferant) {
              findLieferantByName(data.lieferant).then(l => {
                if (l?.id) speicherPreisHistorie(l.id, data.positionen, data.datum || null, selectedLieferungId).catch(() => {});
              }).catch(() => {});
            }
          } catch {
            // Preisabgleich optional – bei Fehler ohne Abweichungen speichern
          }
          await updateLieferung(selectedLieferungId, { rechnung_data: rechnungDataMitAbweichungen });
        }
        const lieferung = offeneLieferungen.find(l => l.id === selectedLieferungId);
        const dateParam = lieferung?.erstellt_am ? `&date=${lieferung.erstellt_am.split("T")[0]}` : "";
        window.location.href = `/lieferung/freigabe?id=${selectedLieferungId}${dateParam}`;
      } else {
        window.location.href = "/lieferung/neu";
      }
    } catch (error) {
      console.error("Fehler beim Zuordnen:", error);
    } finally {
      setZuordnenLoading(false);
      setZuordnenRechnung(null);
    }
  };

  const handlePasswortChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 8) { setPwMsg({ ok: false, text: "Mind. 8 Zeichen" }); return; }
    if (newPw !== newPw2) { setPwMsg({ ok: false, text: "Passwörter stimmen nicht überein" }); return; }
    setPwSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/passwort-aendern", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ neues_passwort: newPw }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler");
      setPwMsg({ ok: true, text: "Passwort erfolgreich geändert" });
      setNewPw(""); setNewPw2("");
    } catch (err: any) {
      setPwMsg({ ok: false, text: err.message });
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleVornameSave = async () => {
    try {
      await updateMyVorname(vorname.trim());
      setVornameSaved(true);
      setTimeout(() => setVornameSaved(false), 2000);
    } catch (error) {
      console.error("Fehler beim Speichern des Vornamens:", error);
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
      <div className="min-h-screen relative">
        <div className="aurora-bg" />
        <AppHeader />

        <main className="mx-auto w-full max-w-[1000px] px-5 sm:px-8 pt-10 pb-20 relative">
          <div className="mb-10 reveal">
            <h1 className="text-[32px] font-semibold tracking-tight gradient-text leading-none">
              Einstellungen
            </h1>
            <p className="mt-2.5 max-w-xl text-[13.5px] text-muted">
              Verwalten Sie Ihre Einstellungen für LieferCheck Pro.
            </p>
          </div>

          {/* Profil */}
          <div className="mt-10 spotlight-card spotlight-border rounded-xl border border-border bg-surface-elevated p-6 reveal">
            <h2 className="text-lg font-semibold text-white">Profil</h2>
            <p className="mt-2 text-sm text-muted">
              Dein Vorname wird deinen Team-Kollegen angezeigt. Die E-Mail-Adresse bleibt verdeckt.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={vorname}
                onChange={(e) => setVorname(e.target.value)}
                placeholder="Dein Vorname"
                className="input flex-1"
              />
              <button
                onClick={handleVornameSave}
                className="btn-primary"
              >
                {vornameSaved ? "Gespeichert ✓" : "Speichern"}
              </button>
            </div>
          </div>

          {/* Passwort ändern */}
          <div id="passwort" className="mt-10 spotlight-card spotlight-border rounded-xl border border-border bg-surface-elevated p-6 reveal">
            <h2 className="text-lg font-semibold text-white">Passwort ändern</h2>
            <p className="mt-2 text-sm text-muted">Setze ein neues Passwort. Wirksam beim nächsten Login.</p>
            <form onSubmit={handlePasswortChange} className="mt-6 space-y-3 max-w-md">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Neues Passwort (min. 8 Zeichen)</label>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} className="input" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Wiederholen</label>
                <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} minLength={8} className="input" required />
              </div>
              <button type="submit" disabled={pwSubmitting} className="btn-primary">
                {pwSubmitting ? "Wird gespeichert..." : "Passwort ändern"}
              </button>
              {pwMsg && (
                <div className={`rounded-md p-3 text-sm ${pwMsg.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {pwMsg.text}
                </div>
              )}
            </form>
          </div>

          {/* Email Forwarding Setup */}
          <div className="mt-10 spotlight-card spotlight-border rounded-xl border border-border bg-surface-elevated p-6 reveal">
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
          <div className="mt-10 spotlight-card spotlight-border rounded-xl border border-border bg-surface-elevated p-6 reveal">
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

          {/* Push-Benachrichtigungen */}
          {pushSupported && (
          <div className="mt-8 spotlight-card spotlight-border rounded-xl border border-border bg-surface-elevated p-6 reveal">
            <h2 className="text-lg font-semibold text-white">Push-Benachrichtigungen</h2>
            <p className="mt-2 text-sm text-muted">
              Erhalten Sie Browser-Benachrichtigungen bei neuen Lieferungen und erkannten Abweichungen.
            </p>
            <div className="mt-6 flex items-center justify-between rounded-lg bg-surface p-4">
              <div>
                <p className="text-sm font-medium text-white">Benachrichtigungen aktivieren</p>
                <p className="mt-1 text-xs text-muted">{pushSubscribed ? "Aktiv – Sie erhalten Benachrichtigungen" : "Deaktiviert"}</p>
              </div>
              <button
                onClick={() => pushSubscribed ? pushUnsubscribe() : pushSubscribe()}
                disabled={pushLoading}
                className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 " + (pushSubscribed ? "bg-accent" : "bg-surface-elevated")}
              >
                <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform " + (pushSubscribed ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>
          </div>
          )}

          {/* Eingehende Rechnungen */}
          <div className="mt-10 spotlight-card spotlight-border rounded-xl border border-border bg-surface-elevated p-6 reveal">
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

      {/* Zuordnungs-Modal */}
      {zuordnenRechnung && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-elevated shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Rechnung zuordnen</h2>
                <p className="text-xs text-muted mt-0.5">{zuordnenRechnung.betreff}</p>
              </div>
              <button onClick={() => setZuordnenRechnung(null)} className="text-muted hover:text-white transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {zuordnenRechnung.rechnung_data && (
                <div className="rounded-lg bg-surface p-4 grid grid-cols-2 gap-2 text-sm">
                  {zuordnenRechnung.rechnung_data.lieferant && (
                    <div><p className="text-xs text-muted">Lieferant</p><p className="text-white">{zuordnenRechnung.rechnung_data.lieferant}</p></div>
                  )}
                  {zuordnenRechnung.rechnung_data.rechnungs_nummer && (
                    <div><p className="text-xs text-muted">Rechnungsnr.</p><p className="text-white">{zuordnenRechnung.rechnung_data.rechnungs_nummer}</p></div>
                  )}
                  {zuordnenRechnung.rechnung_data.brutto && (
                    <div><p className="text-xs text-muted">Brutto</p><p className="text-white">€{parseFloat(zuordnenRechnung.rechnung_data.brutto).toFixed(2)}</p></div>
                  )}
                  {zuordnenRechnung.rechnung_data.datum && (
                    <div><p className="text-xs text-muted">Datum</p><p className="text-white">{zuordnenRechnung.rechnung_data.datum}</p></div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted mb-2">Welcher Lieferung zuordnen?</label>
                <select
                  value={selectedLieferungId}
                  onChange={(e) => setSelectedLieferungId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                >
                  {offeneLieferungen.length === 0 && (
                    <option value="__neu__">Neue Lieferung starten</option>
                  )}
                  {offeneLieferungen.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {new Date(l.erstellt_am || l.created_at).toLocaleDateString("de-DE")} – {l.rechnung_data?.lieferant || `#${l.id?.slice(0,8)}`}
                    </option>
                  ))}
                  <option value="__neu__">Neue Lieferung starten</option>
                </select>
                <p className="mt-1.5 text-xs text-muted">
                  {offeneLieferungen.length === 0
                    ? "Keine offenen Lieferungen – es wird eine neue gestartet."
                    : `${offeneLieferungen.length} offene Lieferung(en) gefunden.`}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button onClick={() => setZuordnenRechnung(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-white transition-colors">
                Abbrechen
              </button>
              <button onClick={handleZuordnen} disabled={zuordnenLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors">
                {zuordnenLoading ? "Zuordne..." : selectedLieferungId === "__neu__" ? "Neue Lieferung starten" : "Rechnung zuordnen & prüfen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
