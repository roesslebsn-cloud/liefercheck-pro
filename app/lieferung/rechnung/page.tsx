"use client";

import { useState, useEffect } from "react";
import AuthGuard from "../../components/AuthGuard";
import ProgressBar from "../../components/ProgressBar";
import { updateLieferung } from "../../../lib/database";

export default function RechnungPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [lieferungId, setLieferungId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("lieferungId");
    if (id) setLieferungId(id);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).slice(0, 10);
      setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
      setResults(null);
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
      const newFiles = Array.from(e.dataTransfer.files).slice(0, 10);
      setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
      setResults(null);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResults(null);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const convertPdfToImages = async (file: File): Promise<string[]> => {
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch("/api/pdf-to-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("PDF conversion error:", errorData);
        throw new Error(errorData.error || "PDF conversion failed");
      }

      const data = await response.json();
      return data.images || [];
    } catch (error) {
      console.error("Error converting PDF to images:", error);
      throw new Error("PDF conversion failed. Please use image files instead.");
    }
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;

    setAnalyzing(true);
    setError(null);
    try {
      const images: string[] = [];

      for (const file of files) {
        if (file.type === "application/pdf") {
          try {
            const pdfImages = await convertPdfToImages(file);
            images.push(...pdfImages);
          } catch (pdfError) {
            console.error("PDF conversion error:", pdfError);
            setError("PDF-Konvertierung fehlgeschlagen. Bitte verwenden Sie Bilddateien (PNG, JPG).");
            return;
          }
        } else {
          const base64Image = await fileToBase64(file);
          images.push(base64Image);
        }
      }

      if (images.length === 0) {
        console.error("No valid images to analyze");
        setError("Keine gültigen Bilder zum Analysieren gefunden.");
        setAnalyzing(false);
        return;
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "rechnung", images }),
      });

      const data = await response.json();
      setResults(data);

      localStorage.setItem("rechnungData", JSON.stringify(data));

      if (lieferungId) {
        await updateLieferung(lieferungId, { rechnung_data: data });
      }
    } catch (error) {
      console.error("Fehler bei der Analyse:", error);
      setError("Fehler bei der Analyse. Bitte versuchen Sie es erneut.");
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

        <ProgressBar currentStep={4} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-muted/50 px-3 py-1 text-xs font-medium text-accent ring-1 ring-accent/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Schritt 4 von 5
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
            Rechnung hochladen
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Laden Sie die Rechnung des Lieferanten hoch, um die Preise zu überprüfen.
          </p>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-400">{error}</p>
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
                id="rechnung-pdf"
                accept="image/*,.pdf"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="rechnung-pdf"
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
                      d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z"
                    />
                  </svg>
                </div>
                <p className="mt-4 text-lg font-medium text-white">
                  Dateien auswählen
                </p>
                <p className="mt-2 text-sm text-muted">
                  PNG, JPG, PDF bis 10MB (max 10 Dateien)
                </p>
              </label>

              {files.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-medium text-white">
                    Ausgewählte Dateien ({files.length}/10):
                  </p>
                  <div className="mt-3 space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg bg-surface p-3"
                      >
                        <p className="text-sm text-muted truncate">{file.name}</p>
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
            <div className="mt-10 rounded-xl border border-border bg-surface-elevated p-6">
              <h3 className="text-lg font-semibold text-white">Rechnungsdetails</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted">Rechnungsnummer</p>
                  <p className="mt-1 text-white">{results.rechnungs_nummer || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Datum</p>
                  <p className="mt-1 text-white">{results.datum || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Lieferant</p>
                  <p className="mt-1 text-white">{results.lieferant || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Netto</p>
                  <p className="mt-1 text-white">{results.netto || "—"} €</p>
                </div>
                <div>
                  <p className="text-sm text-muted">MwSt</p>
                  <p className="mt-1 text-white">{results.mwst || "—"} €</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Brutto</p>
                  <p className="mt-1 text-white">{results.brutto || "—"} €</p>
                </div>
              </div>

              {results.positionen && results.positionen.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-white">Positionen</h4>
                  <div className="mt-3 overflow-x-auto">
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
                            Einzelpreis
                          </th>
                          <th className="pb-3 text-left font-medium text-muted">
                            Gesamtpreis
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.positionen.map((item: any, index: number) => (
                          <tr
                            key={index}
                            className="border-b border-border last:border-0"
                          >
                            <td className="py-3 text-white">{item.artikel}</td>
                            <td className="py-3 text-white">{item.menge}</td>
                            <td className="py-3 text-white">{item.einzelpreis} €</td>
                            <td className="py-3 text-white">{item.gesamtpreis} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <a
              href="/lieferung/abgleich"
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
              href="/lieferung/freigabe"
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
