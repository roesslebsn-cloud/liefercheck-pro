"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import ProgressBar from "../../components/ProgressBar";
import { updateLieferung, getLieferungById, getLieferanten, speicherPreisHistorie, findLieferantByName, berechnePreisabweichungen } from "../../../lib/database";
import { Lieferant, LieferungTyp } from "../../../lib/types";

function RechnungPageContent() {
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
  const [results, setResults] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preisabweichungen, setPreisabweichungen] = useState<any[]>([]);
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isXmlMode, setIsXmlMode] = useState(false);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [typ, setTyp] = useState<LieferungTyp>("getraenke");
  const isFood = typ === "food";

  useEffect(() => {
    getLieferanten().then(setLieferanten).catch(console.error);
    if (lieferungId) {
      getLieferungById(lieferungId).then((lieferung) => {
        if (lieferung?.typ) setTyp(lieferung.typ);
        if (lieferung?.rechnung_data) {
          setResults(lieferung.rechnung_data);
          if (lieferung.rechnung_data.preisabweichungen) setPreisabweichungen(lieferung.rechnung_data.preisabweichungen);
        }
      }).catch(console.error);
    }
  }, [lieferungId]);

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

  const handleXmlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setXmlFile(e.target.files[0]);
      setResults(null);
      setPreisabweichungen([]);
    }
  };

  const handleAnalyzeXml = async () => {
    if (!xmlFile) return;
    setAnalyzing(true);
    setError(null);
    try {
      const text = await xmlFile.text();
      const response = await fetch("/api/erechnung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xmlString: text }),
      });
      if (!response.ok) throw new Error("XRechnung-Analyse fehlgeschlagen");
      const result = await response.json();
      const d = result.daten || result;
      const normalized = {
        rechnungs_nummer: d.rechnungsnummer || d.rechnungsNummer || "",
        datum: d.rechnungsdatum || d.ausstellungsDatum || "",
        lieferant: d.lieferant?.name || d.verkaeufer?.name || "",
        netto: d.summen?.nettoGesamt ?? d.gesamtNetto ?? null,
        mwst: d.summen?.steuerBetrag ?? d.steuerBetrag ?? null,
        brutto: d.summen?.bruttoGesamt ?? d.gesamtBrutto ?? null,
        positionen: (d.positionen || []).map((p: any) => ({
          artikel: p.bezeichnung || p.artikel || "",
          menge: p.menge ?? 1,
          einzelpreis: p.einzelpreisNetto ?? p.einzelpreis ?? null,
          gesamtpreis: p.gesamtpreisNetto ?? p.gesamtpreis ?? null,
        })),
        xrechnung: true,
        format: d.format || "XRechnung",
      };
      await applyPreisabgleichAndSave(normalized);
    } catch (err) {
      setError("XRechnung-Analyse fehlgeschlagen. Bitte Datei pruefen.");
    } finally {
      setAnalyzing(false);
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

  const tryExtractZugferd = async (file: File): Promise<any | null> => {
    if (file.type !== "application/pdf") return null;
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch("/api/erechnung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64, filename: file.name }),
      });
      if (!response.ok) return null;
      const result = await response.json();
      if (!result.success || !result.daten) return null;
      const d = result.daten;
      return {
        rechnungs_nummer: d.rechnungsnummer || "",
        datum: d.rechnungsdatum || "",
        lieferant: d.lieferant?.name || "",
        netto: d.summen?.nettoGesamt ?? null,
        mwst: d.summen?.steuerBetrag ?? null,
        brutto: d.summen?.bruttoGesamt ?? null,
        positionen: (d.positionen || []).map((p: any) => ({
          artikel: p.bezeichnung || "",
          menge: p.menge ?? 1,
          einzelpreis: p.einzelpreisNetto ?? null,
          gesamtpreis: p.gesamtpreisNetto ?? null,
        })),
        xrechnung: true,
        format: d.format || "ZUGFeRD",
      };
    } catch {
      return null;
    }
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;

    setAnalyzing(true);
    setError(null);
    try {
      // 1) Try ZUGFeRD auto-detection on PDFs first - kostenlos und exakt
      for (const file of files) {
        const zugferdData = await tryExtractZugferd(file);
        if (zugferdData) {
          await applyPreisabgleichAndSave(zugferdData);
          return;
        }
      }

      // 2) Fallback to KI-Analyse for image PDFs or pictures
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
        body: JSON.stringify({ type: "rechnung", images, warenart: typ }),
      });
      const data = await response.json();
      await applyPreisabgleichAndSave(data);
    } catch (error) {
      console.error("Fehler bei der Analyse:", error);
      setError("Fehler bei der Analyse. Bitte versuchen Sie es erneut.");
    } finally {
      setAnalyzing(false);
    }
  };

  const applyPreisabgleichAndSave = async (data: any) => {
    setResults(data);

    const abweichungen = berechnePreisabweichungen(data.positionen, lieferanten, data.lieferant);
    setPreisabweichungen(abweichungen);

    const rechnungDataMitAbweichungen = { ...data, preisabweichungen: abweichungen };
    if (lieferungId) {
      await updateLieferung(lieferungId, { rechnung_data: rechnungDataMitAbweichungen });
    }

    if (data.positionen?.length > 0 && data.lieferant) {
      findLieferantByName(data.lieferant).then(lieferant => {
        if (lieferant?.id) {
          speicherPreisHistorie(
            lieferant.id,
            data.positionen,
            data.datum || null,
            lieferungId || undefined
          ).catch(() => {});
        }
      }).catch(() => {});
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

        <ProgressBar current="rechnung" typ={typ} lieferungId={lieferungId} lieferdatum={lieferdatum} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-muted/50 px-3 py-1 text-xs font-medium text-accent ring-1 ring-accent/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {isFood ? "Schritt 3 von 4" : "Schritt 4 von 5"}
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
            <div className="flex gap-1 rounded-xl border border-border bg-surface p-1 w-fit mb-2">
              <button
                onClick={() => { setIsXmlMode(false); setXmlFile(null); setResults(null); setPreisabweichungen([]); }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${!isXmlMode ? "bg-accent text-white shadow" : "text-muted hover:text-white"}`}
              >PDF / Foto</button>
              <button
                onClick={() => { setIsXmlMode(true); setFiles([]); setResults(null); setPreisabweichungen([]); }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${isXmlMode ? "bg-accent text-white shadow" : "text-muted hover:text-white"}`}
              >XRechnung (XML)</button>
            </div>
            <p className="text-xs text-muted mb-4">
              PDFs werden automatisch auf eingebettete E-Rechnung (ZUGFeRD) geprueft - falls vorhanden, kostenlos und exakt verarbeitet.
            </p>

            {isXmlMode ? (
              <div className="rounded-xl border-2 border-dashed border-border bg-surface-elevated/50 p-12 text-center">
                <input type="file" id="rechnung-xml" accept=".xml,.pdf" onChange={handleXmlChange} className="hidden" />
                <label htmlFor="rechnung-xml" className="cursor-pointer">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-muted/50 text-accent">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                    </svg>
                  </div>
                  <p className="mt-4 text-lg font-medium text-white">XRechnung oder ZUGFeRD-PDF auswaehlen</p>
                  <p className="mt-2 text-sm text-muted">.xml · ZUGFeRD PDF</p>
                </label>
                {xmlFile && (
                  <div className="mt-6">
                    <p className="text-sm text-muted mb-3">Ausgewaehlt: <span className="text-white">{xmlFile.name}</span></p>
                    <button onClick={handleAnalyzeXml} disabled={analyzing}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors">
                      {analyzing ? "Analysiere..." : "XRechnung parsen"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
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
            )}
          </div>

          {results?.xrechnung && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
              <svg className="h-6 w-6 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-green-400">E-Rechnung erkannt ({results.format || "ZUGFeRD"})</p>
                <p className="text-xs text-muted mt-0.5">Daten direkt aus dem strukturierten Format gelesen - 100% exakt, ohne KI-Kosten.</p>
              </div>
            </div>
          )}
          {results && !results.xrechnung && (
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
              <svg className="h-6 w-6 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-blue-400">KI-Analyse durchgefuehrt</p>
                <p className="text-xs text-muted mt-0.5">Tipp: Wenn Ihr Lieferant ZUGFeRD-PDFs anbietet, werden diese automatisch kostenlos erkannt.</p>
              </div>
            </div>
          )}

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

          {preisabweichungen.length > 0 && (
            <div className="mt-6 rounded-xl border border-orange-500/30 bg-orange-500/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <h4 className="text-sm font-semibold text-orange-400">{preisabweichungen.length} Preisabweichung(en) zur Preisliste</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-orange-500/20">
                      <th className="pb-2 text-left font-medium text-muted">Artikel</th>
                      <th className="pb-2 text-right font-medium text-muted">Rechnung</th>
                      <th className="pb-2 text-right font-medium text-muted">Preisliste</th>
                      <th className="pb-2 text-right font-medium text-muted">Abweichung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preisabweichungen.map((a: any, i: number) => (
                      <tr key={i} className="border-b border-orange-500/10 last:border-0">
                        <td className="py-2 text-white">{a.artikel}</td>
                        <td className="py-2 text-right text-white">€{a.preis_rechnung.toFixed(2)}</td>
                        <td className="py-2 text-right text-muted">€{a.preis_liste.toFixed(2)}</td>
                        <td className={"py-2 text-right font-medium " + (a.abweichung_eur > 0 ? "text-red-400" : "text-green-400")}>
                          {a.abweichung_eur > 0 ? "+" : ""}{a.abweichung_eur.toFixed(2)} € ({a.abweichung_prozent}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <a
              href={buildNextUrl("/lieferung/abgleich")}
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
              href={buildNextUrl("/lieferung/freigabe")}
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

export default function RechnungPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>}>
      <RechnungPageContent />
    </Suspense>
  );
}
