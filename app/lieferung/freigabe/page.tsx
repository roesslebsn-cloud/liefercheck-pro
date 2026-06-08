"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import ProgressBar from "../../components/ProgressBar";
import { getLieferungById, updateLieferung, calculateErsparnis } from "../../../lib/database";
import { supabase } from "../../../lib/supabase";

function FreigabePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lieferungId = searchParams.get("id");
  const lieferdatum = searchParams.get("date");
  const [notiz, setNotiz] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [currentLieferung, setCurrentLieferung] = useState<any>(null);
  const lastLieferung: any = null; // comparison with previous delivery removed
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abgleichData, setAbgleichData] = useState<any>(null);
  const [lieferscheinData, setLieferscheinData] = useState<any>(null);
  const [rechnungData, setRechnungData] = useState<any>(null);
  const [pfandItems, setPfandItems] = useState<any>(null);
  const [correctionsChecked, setCorrectionsChecked] = useState<boolean[]>([]);

  // Helper function to normalize artikel names for matching
  const normalizeArtikelKey = (name: string): string => {
    if (!name) return "";
    let s = name.toLowerCase();
    s = s.replace(/\([^)]*\)/g, " ");
    s = s.replace(/keg-anschluss|keg|anschluss/g, " ");
    s = s.replace(/,/g, ".");
    const sizeMatch = s.match(/(\d+\.?\d*)\s*l/);
    const size = sizeMatch ? sizeMatch[1] + "l" : "";
    s = s.replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
    const words = s.split(" ").filter(w => !/^\d+\.?\d*l?$/.test(w));
    const base = words.slice(0, 2).join(" ");
    return (base + " " + size).trim();
  };

  useEffect(() => {
    if (lieferungId) {
      getLieferungById(lieferungId).then((lieferung) => {
        if (lieferung) {
          setCurrentLieferung(lieferung);
          if (lieferung.abgleich_data) setAbgleichData(lieferung.abgleich_data);
          if (lieferung.lieferschein_data) setLieferscheinData(lieferung.lieferschein_data);
          if (lieferung.rechnung_data) setRechnungData(lieferung.rechnung_data);
          if (lieferung.pfand_items) setPfandItems(lieferung.pfand_items);
        }
      }).catch(console.error).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [lieferungId]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files));
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFreigabe = async () => {
    if (!lieferungId) {
      setError("Lieferung ID fehlt. Bitte starten Sie den Prozess neu.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ersparnis = calculateErsparnis(rechnungData, lieferscheinData, abgleichData);

      await updateLieferung(lieferungId, {
        status: "abgeschlossen",
        notiz: notiz,
        ersparnis_eur: ersparnis,
        freigabe_erteilt: true,
        freigabe_am: new Date().toISOString()
      });

      // Audit-Log – non-blocking (Tabelle existiert ggf. noch nicht)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const anzahlAbweichungen = abgleichData?.abgleich?.filter((i: any) => i.status !== "ok").length || 0;
        const anzahlPreisabweichungen = rechnungData?.preisabweichungen?.length || 0;
        const rechnungsQuelle = rechnungData?.xrechnung ? (rechnungData.format || "ZUGFeRD") : "KI-Analyse";
        await supabase.from("audit_log").insert({
          user_id: user?.id,
          user_email: user?.email,
          aktion: "freigabe",
          entity_type: "lieferung",
          entity_id: lieferungId,
          details: {
            ersparnis_eur: ersparnis,
            notiz: notiz,
            anzahl_abweichungen: anzahlAbweichungen,
            anzahl_preisabweichungen: anzahlPreisabweichungen,
            rechnung_quelle: rechnungsQuelle,
            rechnungs_nummer: rechnungData?.rechnungs_nummer || null,
            lieferant: rechnungData?.lieferant || null,
            freigabe_zeitpunkt: new Date().toISOString(),
          }
        });
      } catch (auditErr) {
        console.warn("[Freigabe] Audit-Log fehlgeschlagen (Migration ausstehend?):", auditErr);
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("Fehler beim Freigeben der Lieferung:", error);
      setError("Fehler beim Freigeben der Lieferung. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickNote = (text: string) => {
    setNotiz((prev) => prev + (prev ? " " : "") + text);
  };

  // Generate correction instructions from abgleichData
  const getCorrectionInstructions = () => {
    if (!abgleichData || !abgleichData.abgleich) return [];
    
    return abgleichData.abgleich
      .filter((item: any) => item.status !== "ok")
      .map((item: any) => {
        switch (item.status) {
          case "abweichung":
            return `${item.artikel}: in Gastronovi von ${item.bestellt} auf ${item.geliefert} korrigieren`;
          case "nicht_geliefert":
            return `${item.artikel}: nicht geliefert, in Gastronovi auf 0 setzen oder stornieren`;
          case "nicht_bestellt":
            return `${item.artikel}: war nicht bestellt aber geliefert (${item.geliefert} Stück), in Gastronovi nachtragen`;
          default:
            return `${item.artikel}: prüfen`;
        }
      });
  };

  const correctionInstructions = getCorrectionInstructions();

  // Initialize correctionsChecked array when instructions change
  useEffect(() => {
    setCorrectionsChecked(new Array(correctionInstructions.length).fill(false));
  }, [correctionInstructions.length]);

  const handleCorrectionCheck = (index: number) => {
    setCorrectionsChecked((prev) => {
      const updated = [...prev];
      updated[index] = !updated[index];
      return updated;
    });
  };

  const handleCopyInstruction = (instruction: string) => {
    navigator.clipboard.writeText(instruction);
  };

  const handleCopyAllInstructions = () => {
    const allInstructions = correctionInstructions.join("\n");
    navigator.clipboard.writeText(allInstructions);
  };

  const completedCorrections = correctionsChecked.filter(Boolean).length;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getDifferences = () => {
    if (!lastLieferung || !currentLieferung) return [];
    const differences: string[] = [];
    
    if (lastLieferung.pfand_items && currentLieferung.pfand_items) {
      const lastPfand = lastLieferung.pfand_items.artikel || [];
      const currentPfand = currentLieferung.pfand_items.artikel || [];
      
      lastPfand.forEach((item: any) => {
        const current = currentPfand.find((c: any) => c.name === item.name);
        if (current && current.menge !== item.menge) {
          differences.push(`${item.name}: ${item.menge} → ${current.menge}`);
        }
      });
    }
    
    return differences;
  };

  const differences = getDifferences();

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

        <ProgressBar currentStep={5} lieferungId={lieferungId} lieferdatum={lieferdatum} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-muted/50 px-3 py-1 text-xs font-medium text-accent ring-1 ring-accent/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Schritt 5 von 5
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
            Zusammenfassung und Freigabe
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Überprüfen Sie alle hochgeladenen Daten und geben Sie die Lieferung frei.
          </p>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {abgleichData && abgleichData.abgleich && (
            <div className={`mt-6 rounded-xl border p-8 ${
              correctionInstructions.length === 0
                ? "border-green-500/30 bg-green-500/10"
                : "border-orange-500/30 bg-orange-500/10"
            }`}>
              <div className="flex items-center gap-4">
                {correctionInstructions.length === 0 ? (
                  <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                ) : (
                  <svg className="h-8 w-8 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                )}
                <p className={`text-xl font-semibold ${
                  correctionInstructions.length === 0 ? "text-green-400" : "text-orange-400"
                }`}>
                  {correctionInstructions.length === 0
                    ? "Bereit zum Einlagern - alles stimmt überein"
                    : `${correctionInstructions.length} Korrektur(en) nötig bevor eingelagert werden kann`
                  }
                </p>
              </div>
            </div>
          )}

          {correctionInstructions.length > 0 && (
            <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Korrekturen für Gastronovi</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted">
                    {completedCorrections} von {correctionInstructions.length} erledigt
                  </span>
                  <button
                    onClick={handleCopyAllInstructions}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-accent/50 hover:bg-surface-elevated"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                    </svg>
                    Alle kopieren
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {correctionInstructions.map((instruction: string, index: number) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 rounded-lg p-3 ${
                      correctionsChecked[index] ? "bg-green-500/10" : "bg-surface"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={correctionsChecked[index] || false}
                      onChange={() => handleCorrectionCheck(index)}
                      className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-accent"
                    />
                    <p className={`flex-1 text-sm ${
                      correctionsChecked[index] ? "line-through text-muted" : "text-white"
                    }`}>
                      {instruction}
                    </p>
                    <button
                      onClick={() => handleCopyInstruction(instruction)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-muted/50 hover:text-accent"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {correctionInstructions.length === 0 && abgleichData && abgleichData.abgleich && (
            <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
              <p className="text-sm text-green-400">Keine Korrekturen nötig - Bestellung kann direkt eingelagert werden</p>
            </div>
          )}

          <div className="mt-10 space-y-6">
            {abgleichData && abgleichData.abgleich && (
              <div className="rounded-xl border border-border bg-surface-elevated p-6">
                <h3 className="text-lg font-semibold text-white">Abweichungs-Zusammenfassung</h3>
                <p className="mt-2 text-sm text-muted">
                  Artikel mit Abweichungen zwischen Bestellung und Lieferung
                </p>
                {abgleichData.abgleich.filter((item: any) => item.status !== "ok").length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-3 text-left font-medium text-muted">Artikel</th>
                          <th className="py-3 text-right font-medium text-muted">Bestellt</th>
                          <th className="py-3 text-right font-medium text-muted">Geliefert</th>
                          <th className="py-3 text-right font-medium text-muted">Abweichung</th>
                        </tr>
                      </thead>
                      <tbody>
                        {abgleichData.abgleich
                          .filter((item: any) => item.status !== "ok")
                          .map((item: any, index: number) => (
                            <tr key={index} className="border-b border-border last:border-0">
                              <td className="py-3 text-white">{item.artikel}</td>
                              <td className="py-3 text-right text-muted">{item.bestellt}</td>
                              <td className="py-3 text-right text-muted">{item.geliefert}</td>
                              <td className={`py-3 text-right font-medium ${
                                item.abweichung < 0 ? "text-red-400" : "text-yellow-400"
                              }`}>
                                {item.abweichung > 0 ? "+" : ""}{item.abweichung}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-green-400">Keine Abweichungen gefunden</p>
                )}
              </div>
            )}

            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h3 className="text-lg font-semibold text-white">Hochgeladene Dateien</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted/50 text-accent">
                      <svg
                        className="h-5 w-5"
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
                    <div>
                      <p className="text-sm font-medium text-white">Pfandliste & Fotos</p>
                      <p className="text-xs text-muted">Schritt 1</p>
                    </div>
                  </div>
                  <span className="text-sm text-accent">Hochgeladen</span>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted/50 text-accent">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Lieferschein</p>
                      <p className="text-xs text-muted">Schritt 2</p>
                    </div>
                  </div>
                  <span className="text-sm text-accent">Hochgeladen</span>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted/50 text-accent">
                      <svg
                        className="h-5 w-5"
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
                    <div>
                      <p className="text-sm font-medium text-white">Gastronovi CSV</p>
                      <p className="text-xs text-muted">Schritt 3</p>
                    </div>
                  </div>
                  <span className="text-sm text-accent">Hochgeladen</span>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted/50 text-accent">
                      <svg
                        className="h-5 w-5"
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
                    <div>
                      <p className="text-sm font-medium text-white">PDF Rechnung</p>
                      <p className="text-xs text-muted">Schritt 4</p>
                    </div>
                  </div>
                  <span className="text-sm text-accent">Hochgeladen</span>
                </div>
              </div>
            </div>

            {rechnungData && (
              <div className="rounded-xl border border-border bg-surface-elevated p-6">
                <h3 className="text-lg font-semibold text-white">Rechnungsprüfung</h3>
                <p className="mt-2 text-sm text-muted">
                  Rechnungsdetails und Vergleich mit Lieferschein
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted">Rechnungsnummer</p>
                    <p className="text-sm font-medium text-white">{rechnungData.rechnungs_nummer || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Datum</p>
                    <p className="text-sm font-medium text-white">{rechnungData.datum || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Lieferant</p>
                    <p className="text-sm font-medium text-white">{rechnungData.lieferant || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Netto</p>
                    <p className="text-sm font-medium text-white">{rechnungData.netto ? `€${rechnungData.netto.toFixed(2)}` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">MwSt</p>
                    <p className="text-sm font-medium text-white">{rechnungData.mwst ? `€${rechnungData.mwst.toFixed(2)}` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Brutto</p>
                    <p className="text-sm font-medium text-white">{rechnungData.brutto ? `€${rechnungData.brutto.toFixed(2)}` : "-"}</p>
                  </div>
                </div>
                {rechnungData.positionen && lieferscheinData && lieferscheinData.gelieferte_artikel && (
                  <>
                    <div className="mt-6">
                      <p className="text-sm font-medium text-white mb-3">Positionsvergleich</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="py-2 text-left font-medium text-muted">Artikel</th>
                              <th className="py-2 text-right font-medium text-muted">Rechnung</th>
                              <th className="py-2 text-right font-medium text-muted">Lieferschein</th>
                              <th className="py-2 text-right font-medium text-muted">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rechnungData.positionen.map((pos: any, index: number) => {
                              const rechnungKey = normalizeArtikelKey(pos.artikel);
                              const lieferscheinPos = lieferscheinData.gelieferte_artikel.find(
                                (l: any) => normalizeArtikelKey(l.artikel) === rechnungKey
                              );
                              
                              let status: string;
                              let statusColor: string;
                              
                              if (!lieferscheinPos) {
                                status = "-";
                                statusColor = "text-gray-400";
                              } else {
                                const mengeDiff = pos.menge - lieferscheinPos.menge;
                                const hasDifference = Math.abs(mengeDiff) > 0.01;
                                status = hasDifference ? "Abweichung" : "OK";
                                statusColor = hasDifference ? "text-red-400" : "text-green-400";
                              }
                              
                              return (
                                <tr key={index} className="border-b border-border last:border-0">
                                  <td className="py-2 text-white">{pos.artikel}</td>
                                  <td className="py-2 text-right text-muted">{pos.menge}</td>
                                  <td className="py-2 text-right text-muted">{lieferscheinPos?.menge || "-"}</td>
                                  <td className={`py-2 text-right font-medium ${statusColor}`}>
                                    {status}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Geld-Ersparnis Highlight – identisch zum gespeicherten Wert */}
                    {(() => {
                      const overpaymentSum = calculateErsparnis(rechnungData, lieferscheinData, abgleichData);

                      if (overpaymentSum > 0.01) {
                        return (
                          <div className="mt-6 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                            <div className="flex items-center gap-3">
                              <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                              </svg>
                              <p className="text-lg font-semibold text-orange-400">
                                Mögliche Überzahlung erkannt: €{overpaymentSum.toFixed(2)} - bitte Rechnung vor Zahlung prüfen
                              </p>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                            <div className="flex items-center gap-3">
                              <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                              <p className="text-sm font-medium text-green-400">
                                Rechnung stimmt mit Lieferung überein - keine Überzahlung
                              </p>
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </>
                )}
              </div>
            )}

            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h3 className="text-lg font-semibold text-white">Notizen (optional)</h3>
              <p className="mt-2 text-sm text-muted">
                Fügen Sie hier zusätzliche Informationen zur Lieferung hinzu
              </p>
              
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleQuickNote("Fahrer war pünktlich ✓")}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-accent/50 hover:bg-surface-elevated"
                >
                  Fahrer war pünktlich ✓
                </button>
                <button
                  onClick={() => handleQuickNote("Ware beschädigt ⚠")}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-accent/50 hover:bg-surface-elevated"
                >
                  Ware beschädigt ⚠
                </button>
                <button
                  onClick={() => handleQuickNote("Fehlmenge notiert 📋")}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-accent/50 hover:bg-surface-elevated"
                >
                  Fehlmenge notiert 📋
                </button>
                <button
                  onClick={() => handleQuickNote("Alles korrekt ✓")}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-accent/50 hover:bg-surface-elevated"
                >
                  Alles korrekt ✓
                </button>
              </div>
              
              <textarea
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                placeholder="Notizen zur Lieferung..."
                className="mt-4 w-full rounded-lg border border-border bg-surface px-4 py-3 text-white placeholder:text-muted focus:border-accent focus:outline-none min-h-[120px]"
              />
            </div>

            {pfandItems && lieferscheinData && lieferscheinData.pfand_eintrage && (
              <div className="rounded-xl border border-border bg-surface-elevated p-6">
                <h3 className="text-lg font-semibold text-white">Pfand-Saldo</h3>
                <p className="mt-2 text-sm text-muted">
                  Vergleich zwischen mitgegebenem Pfand und laut Fahrer
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 text-left font-medium text-muted">Artikel</th>
                        <th className="py-2 text-right font-medium text-muted">Mitgegeben</th>
                        <th className="py-2 text-right font-medium text-muted">Laut Fahrer</th>
                        <th className="py-2 text-right font-medium text-muted">Differenz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pfandItems.artikel.map((pfand: any, index: number) => {
                        const fahrerEintrag = lieferscheinData.pfand_eintrage.find(
                          (f: any) => f.artikel.toLowerCase() === pfand.name.toLowerCase()
                        );
                        const differenz = fahrerEintrag ? pfand.menge - fahrerEintrag.menge : pfand.menge;
                        const hasDifference = Math.abs(differenz) > 0;
                        return (
                          <tr key={index} className="border-b border-border last:border-0">
                            <td className="py-2 text-white">{pfand.name}</td>
                            <td className="py-2 text-right text-muted">{pfand.menge}</td>
                            <td className="py-2 text-right text-muted">{fahrerEintrag?.menge || "-"}</td>
                            <td className={`py-2 text-right font-medium ${
                              hasDifference ? "text-red-400" : "text-green-400"
                            }`}>
                              {hasDifference ? differenz : "0"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-surface-elevated p-6">
              <h3 className="text-lg font-semibold text-white">Fotos hochladen (optional)</h3>
              <p className="mt-2 text-sm text-muted">
                Fügen Sie Fotos von Abweichungen oder der Lieferung hinzu
              </p>
              <div className="mt-4">
                <input
                  type="file"
                  id="freigabe-photos"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <label
                  htmlFor="freigabe-photos"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-white transition-colors hover:border-accent/50 cursor-pointer"
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
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  Fotos auswählen
                </label>
              </div>
              {photos.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {photos.map((photo, index) => (
                    <div
                      key={index}
                      className="relative rounded-lg bg-surface p-3"
                    >
                      <p className="text-sm text-muted truncate">{photo.name}</p>
                      <button
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-500/20 hover:text-red-400"
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
              )}
            </div>

            {differences.length > 0 && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-6">
                <h3 className="text-lg font-semibold text-white">
                  Vergleich mit letzter Lieferung
                </h3>
                <p className="mt-2 text-sm text-muted">
                  Unterschiede zur Lieferung vom {formatDate(lastLieferung.created_at)}
                </p>
                <div className="mt-4 space-y-2">
                  {differences.map((diff, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-yellow-400">
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
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                        />
                      </svg>
                      {diff}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-accent/30 bg-accent-muted/20 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-accent-muted/50 text-accent">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-1.013A6.002 6.002 0 0 0 12 9.75a6.002 6.002 0 0 0-1.5 1.013A6.01 6.01 0 0 0 12 12.75Zm0 0c-2.25 0-4.5-1.5-4.5-4.5 0-3 2.25-4.5 4.5-4.5 2.25 0 4.5 1.5 4.5 4.5 0 3-2.25 4.5-4.5 4.5Z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Bereit für die KI-Analyse
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    Nach der Freigabe werden alle Dateien analysiert und Abweichungen automatisch erkannt.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <a
              href={lieferungId ? `/lieferung/rechnung?id=${lieferungId}${lieferdatum ? `&date=${lieferdatum}` : ""}` : "/lieferung/rechnung"}
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
            <button
              onClick={handleFreigabe}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  Speichern...
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5"
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
                  Lieferung freigeben
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

export default function FreigabePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>}>
      <FreigabePageContent />
    </Suspense>
  );
}
