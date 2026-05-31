"use client";

import { useState, useEffect } from "react";
import AuthGuard from "../../components/AuthGuard";
import ProgressBar from "../../components/ProgressBar";
import { LieferscheinAnalysis, PfandItem } from "../../../lib/types";
import { updateLieferung } from "../../../lib/database";

export default function LieferscheinPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<LieferscheinAnalysis | null>(null);
  const [pfandItems, setPfandItems] = useState<PfandItem[]>([]);
  const [lieferungId, setLieferungId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("lieferungId");
    if (id) {
      setLieferungId(id);
      // Hier könnten wir die Pfand-Daten aus Supabase laden
      // Für jetzt nehmen wir an, dass sie im localStorage oder State sind
      const savedPfand = localStorage.getItem("pfandItems");
      if (savedPfand) {
        setPfandItems(JSON.parse(savedPfand));
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    try {
      const base64Image = await fileToBase64(file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "lieferschein", images: [base64Image] }),
      });

      const data = await response.json();
      setResults(data);

      // In Supabase speichern
      if (lieferungId) {
        await updateLieferung(lieferungId, { lieferschein_data: data });
      }
    } catch (error) {
      console.error("Fehler bei der Analyse:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const comparePfand = (lieferscheinPfand: any[]) => {
    return lieferscheinPfand.map((item) => {
      const matchingPfand = pfandItems.find(
        (p) => p.artikel.toLowerCase() === item.artikel.toLowerCase()
      );
      const hasDifference = matchingPfand && matchingPfand.menge !== item.menge;
      return { ...item, hasDifference };
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
            <a
              href="/dashboard"
              className="text-sm text-muted transition-colors hover:text-white"
            >
              Abbrechen
            </a>
          </div>
        </header>

        <ProgressBar currentStep={2} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-muted/50 px-3 py-1 text-xs font-medium text-accent ring-1 ring-accent/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Schritt 2 von 5
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
            Lieferschein fotografieren
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Fotografieren Sie den kompletten Lieferschein und laden Sie das Foto hier hoch.
          </p>

          <div className="mt-10">
            <div className="rounded-xl border-2 border-dashed border-border bg-surface-elevated/50 p-12 text-center transition-colors hover:border-accent/50">
              <input
                type="file"
                id="lieferschein-photo"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="lieferschein-photo"
                className="cursor-pointer"
              >
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
                      d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                    />
                  </svg>
                </div>
                <p className="mt-4 text-lg font-medium text-white">
                  Foto auswählen
                </p>
                <p className="mt-2 text-sm text-muted">
                  PNG, JPG bis 10MB
                </p>
              </label>

              {file && (
                <div className="mt-6 text-left">
                  <p className="text-sm font-medium text-white">
                    Ausgewählte Datei:
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {file.name}
                  </p>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
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
                        Mit KI analysieren
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {results && (
            <div className="mt-10 space-y-6">
              {/* Gelieferte Artikel */}
              <div className="rounded-xl border border-border bg-surface-elevated p-6">
                <h3 className="text-lg font-semibold text-white">
                  Gelieferte Artikel
                </h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 text-left font-medium text-muted">
                          Artikel
                        </th>
                        <th className="pb-3 text-left font-medium text-muted">
                          Menge
                        </th>
                        <th className="pb-3 text-left font-medium text-muted">
                          Größe
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.gelieferte_artikel?.map((item, index) => (
                        <tr
                          key={index}
                          className="border-b border-border last:border-0"
                        >
                          <td className="py-3 text-white">{item.artikel}</td>
                          <td className="py-3 text-white">{item.menge}</td>
                          <td className="py-3 text-white">{item.groesse}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Nicht gelieferte Positionen */}
              {results.nicht_geliefert && results.nicht_geliefert.length > 0 && (
                <div className="rounded-xl border border-border bg-surface-elevated p-6">
                  <h3 className="text-lg font-semibold text-white">
                    Nicht gelieferte Positionen
                  </h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="pb-3 text-left font-medium text-muted">
                            Artikel
                          </th>
                          <th className="pb-3 text-left font-medium text-muted">
                            Grund
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.nicht_geliefert.map((item, index) => (
                          <tr
                            key={index}
                            className="border-b border-border last:border-0"
                          >
                            <td className="py-3 text-white">{item.artikel}</td>
                            <td className="py-3 text-white">{item.grund}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pfandeinträge mit Vergleich */}
              {results.pfand_eintrage && results.pfand_eintrage.length > 0 && (
                <div className="rounded-xl border border-border bg-surface-elevated p-6">
                  <h3 className="text-lg font-semibold text-white">
                    Pfandeinträge (Fahrer)
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    Vergleich mit Schritt 1 (Pfandfotos)
                  </p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="pb-3 text-left font-medium text-muted">
                            Artikel
                          </th>
                          <th className="pb-3 text-left font-medium text-muted">
                            Menge (Fahrer)
                          </th>
                          <th className="pb-3 text-left font-medium text-muted">
                            Menge (Foto)
                          </th>
                          <th className="pb-3 text-left font-medium text-muted">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparePfand(results.pfand_eintrage).map(
                          (item: any, index: number) => {
                            const matchingPfand = pfandItems.find(
                              (p) =>
                                p.artikel.toLowerCase() ===
                                item.artikel.toLowerCase()
                            );
                            return (
                              <tr
                                key={index}
                                className={`border-b border-border last:border-0 ${
                                  item.hasDifference ? "bg-red-500/10" : ""
                                }`}
                              >
                                <td className="py-3 text-white">{item.artikel}</td>
                                <td
                                  className={`py-3 ${
                                    item.hasDifference ? "text-red-400" : "text-white"
                                  }`}
                                >
                                  {item.menge}
                                </td>
                                <td className="py-3 text-white">
                                  {matchingPfand?.menge || "—"}
                                </td>
                                <td className="py-3">
                                  {item.hasDifference ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-1 text-xs font-medium text-red-400">
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
                                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                                        />
                                      </svg>
                                      Abweichung
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-1 text-xs font-medium text-accent">
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
                                          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                        />
                                      </svg>
                                      Übereinstimmung
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <a
              href="/lieferung/pfand"
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
            <a
              href="/lieferung/abgleich"
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
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
