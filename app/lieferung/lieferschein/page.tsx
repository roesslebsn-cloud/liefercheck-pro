"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import ProgressBar from "../../components/ProgressBar";
import { LieferscheinAnalysis, PfandAnalysis } from "../../../lib/types";
import { updateLieferung, getLieferungById } from "../../../lib/database";
import { optimizeImageFile, pdfToImages } from "../../../lib/imageUtils";
// pdfjs loaded dynamically to avoid SSR DOMMatrix error

function LieferscheinPageContent() {
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
  // Hochgeladene Seiten als optimierte data-URLs (überleben Navigation via sessionStorage)
  const [pages, setPages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<LieferscheinAnalysis | null>(null);
  const [pfandData, setPfandData] = useState<PfandAnalysis | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pagesKey = lieferungId ? `ls_pages_${lieferungId}` : null;
  const persistPages = (list: { name: string; dataUrl: string }[]) => {
    if (!pagesKey) return;
    try {
      if (list.length === 0) sessionStorage.removeItem(pagesKey);
      else sessionStorage.setItem(pagesKey, JSON.stringify(list));
    } catch {
      // Quota überschritten – in-memory funktioniert trotzdem für diese Session
    }
  };

  // Bestätigungsschritt für handschriftliche Markierungen
  const [events, setEvents] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<Record<string, { delivered: boolean; menge: number; artikel?: string }>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTable, setEditTable] = useState(false);
  const [savingTable, setSavingTable] = useState(false);
  const [tableSaved, setTableSaved] = useState(false);

  useEffect(() => {
    if (lieferungId) {
      getLieferungById(lieferungId).then((lieferung) => {
        if (lieferung?.pfand_items) setPfandData(lieferung.pfand_items);
        if (lieferung?.lieferschein_data) {
          setResults(lieferung.lieferschein_data);
          setConfirmed(true); // bereits früher bestätigt/gespeichert
        }
      }).catch(console.error);
    }
    // Zuvor hochgeladene (aber noch nicht analysierte) Seiten wiederherstellen
    if (pagesKey) {
      try {
        const stored = sessionStorage.getItem(pagesKey);
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list) && list.length > 0) setPages(list);
        }
      } catch {
        // ignorieren
      }
    }
  }, [lieferungId]);

  // Dateien (Bilder/PDF) zu optimierten Seiten verarbeiten und persistieren
  const addFiles = async (incoming: File[]) => {
    if (incoming.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      const neu: { name: string; dataUrl: string }[] = [];
      for (const file of incoming) {
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          try {
            const imgs = await pdfToImages(file);
            imgs.forEach((dataUrl, i) => neu.push({ name: `${file.name} · Seite ${i + 1}`, dataUrl }));
          } catch {
            setError("PDF-Konvertierung fehlgeschlagen. Bitte Bilddateien (PNG, JPG) verwenden.");
          }
        } else if (file.type.startsWith("image/")) {
          neu.push({ name: file.name, dataUrl: await optimizeImageFile(file) });
        }
      }
      setPages((prev) => {
        const merged = [...prev, ...neu].slice(0, 10);
        persistPages(merged);
        return merged;
      });
      setResults(null);
      setConfirmed(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = ""; // erlaubt erneutes Auswählen derselben Datei
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
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleRemoveFile = (index: number) => {
    setPages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      persistPages(next);
      return next;
    });
    setResults(null);
  };

  // fileToBase64 / PDF-Konvertierung liegen jetzt in lib/imageUtils.ts

