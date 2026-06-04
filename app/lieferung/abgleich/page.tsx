"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import ProgressBar from "../../components/ProgressBar";
import { AbgleichAnalysis } from "../../../lib/types";
import { updateLieferung, getLieferungById } from "../../../lib/database";

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
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AbgleichAnalysis | null>(null);
  const [lieferscheinData, setLieferscheinData] = useState<any>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (lieferungId) {
      getLieferungById(lieferungId).then((lieferung) => {
        if (lieferung?.lieferschein_data) setLieferscheinData(lieferung.lieferschein_data);
        if (lieferung?.abgleich_data) setResults(lieferung.abgleich_data);
      }).catch(console.error);
    }
  }, [lieferungId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
      setFehler(null);
    }
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setResults(null);
      setFehler(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setResults(null);
    setFehler(null);
  };

  const parseCSV = (text: string) => {
    const lines = text.split("\n").filter((l) => l.trim());
    const headers = lines[0].split(/[,;]/).map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(/[,;]/).map((v) => v.trim());
      const obj: any = {};
      headers.forEach((h, i) => (obj[h] = values[i]));
      return obj;
    });
  };

  const handleAnalyze = async () => {
    if (!file) return;
    if (!lieferscheinData) {
      setFehler("Kein Lieferschein aus Schritt 2 gefunden. Bitte zuerst den Lieferschein analysieren.");
      return;
    }

    setAnalyzing(true);
    setFehler(null);

    try {
      let bestellungData: any = null;
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".csv")) {
        const text = await file.text();
        bestellungData = parseCSV(text);
      } else if (
        fileName.endsWith(".png") ||
        fileName.endsWith(".jpg") ||
        fileName.endsWith(".jpeg")
      ) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const bildResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "lieferschein", images: [base64] }),
        });
        bestellungData = await bildResponse.json();
      } else {
        setFehler("Nur CSV oder Bild-Dateien (PNG, JPG) werden unterstützt.");
        setAnalyzing(false);
        return;
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "abgleich",
          data: {
            bestellung: bestellungData,
            lieferschein: lieferscheinData,
          },
        }),
      });

      const result: AbgleichAnalysis = await response.json();
      setResults(result);

      // saved via updateLieferung

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
              className="text-sm text-muted transition-colors hover:text-white"
            >
              Abbrechen
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
            Laden Sie die Gastronovi-Exportdatei oder einen Screenshot der
            Bestellung hoch. Die KI gleicht diese automatisch mit dem
            Lieferschein ab.
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
                accept=".csv,.png,.jpg,.jpeg"
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
                  Datei auswählen
                </p>
                <p className="mt-2 text-sm text-muted">
                  CSV, PNG oder JPG bis 10MB
                </p>
              </label>

              {file && (
                <div className="mt-6">
                  <div className="flex items-center justify-between rounded-lg bg-surface p-3">
                    <p className="text-sm text-muted truncate">{file.name}</p>
                    <button
                      onClick={handleRemoveFile}
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