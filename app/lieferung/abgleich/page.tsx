"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import ProgressBar from "../../components/ProgressBar";
import { AbgleichAnalysis, PfandAnalysis, PfandEintrag } from "../../../lib/types";
import { updateLieferung, getLieferungById } from "../../../lib/database";
import { optimizeImageFile, pdfToImages } from "../../../lib/imageUtils";

const MAX_DATEIEN = 7;

function AbgleichPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lieferungId = searchParams.get("id");
  const lieferdatum = searchParams.get("date");

  const buildNextUrl = (path: string) => {
    const params = new URLSearchParams();
    if (lieferungId) params.set("id", lieferungId);
    if (lieferdatum) params.set("date", lieferdatum);
    return `${path}?${params.toString()}`;
  };
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AbgleichAnalysis | null>(null);
  const [lieferscheinData, setLieferscheinData] = useState<any>(null);
  const [pfandItems, setPfandItems] = useState<PfandAnalysis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (lieferungId) {
      getLieferungById(lieferungId).then((lieferung) => {
        if (lieferung?.lieferschein_data) setLieferscheinData(lieferung.lieferschein_data);
        if (lieferung?.abgleich_data) setResults(lieferung.abgleich_data);
        if (lieferung?.pfand_items) setPfandItems(lieferung.pfand_items);
      }).catch(console.error);
    }
  }, [lieferungId]);

  const addFiles = (incoming: FileList) => {
    const neu = Array.from(incoming);
    setFiles((prev) => [...prev, ...neu].slice(0, MAX_DATEIEN));
    setResults(null);
    setFehler(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResults(null);
    setFehler(null);
  };

  const parseCSV = (text: string) => {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(/[,;]/).map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(/[,;]/).map((v) => v.trim().replace(/^"|"$/g, ""));
      const obj: any = {};
      headers.forEach((h, i) => (obj[h] = values[i] ?? ""));
      return obj;
    });
    // Normalisierung: Gastronovi-CSV-Spalten auf einheitliches Format mappen
    return rows.map((row) => {
      const nameKey = Object.keys(row).find((k) =>
        /bezeich|artikel(?!nr|num)|name|produkt/i.test(k)
      );
      const mengeKey = Object.keys(row).find((k) =>
        /^menge$|bestellmenge|anzahl|qty/i.test(k)
      );
      const gebindeKey = Object.keys(row).find((k) =>
        /gebinde|einheit|unit|groesse|größe/i.test(k)
      );
      if (nameKey && mengeKey) {
        return {
          artikel: row[nameKey] || "",
          menge: parseFloat(String(row[mengeKey]).replace(",", ".")) || 0,
          gebinde: gebindeKey ? row[gebindeKey] : undefined,
          _raw: row, // Rohdaten zur Fehlersuche behalten
        };
      }
      // Fallback: Rohdaten übergeben (KI erkennt das Format selbst)
      return row;
    }).filter((r) => r.artikel !== "" && r.menge !== 0);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    if (!lieferscheinData) {
      setFehler("Kein Lieferschein aus Schritt 2 gefunden. Bitte zuerst den Lieferschein analysieren.");
      return;
    }

    setAnalyzing(true);
    setFehler(null);

    try {
      const bestellungRows: any[] = [];
      const images: string[] = [];

      // Mehrere Dateien einsammeln: CSV direkt parsen, Bilder/PDF für die KI sammeln
      for (const f of files) {
        const name = f.name.toLowerCase();
        if (name.endsWith(".csv")) {
          const text = await f.text();
          bestellungRows.push(...parseCSV(text));
        } else if (f.type === "application/pdf" || name.endsWith(".pdf")) {
          images.push(...(await pdfToImages(f)));
        } else if (f.type.startsWith("image/") || /\.(png|jpe?g|webp)$/.test(name)) {
          images.push(await optimizeImageFile(f));
        } else {
          setFehler(`Nicht unterstützte Datei: ${f.name}. Erlaubt: CSV, PNG, JPG, PDF.`);
          setAnalyzing(false);
          return;
        }
      }

      // Screenshots/PDF-Seiten der Gastronovi-Bestellung per KI in Artikel umwandeln
      if (images.length > 0) {
        const bildResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "bestellung", images }),
        });
        const bildData = await bildResponse.json();
        if (!bildResponse.ok || bildData?.error) {
          setFehler(bildData?.error || "Die Bestellung auf dem Bild konnte nicht gelesen werden. Bitte schärferen Screenshot/PDF verwenden.");
          return;
        }
        if (Array.isArray(bildData.positionen)) {
          bestellungRows.push(...bildData.positionen);
        }
      }

      if (bestellungRows.length === 0) {
        setFehler("Aus den hochgeladenen Dateien konnte keine Bestellung gelesen werden. Bitte CSV-Export oder lesbare Screenshots verwenden.");
        return;
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "abgleich",
          data: { bestellung: bestellungRows, lieferschein: lieferscheinData },
        }),
      });

      const result = await response.json();
      if (!response.ok || result?.error) {
        setFehler(result?.error || "Abgleich fehlgeschlagen. Bitte erneut versuchen.");
        return;
      }

      setResults(result);
      if (lieferungId) {
        await updateLieferung(lieferungId, { abgleich_data: result });
      }
    } catch (error) {
      console.error("Fehler beim Abgleich:", error);
      setFehler("Fehler beim Abgleich. Bitte erneut versuchen.");
    } finally {
      setAnalyzing(false);
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
                    d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9.75 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                  />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">
                LieferCheck Pro
              </span>
            </div>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-white transition-colors hover:border-accent/50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Speichern &amp; schließen
            </a>
          </div>
        </header>

        <ProgressBar currentStep={3} lieferungId={lieferungId} lieferdatum={lieferdatum} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-muted/50 px-3 py-1 text-xs font-medium text-accent ring-1 ring-accent/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Schritt 3 von 5
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
            Gastronovi Abgleich
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Laden Sie die Gastronovi-Exportdatei oder Screenshots der Bestellung
            hoch – auch mehrere Seiten/Dateien (CSV, Bild oder PDF). Die KI
            gleicht alles automatisch mit dem Lieferschein ab.
          </p>

          {!lieferscheinData && (
            <div className="mt-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-sm text-yellow-400">
                Kein Lieferschein gefunden. Bitte zuerst Schritt 2 abschließen.
              </p>
            </div>
          )}

          <div className="mt-10">
            <div
              className={`rounded-xl border-2 border-dashed bg-surface-elevated/50 p-12 text-center transition-colors ${
                dragActive ? "border-accent bg-accent-muted/10" : "border-border hover:border-accent/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="gastronovi-datei"
                accept=".csv,.png,.jpg,.jpeg,.pdf"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="gastronovi-datei" className="cursor-pointer">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-muted/50 text-accent">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                    />
                  </svg>
                </div>
                <p className="mt-4 text-lg font-medium text-white">
                  Dateien auswählen
                </p>
                <p className="mt-2 text-sm text-muted">
                  CSV, PNG, JPG oder PDF · mehrseitig möglich (bis {MAX_DATEIEN} Dateien)
                </p>
              </label>

              {files.length > 0 && (
                <div className="mt-6 text-left">
                  <p className="text-sm font-medium text-white">
                    Ausgewählte Dateien ({files.length}/{MAX_DATEIEN}):
                  </p>
                  <div className="mt-3 space-y-2">
                    {files.map((f, index) => (
                      <div key={index} className="flex items-center justify-between rounded-lg bg-surface p-3">
                        <p className="text-sm text-muted truncate">{f.name}</p>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-500/20 hover:text-red-400"
                        >
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18 18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || !lieferscheinData}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    {analyzing ? (
                      <>
                        <svg
                          className="h-4 w-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Analysiere...
                      </>
                    ) : (
                      <>
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
                            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                          />
                        </svg>
                        Analysieren
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {fehler && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-400">{fehler}</p>
            </div>
          )}

          {results && (
            <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-6">
              <h3 className="text-lg font-semibold text-white">Abgleich-Ergebnis</h3>
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                    results.zusammenfassung.alles_ok
                      ? "bg-green-500/20 text-green-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {results.zusammenfassung.alles_ok ? "✓ Alles OK" : "⚠ Abweichungen"}
                  </span>
                  <span className="text-sm text-muted">
                    {results.zusammenfassung.anzahl_abweichungen} Abweichungen
                  </span>
                </div>
                <p className="text-sm text-muted mb-4">{results.zusammenfassung.hinweis}</p>
                <div className="space-y-2">
                  {results.abgleich.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between rounded-lg p-3 ${
                        item.status === "ok"
                          ? "bg-green-500/10"
                          : "bg-yellow-500/10"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{item.artikel}</p>
                        <p className="text-xs text-muted">
                          Bestellt: {item.bestellt} | Geliefert: {item.geliefert}
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${
                        item.status === "ok"
                          ? "text-green-400"
                          : "text-yellow-400"
                      }`}>
                        {item.abweichung !== 0 ? `${item.abweichung > 0 ? '+' : ''}${item.abweichung}` : item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Pfand-Abgleich ─────────────────────────────── */}
          {(pfandItems?.artikel?.length || lieferscheinData?.pfand_eintrage?.length) ? (
            <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                  </svg>
                </div>
                <h3 className="text-[15px] font-semibold text-white">Pfand-Abgleich</h3>
              </div>

              {/* Spalten-Header */}
              <div className="grid grid-cols-3 gap-2 mb-2 px-1">
                <p className="text-[10.5px] uppercase tracking-wider font-medium text-muted">Artikel</p>
                <p className="text-[10.5px] uppercase tracking-wider font-medium text-muted text-center">Schritt 1 (manuell)</p>
                <p className="text-[10.5px] uppercase tracking-wider font-medium text-muted text-center">Lieferschein (KI)</p>
              </div>

              {/* Alle Pfand-Positionen zusammenführen */}
              {(() => {
                const schritt1 = pfandItems?.artikel || [];
                const lieferschein: PfandEintrag[] = lieferscheinData?.pfand_eintrage || [];
                // Alle Namen sammeln (union)
                const alle = Array.from(new Set([
                  ...schritt1.map(a => a.name),
                  ...lieferschein.map(e => e.artikel),
                ]));
                if (alle.length === 0) return (
                  <p className="text-[12.5px] text-muted">Kein Pfand erfasst oder auf dem Lieferschein erkannt.</p>
                );
                return (
                  <div className="space-y-2">
                    {alle.map((name) => {
                      const s1 = schritt1.find(a => a.name.toLowerCase() === name.toLowerCase());
                      const ls = lieferschein.find(e => e.artikel.toLowerCase() === name.toLowerCase());
                      const m1 = s1?.menge ?? null;
                      const mLs = ls?.menge ?? null;
                      const ok = m1 !== null && mLs !== null && m1 === mLs;
                      const abw = m1 !== null && mLs !== null && m1 !== mLs;
                      const nurEins = (m1 !== null) !== (mLs !== null);
                      return (
                        <div key={name} className={`grid grid-cols-3 gap-2 items-center rounded-lg px-3 py-2.5 ${
                          ok ? "bg-green-500/10" : abw ? "bg-yellow-500/10" : "bg-surface/60"
                        }`}>
                          <p className="text-[13px] font-medium text-white truncate">{name}</p>
                          <p className="text-[13px] text-center tabular-nums" style={{ color: m1 !== null ? "var(--text-default)" : "var(--text-faint)" }}>
                            {m1 !== null ? m1 : "—"}
                          </p>
                          <div className="flex items-center justify-center gap-1.5">
                            <p className="text-[13px] tabular-nums" style={{ color: mLs !== null ? "var(--text-default)" : "var(--text-faint)" }}>
                              {mLs !== null ? mLs : "—"}
                            </p>
                            {ok && <span className="text-[10px] font-semibold text-green-400">✓</span>}
                            {abw && <span className="text-[10px] font-semibold text-yellow-400">≠</span>}
                            {nurEins && <span className="text-[10px] font-semibold" style={{ color: "var(--text-faint)" }}>?</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Legende */}
              <div className="mt-3 flex flex-wrap gap-3 text-[10.5px] text-muted">
                <span className="flex items-center gap-1"><span className="text-green-400 font-bold">✓</span> stimmt überein</span>
                <span className="flex items-center gap-1"><span className="text-yellow-400 font-bold">≠</span> Abweichung</span>
                <span className="flex items-center gap-1"><span style={{ color: "var(--text-faint)" }} className="font-bold">?</span> nur einseitig erfasst</span>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex justify-between">
            <a
              href={buildNextUrl("/lieferung/lieferschein")}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-surface-elevated"
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
              Zurück
            </a>
            {results && (
              <a
                href={buildNextUrl("/lieferung/rechnung")}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Weiter
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
                    d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                  />
                </svg>
              </a>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

export default function AbgleichPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>}>
      <AbgleichPageContent />
    </Suspense>
  );
}