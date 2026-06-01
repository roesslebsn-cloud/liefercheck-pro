"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import { getLieferungById } from "../../../lib/database";
import { normalizeArtikelKey } from "../../../lib/database";

export default function LieferungDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [lieferung, setLieferung] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) loadLieferung(id);
  }, [id]);

  const loadLieferung = async (lieferungId: string) => {
    try {
      const data = await getLieferungById(lieferungId);
      setLieferung(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  };

  // Preisabweichungen berechnen
  const getPreisabweichungen = () => {
    const rechnung = lieferung?.rechnung_data;
    const lieferschein = lieferung?.lieferschein_data;
    if (!rechnung?.positionen || !lieferschein?.gelieferte_artikel) return [];

    return rechnung.positionen
      .map((pos: any) => {
        const rKey = normalizeArtikelKey(pos.artikel);
        const lPos = lieferschein.gelieferte_artikel.find(
          (l: any) => normalizeArtikelKey(l.artikel) === rKey
        );
        if (!lPos) return null;
        const rechnungPreis = pos.einzelpreis ?? pos.preis ?? 0;
        const lieferscheinPreis = lPos.einzelpreis ?? lPos.preis ?? 0;
        if (lieferscheinPreis > 0 && Math.abs(rechnungPreis - lieferscheinPreis) > 0.01) {
          return {
            artikel: pos.artikel,
            altPreis: lieferscheinPreis,
            neuPreis: rechnungPreis,
            differenz: rechnungPreis - lieferscheinPreis,
            menge: pos.menge ?? lPos.menge ?? 1,
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  const exportPreislisteCSV = () => {
    const abweichungen = getPreisabweichungen();
    if (abweichungen.length === 0) return;
    const header = "Artikel;Alter Preis (€);Neuer Preis (€);Differenz (€);Menge";
    const rows = abweichungen.map((a: any) =>
      `${a.artikel};${a.altPreis.toFixed(2)};${a.neuPreis.toFixed(2)};${a.differenz.toFixed(2)};${a.menge}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preisabweichungen_${id?.slice(0, 8)}.csv`;
    a.click();
  };

  const copyAktionsliste = () => {
    const abweichungen = getPreisabweichungen();
    if (abweichungen.length === 0) return;
    const text = abweichungen
      .map((a: any) =>
        `• ${a.artikel}: ${a.altPreis.toFixed(2)}€ → ${a.neuPreis.toFixed(2)}€ (${a.differenz > 0 ? "+" : ""}${a.differenz.toFixed(2)}€)`
      )
      .join("\n");
    navigator.clipboard.writeText(`Preise zu aktualisieren:\n\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted">Lade Lieferung...</p>
        </div>
      </AuthGuard>
    );
  }

  if (!lieferung) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted">Lieferung nicht gefunden.</p>
        </div>
      </AuthGuard>
    );
  }

  const preisabweichungen = getPreisabweichungen();
  const abgleich = lieferung.abgleich_data?.abgleich ?? [];

  return (
    <AuthGuard>
      <div className="flex min-h-full flex-col">
        <header className="border-b border-border bg-surface-elevated">
          <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-muted hover:text-white transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Zurück
            </button>
            <h1 className="text-lg font-semibold text-white">
              Lieferung #{id?.slice(0, 8)}
            </h1>
            <span className="text-sm text-muted">{formatDate(lieferung.erstellt_am)}</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl px-6 py-8 space-y-6">

          {/* Zusammenfassung */}
          <div className="rounded-xl border border-border bg-surface-elevated p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Zusammenfassung</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg bg-surface p-4">
                <p className="text-xs text-muted mb-1">Ersparnis</p>
                <p className="text-xl font-bold text-green-400">
                  {lieferung.ersparnis_eur ? `€${Number(lieferung.ersparnis_eur).toFixed(2)}` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-surface p-4">
                <p className="text-xs text-muted mb-1">Abweichungen</p>
                <p className="text-xl font-bold text-white">
                  {abgleich.filter((a: any) => a.status !== "ok").length}
                </p>
              </div>
              <div className="rounded-lg bg-surface p-4">
                <p className="text-xs text-muted mb-1">Artikel</p>
                <p className="text-xl font-bold text-white">
                  {lieferung.lieferschein_data?.gelieferte_artikel?.length ?? "—"}
                </p>
              </div>
              <div className="rounded-lg bg-surface p-4">
                <p className="text-xs text-muted mb-1">Rechnungsbetrag</p>
                <p className="text-xl font-bold text-white">
                  {lieferung.rechnung_data?.brutto ? `€${lieferung.rechnung_data.brutto.toFixed(2)}` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Schritt 1: Pfandliste */}
          {lieferung.pfand_items && (
            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Schritt 1 · Pfandliste</h2>
              <div className="space-y-2">
                {lieferung.pfand_items.artikel?.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-surface px-4 py-3">
                    <span className="text-sm text-white">{a.name}</span>
                    <span className="text-sm font-semibold text-accent">{a.menge}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schritt 2: Lieferschein */}
          {lieferung.lieferschein_data && (
            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Schritt 2 · Lieferschein</h2>
              <div className="space-y-2">
                {lieferung.lieferschein_data.gelieferte_artikel?.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-surface px-4 py-3">
                    <span className="text-sm text-white">{a.artikel}</span>
                    <span className="text-sm text-muted">{a.menge}x {a.groesse}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schritt 3: Abgleich */}
          {abgleich.length > 0 && (
            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Schritt 3 · Abgleich</h2>
              <div className="space-y-2">
                {abgleich.map((item: any, i: number) => (
                  <div key={i} className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                    item.status === "ok" ? "bg-surface" : "bg-red-500/10 border border-red-500/20"
                  }`}>
                    <span className="text-sm text-white">{item.artikel}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted">{item.geliefert}/{item.bestellt}</span>
                      <span className={`text-xs font-medium ${item.status === "ok" ? "text-green-400" : "text-red-400"}`}>
                        {item.status === "ok" ? "✓" : `${item.abweichung > 0 ? "+" : ""}${item.abweichung}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schritt 4: Rechnung */}
          {lieferung.rechnung_data && (
            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Schritt 4 · Rechnung</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><p className="text-xs text-muted">Lieferant</p><p className="text-sm text-white">{lieferung.rechnung_data.lieferant ?? "—"}</p></div>
                <div><p className="text-xs text-muted">Rechnungsnr.</p><p className="text-sm text-white">{lieferung.rechnung_data.rechnungs_nummer ?? "—"}</p></div>
                <div><p className="text-xs text-muted">Netto</p><p className="text-sm text-white">{lieferung.rechnung_data.netto ? `€${lieferung.rechnung_data.netto.toFixed(2)}` : "—"}</p></div>
                <div><p className="text-xs text-muted">Brutto</p><p className="text-sm font-semibold text-white">{lieferung.rechnung_data.brutto ? `€${lieferung.rechnung_data.brutto.toFixed(2)}` : "—"}</p></div>
              </div>
              {lieferung.rechnung_data.positionen?.length > 0 && (
                <div className="space-y-2">
                  {lieferung.rechnung_data.positionen.map((pos: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-surface px-4 py-3">
                      <span className="text-sm text-white">{pos.artikel}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted">{pos.menge}x</span>
                        <span className="text-sm text-white">{pos.einzelpreis ? `€${pos.einzelpreis.toFixed(2)}` : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Preisabweichungen */}
          {preisabweichungen.length > 0 && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Preise zu aktualisieren</h2>
                  <p className="text-sm text-muted mt-1">Diese Preise haben sich laut Rechnung geändert und müssen im System angepasst werden.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyAktionsliste}
                    className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-white hover:bg-surface-elevated border border-border transition-colors"
                  >
                    {copied ? "✓ Kopiert" : "Kopieren"}
                  </button>
                  <button
                    onClick={exportPreislisteCSV}
                    className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/80 transition-colors"
                  >
                    CSV Export
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {preisabweichungen.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-surface px-4 py-3">
                    <span className="text-sm text-white">{a.artikel}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted line-through">{a.altPreis.toFixed(2)}€</span>
                      <span className="text-sm font-semibold text-orange-400">{a.neuPreis.toFixed(2)}€</span>
                      <span className={`text-xs font-medium ${a.differenz > 0 ? "text-red-400" : "text-green-400"}`}>
                        {a.differenz > 0 ? "+" : ""}{a.differenz.toFixed(2)}€
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </AuthGuard>
  );
}