const handleAnalyze = async () => {
  if (pages.length === 0) return;

  setAnalyzing(true);
  setError(null);
  try {
    const images: string[] = pages.map((p) => p.dataUrl);

    if (images.length === 0) {
      setError("Keine gültigen Bilder zum Analysieren gefunden.");
      setAnalyzing(false);
      return;
    }

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lieferschein", images }),
    });

    const data = await response.json();

    // Echte Fehlermeldungen statt stiller leerer Tabelle
    if (!response.ok || data?.error) {
      setError(data?.error || "Die KI konnte den Lieferschein nicht lesen. Bitte ein schärferes Foto bei gutem Licht aufnehmen (ganze Seite, gerade von oben) und erneut versuchen.");
      return;
    }
    if (!data?.gelieferte_artikel || data.gelieferte_artikel.length === 0) {
      setError("Es wurden keine Artikel erkannt. Tipps: gutes Licht, ganze Seite im Bild, gerade von oben fotografieren – dann erneut versuchen.");
      return;
    }

    // Handschrift-Funde sammeln (Korrektur / unsicher / fehlt) → Bestätigungsschritt
    const evts: any[] = [];
    (data.gelieferte_artikel || []).forEach((it: any, i: number) => {
      if (it.korrigiert || it.unsicher) {
        evts.push({
          id: `g${i}`,
          artikel: it.artikel,
          kind: it.korrigiert ? "korrektur" : "unsicher",
          mengeGedruckt: it.menge_gedruckt ?? it.menge,
          menge: it.menge,
        });
      }
    });
    (data.nicht_geliefert || []).forEach((it: any, i: number) => {
      evts.push({ id: `n${i}`, artikel: it.artikel, kind: "fehlt", mengeGedruckt: it.menge_gedruckt ?? null, menge: 0 });
    });

    const initialDecisions: Record<string, { delivered: boolean; menge: number }> = {};
    evts.forEach((e) => {
      initialDecisions[e.id] = { delivered: e.kind !== "fehlt", menge: e.kind === "fehlt" ? 0 : e.menge };
    });

    setResults(data);
    setEvents(evts);
    setDecisions(initialDecisions);

    if (evts.length === 0) {
      // Nichts zu bestätigen → direkt speichern
      setConfirmed(true);
      if (lieferungId) await updateLieferung(lieferungId, { lieferschein_data: data });
      persistPages([]); // in DB gesichert → Zwischenspeicher leeren
    } else {
      // Handschrift gefunden → erst bestätigen lassen, dann speichern
      setConfirmed(false);
    }
  } catch (error) {
    console.error("Fehler bei der Analyse:", error);
    setError("Fehler bei der Analyse. Bitte versuchen Sie es erneut.");
  } finally {
    setAnalyzing(false);
  }
};

const handleConfirm = async () => {
  if (!results) return;
  const base: any = results;
  const newGeliefert: any[] = [];
  const newNicht: any[] = [];

  (base.gelieferte_artikel || []).forEach((it: any, i: number) => {
    const id = `g${i}`;
    if (!events.some((e) => e.id === id)) {
      newGeliefert.push(it); // unverändert
      return;
    }
    const dec = decisions[id];
    const artikelName = dec?.artikel ?? it.artikel;
    if (dec?.delivered) {
      const gedruckt = it.menge_gedruckt ?? it.menge;
      newGeliefert.push({ ...it, artikel: artikelName, menge: dec.menge, korrigiert: dec.menge !== gedruckt || artikelName !== it.artikel, unsicher: false });
    } else {
      newNicht.push({ artikel: artikelName, grund: "fehlt", menge_gedruckt: it.menge_gedruckt ?? it.menge });
    }
  });

  (base.nicht_geliefert || []).forEach((it: any, i: number) => {
    const id = `n${i}`;
    const dec = decisions[id];
    const artikelName = dec?.artikel ?? it.artikel;
    if (dec?.delivered) {
      newGeliefert.push({ artikel: artikelName, menge: dec.menge, groesse: it.groesse || "", korrigiert: true });
    } else {
      newNicht.push({ ...it, artikel: artikelName });
    }
  });

  const finalData = { ...base, gelieferte_artikel: newGeliefert, nicht_geliefert: newNicht };
  setResults(finalData);
  setConfirmed(true);
  if (lieferungId) await updateLieferung(lieferungId, { lieferschein_data: finalData });
  persistPages([]); // in DB gesichert → Zwischenspeicher leeren
};

const setDecision = (id: string, patch: Partial<{ delivered: boolean; menge: number; artikel: string }>) => {
  setDecisions((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
};

// ─── Manuelle Korrektur der erkannten Artikel (KI-Fehler ausbügeln) ──────────
const updateGeliefertItem = (index: number, patch: Partial<{ artikel: string; menge: number; groesse: string }>) => {
  setResults((prev) => {
    if (!prev) return prev;
    const list = [...(prev.gelieferte_artikel || [])];
    list[index] = { ...list[index], ...patch };
    return { ...prev, gelieferte_artikel: list };
  });
  setTableSaved(false);
};

const removeGeliefertItem = (index: number) => {
  setResults((prev) => {
    if (!prev) return prev;
    const list = (prev.gelieferte_artikel || []).filter((_, i) => i !== index);
    return { ...prev, gelieferte_artikel: list };
  });
  setTableSaved(false);
};

const addGeliefertItem = () => {
  setResults((prev) => {
    if (!prev) return prev;
    const list = [...(prev.gelieferte_artikel || []), { artikel: "", menge: 1, groesse: "" }];
    return { ...prev, gelieferte_artikel: list };
  });
  setTableSaved(false);
  setEditTable(true);
};

const saveTable = async () => {
  if (!results || !lieferungId) return;
  setSavingTable(true);
  try {
    // Leere Namens-Zeilen verwerfen
    const cleaned = {
      ...results,
      gelieferte_artikel: (results.gelieferte_artikel || []).filter((a) => (a.artikel || "").trim() !== ""),
    };
    await updateLieferung(lieferungId, { lieferschein_data: cleaned });
    setResults(cleaned);
    setTableSaved(true);
    setEditTable(false);
  } catch (e) {
    setError("Korrekturen konnten nicht gespeichert werden. Bitte erneut versuchen.");
  } finally {
    setSavingTable(false);
  }
};

  const comparePfand = (lieferscheinPfand: any[]) => {
    return lieferscheinPfand.map((item) => {
      const matchingPfand = pfandData?.artikel.find(
        (p) => p.name.toLowerCase() === item.artikel.toLowerCase()
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-white transition-colors hover:border-accent/50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Speichern &amp; schließen
            </a>
          </div>
        </header>

        <ProgressBar currentStep={2} lieferungId={lieferungId} lieferdatum={lieferdatum} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-muted/50 px-3 py-1 text-xs font-medium text-accent ring-1 ring-accent/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Schritt 2 von 5
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
            Lieferschein fotografieren
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Fotografieren Sie alle Seiten des Lieferscheins – auch mehrseitige (z.&nbsp;B. „Seite 1 von 4"). Handschriftliche Bleistift-Notizen und „fehlt"-Vermerke werden mitgelesen.
          </p>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Bleistift-Code – Anleitung, immer sichtbar vor dem Scannen */}
          <div className="mt-6 rounded-xl border border-accent/30 bg-accent-muted/10 p-5">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
              <h3 className="text-base font-semibold text-white">So gehst du mit dem Lieferschein um – vor dem Scannen</h3>
            </div>

            {/* Standardfall – kein Markieren nötig */}
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-300">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Stimmt alles? Dann lass die Positionen einfach stehen.</p>
                <p className="mt-1 text-xs text-muted">
                  Kein Häkchen nötig – auch bei 20 Positionen. Jede nicht markierte Zeile gilt automatisch als geliefert mit der gedruckten Menge.
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm font-medium text-white">Nur diese 2 Fälle markierst du mit Bleistift:</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {/* Eingekreiste Zahl */}
              <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-orange-400 text-sm font-bold text-orange-300">3</div>
                <p className="mt-2 text-sm font-semibold text-white">Andere Menge → Zahl einkreisen</p>
                <p className="mt-1 text-xs text-muted">Wurde eine andere Menge geliefert? Schreib die echte Zahl daneben und kreise sie ein – sie überschreibt die gedruckte Menge.</p>
              </div>
              {/* Fehlt */}
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20 text-sm font-bold text-red-300">F</div>
                <p className="mt-2 text-sm font-semibold text-white">Fehlt → „fehlt" oder durchstreichen</p>
                <p className="mt-1 text-xs text-muted">Artikel gar nicht geliefert? Schreib „fehlt" daneben oder streiche die Zeile durch.</p>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface/60 p-3">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              <p className="text-xs text-muted">
                Ein Häkchen ist <span className="text-white">optional</span> – nur falls du beim Prüfen den Überblick behalten willst. Es ändert nichts an der Menge. Nach dem Scannen zeigt dir die App alle erkannten Markierungen noch einmal zur Bestätigung.
              </p>
            </div>
          </div>

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
                id="lieferschein-photo"
                accept="image/*,.pdf"
                capture="environment"
                multiple
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
                  Fotos auswählen
                </p>
                <p className="mt-2 text-sm text-muted">
                  PNG, JPG, PDF bis 10MB (max 10 Seiten)
                </p>
              </label>

              {processing && (
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Seiten werden vorbereitet…
                </div>
              )}

              {pages.length > 0 && !results && (
                <div className="mt-6 text-left">
                  <p className="text-sm font-medium text-white">
                    Hochgeladene Seiten ({pages.length}/10):
                  </p>
                  <div className="mt-3 space-y-2">
                    {pages.map((page, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg bg-surface p-2 pr-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={page.dataUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded object-cover" />
                          <p className="text-sm text-muted truncate">{page.name}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-500/20 hover:text-red-400"
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
                    disabled={analyzing || processing}
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
              {/* Bestätigungsschritt für handschriftliche Markierungen */}
              {events.length > 0 && !confirmed && (
                <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-6">
                  <div className="flex items-center gap-2">
                    <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-orange-300">Handschrift gefunden – bitte bestätigen</h3>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Prüfe diese {events.length} Markierung(en). Du kannst die Menge anpassen. Erst nach dem Bestätigen wird gespeichert.
                  </p>
                  <div className="mt-4 space-y-3">
                    {events.map((e) => {
                      const dec = decisions[e.id] || { delivered: e.kind !== "fehlt", menge: e.menge };
                      const isEditing = editingId === e.id;
                      const artikelAnzeige = dec.artikel ?? e.artikel;
                      return (
                        <div key={e.id} className="rounded-lg bg-surface p-4">
                          <div className="flex items-start justify-between gap-2">
                            {isEditing ? (
                              <input
                                autoFocus
                                type="text"
                                value={dec.artikel ?? e.artikel}
                                onChange={(ev) => setDecision(e.id, { artikel: ev.target.value })}
                                onBlur={() => setEditingId(null)}
                                onKeyDown={(ev) => ev.key === "Enter" && setEditingId(null)}
                                className="flex-1 rounded-md border border-accent bg-surface px-2 py-1 text-sm font-medium text-white focus:outline-none"
                              />
                            ) : (
                              <p className="text-sm font-medium text-white">{artikelAnzeige}</p>
                            )}
                            <button
                              onClick={() => setEditingId(isEditing ? null : e.id)}
                              title="Artikelname bearbeiten"
                              className={`flex-shrink-0 rounded-md p-1 transition-colors ${isEditing ? "text-accent" : "text-muted hover:text-white"}`}
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                              </svg>
                            </button>
                          </div>
                          <p className="mt-0.5 text-xs text-muted">
                            {e.kind === "fehlt" && 'Als „fehlt" markiert (nicht geliefert)'}
                            {e.kind === "korrektur" && `Eingekreiste Korrektur: gedruckt ${e.mengeGedruckt} → erkannt ${e.menge}`}
                            {e.kind === "unsicher" && `Markierung unsicher${e.mengeGedruckt != null ? ` (gedruckt ${e.mengeGedruckt})` : ""}`}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => setDecision(e.id, { delivered: true, menge: dec.menge || e.menge || e.mengeGedruckt || 0 })}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${dec.delivered ? "bg-accent text-white" : "border border-border bg-surface text-muted hover:text-white"}`}
                            >
                              Geliefert
                            </button>
                            <button
                              onClick={() => setDecision(e.id, { delivered: false, menge: 0 })}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${!dec.delivered ? "bg-red-500 text-white" : "border border-border bg-surface text-muted hover:text-white"}`}
                            >
                              Fehlt
                            </button>
                            {dec.delivered && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted">Menge:</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={dec.menge}
                                  onChange={(ev) => setDecision(e.id, { menge: Number(ev.target.value) })}
                                  className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm text-white focus:border-accent focus:outline-none"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleConfirm}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Bestätigen & speichern
                  </button>
                </div>
              )}

              {confirmed && events.length > 0 && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                  <p className="text-sm text-green-400">✓ Markierungen bestätigt und gespeichert.</p>
                </div>
              )}

              {/* Gelieferte Artikel – manuell korrigierbar */}
              <div className="rounded-xl border border-border bg-surface-elevated p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Gelieferte Artikel</h3>
                    <p className="mt-1 text-xs text-muted">
                      KI-Erkennung. Stimmt ein Name oder eine Menge nicht? Tippe auf „Bearbeiten" und korrigiere es direkt.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!confirmed && (
                      <span className="text-xs text-orange-300">Erst Markierungen oben bestätigen</span>
                    )}
                    {tableSaved && !editTable && confirmed && (
                      <span className="text-xs text-green-400">✓ gespeichert</span>
                    )}
                    {confirmed && (editTable ? (
                      <button
                        onClick={saveTable}
                        disabled={savingTable}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        {savingTable ? "Speichert…" : "Korrekturen speichern"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditTable(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-accent/50"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                        </svg>
                        Bearbeiten
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 text-left font-medium text-muted">Artikel</th>
                        <th className="pb-3 text-left font-medium text-muted w-24">Menge</th>
                        <th className="pb-3 text-left font-medium text-muted w-32">Größe</th>
                        {editTable && <th className="pb-3 w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {results.gelieferte_artikel?.map((item, index) => (
                        <tr key={index} className="border-b border-border last:border-0">
                          {editTable ? (
                            <>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  value={item.artikel}
                                  onChange={(e) => updateGeliefertItem(index, { artikel: e.target.value })}
                                  className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-white focus:border-accent focus:outline-none"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.menge}
                                  onChange={(e) => updateGeliefertItem(index, { menge: Number(e.target.value) })}
                                  className="w-20 rounded-md border border-border bg-surface px-2 py-1.5 text-white focus:border-accent focus:outline-none"
                                />
                              </td>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  value={item.groesse || ""}
                                  onChange={(e) => updateGeliefertItem(index, { groesse: e.target.value })}
                                  className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-white focus:border-accent focus:outline-none"
                                />
                              </td>
                              <td className="py-2 text-right">
                                <button
                                  onClick={() => removeGeliefertItem(index)}
                                  title="Position entfernen"
                                  className="rounded-md p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 text-white">{item.artikel}</td>
                              <td className="py-3 text-white">{item.menge}</td>
                              <td className="py-3 text-white">{item.groesse}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {editTable && (
                  <button
                    onClick={addGeliefertItem}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-white"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Position hinzufügen
                  </button>
                )}
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
                            const matchingPfand = pfandData?.artikel.find(
                              (p) =>
                                p.name.toLowerCase() ===
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
              href={buildNextUrl("/lieferung/pfand")}
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
            {events.length > 0 && !confirmed ? (
              <button
                disabled
                title="Bitte zuerst die handschriftlichen Markierungen bestätigen"
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-accent/40 px-6 py-3 text-sm font-semibold text-white/70"
              >
                Erst Markierungen bestätigen
              </button>
            ) : pages.length > 0 && !results ? (
              <button
                disabled
                title="Bitte zuerst den Lieferschein mit der KI analysieren"
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-accent/40 px-6 py-3 text-sm font-semibold text-white/70"
              >
                Erst analysieren
              </button>
            ) : (
              <a
                href={buildNextUrl("/lieferung/abgleich")}
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

export default function LieferscheinPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>}>
      <LieferscheinPageContent />
    </Suspense>
  );
}
