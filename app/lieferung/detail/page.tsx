"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import AppHeader from "../../components/AppHeader";
import { getLieferungById, deleteLieferung, getUserRole, normalizeArtikelKey, getLieferanten, logAudit, getLetzterAuditEintrag } from "../../../lib/database";

function LieferungDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [lieferung, setLieferung] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userRole, setUserRole] = useState<"chef" | "mitarbeiter">("mitarbeiter");
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [datevLoading, setDatevLoading] = useState(false);
  const [showReklamation, setShowReklamation] = useState(false);
  const [reklamationEmail, setReklamationEmail] = useState("");
  const [reklamationZusatz, setReklamationZusatz] = useState("");
  const [reklamationSending, setReklamationSending] = useState(false);
  const [reklamationSent, setReklamationSent] = useState(false);
  const [lieferantEmail, setLieferantEmail] = useState("");
  const [reklamationGesendetAm, setReklamationGesendetAm] = useState<string | null>(null);

  useEffect(() => {
    if (id) { loadLieferung(id); getUserRole().then(setUserRole); }
  }, [id]);

  const loadLieferung = async (lid: string) => {
    try {
      const data = await getLieferungById(lid);
      setLieferung(data);
      if (data?.lieferant_id) {
        getLieferanten().then(list => {
          const l = list.find(x => x.id === data.lieferant_id);
          if (l?.email) setLieferantEmail(l.email);
        }).catch(() => {});
      }
      // Prüfen ob bereits eine Reklamation gesendet wurde (Audit-Log)
      getLetzterAuditEintrag(lid, "reklamation").then(eintrag => {
        if (eintrag) setReklamationGesendetAm(eintrag.erstellt_am);
      }).catch(() => {});
    }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try { await deleteLieferung(id); router.push("/dashboard"); }
    finally { setDeleting(false); setShowDelete(false); }
  };

  const handleExportPDF = async () => {
    if (!lieferung) return;
    setPdfLoading(true);
    try {
      const res = await fetch("/api/pdf-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lieferung }),
      });
      if (!res.ok) throw new Error("PDF-Fehler");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lieferbericht-${(lieferung.id || "").slice(0,8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("PDF-Export fehlgeschlagen");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleReklamation = async () => {
    if (!reklamationEmail || !lieferung) return;
    setReklamationSending(true);
    try {
      // PDF-Lieferbericht für Anhang generieren (best-effort)
      let pdfBase64: string | null = null;
      try {
        const pdfRes = await fetch("/api/pdf-export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lieferung }),
        });
        if (pdfRes.ok) {
          const blob = await pdfRes.blob();
          pdfBase64 = await blobToBase64(blob);
        }
      } catch {
        // PDF optional – E-Mail wird auch ohne Anhang gesendet
      }

      const res = await fetch("/api/reklamation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lieferung,
          empfaengerEmail: reklamationEmail,
          zusatzText: reklamationZusatz,
          pdfBase64,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "E-Mail-Versand fehlgeschlagen");
      }

      // GoBD: Reklamation ins Audit-Log
      const anzahlMengen = lieferung.abgleich_data?.abgleich?.filter((a: any) => a.status !== "ok").length || 0;
      const anzahlPreise = lieferung.rechnung_data?.preisabweichungen?.length || 0;
      await logAudit("reklamation", "lieferung", lieferung.id, {
        empfaenger: reklamationEmail,
        anzahl_mengenabweichungen: anzahlMengen,
        anzahl_preisabweichungen: anzahlPreise,
        rechnungs_nummer: lieferung.rechnung_data?.rechnungs_nummer || null,
        mit_pdf_anhang: !!pdfBase64,
      });
      setReklamationGesendetAm(new Date().toISOString());
      setReklamationSent(true);
      setTimeout(() => { setShowReklamation(false); setReklamationSent(false); }, 2000);
    } catch (e: any) {
      alert("E-Mail-Versand fehlgeschlagen: " + (e?.message || "Unbekannter Fehler"));
    } finally {
      setReklamationSending(false);
    }
  };

  const handleExportDATEV = async () => {
    if (!lieferung) return;
    setDatevLoading(true);
    try {
      const res = await fetch("/api/datev-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lieferung }),
      });
      if (!res.ok) throw new Error("DATEV-Fehler");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `datev-${(lieferung.id || "").slice(0,8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("DATEV-Export fehlgeschlagen");
    } finally {
      setDatevLoading(false);
    }
  };

  const fmt = (d: string) => !d ? "-" : new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const getPreisabweichungen = () => {
    const r = lieferung?.rechnung_data;
    const l = lieferung?.lieferschein_data;
    if (!r?.positionen || !l?.gelieferte_artikel) return [];
    return r.positionen.map((pos: any) => {
      const rKey = normalizeArtikelKey(pos.artikel);
      const lPos = l.gelieferte_artikel.find((x: any) => normalizeArtikelKey(x.artikel) === rKey);
      if (!lPos) return null;
      const rP = pos.einzelpreis ?? pos.preis ?? 0;
      const lP = lPos.einzelpreis ?? lPos.preis ?? 0;
      if (lP > 0 && Math.abs(rP - lP) > 0.01) return { artikel: pos.artikel, altPreis: lP, neuPreis: rP, differenz: rP - lP, menge: pos.menge ?? lPos.menge ?? 1 };
      return null;
    }).filter(Boolean);
  };

  const exportCSV = () => {
    const rows = getPreisabweichungen();
    if (!rows.length) return;
    const csv = ["Artikel;Alter Preis;Neuer Preis;Differenz;Menge", ...rows.map((a: any) => `${a.artikel};${a.altPreis.toFixed(2)};${a.neuPreis.toFixed(2)};${a.differenz.toFixed(2)};${a.menge}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `preise_${id?.slice(0,8)}.csv`;
    a.click();
  };

  const copyList = () => {
    const rows = getPreisabweichungen();
    if (!rows.length) return;
    const text = rows.map((a: any) => `- ${a.artikel}: ${a.altPreis.toFixed(2)} EUR -> ${a.neuPreis.toFixed(2)} EUR`).join("\n");
    navigator.clipboard.writeText("Preise aktualisieren:\n\n" + text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <AuthGuard>
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    </AuthGuard>
  );

  if (!lieferung) return (
    <AuthGuard>
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <p className="text-white/40">Lieferung nicht gefunden.</p>
      </div>
    </AuthGuard>
  );

  const preisabweichungen = getPreisabweichungen();
  const abgleich = lieferung.abgleich_data?.abgleich ?? [];
  const isChef = userRole === "chef";

  const steps = [
    {
      n: 1, label: "Pfandliste", icon: "📦",
      done: !!lieferung.pfand_items,
      editPath: `/lieferung/pfand`,
      content: lieferung.pfand_items ? (
        <div className="space-y-1.5">
          {lieferung.pfand_items.artikel?.map((a: any, i: number) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
              <span className="text-sm text-white/70">{a.name}</span>
              <span className="text-sm font-semibold text-white/40">{a.menge}x</span>
            </div>
          ))}
          {(!lieferung.pfand_items.artikel || lieferung.pfand_items.artikel.length === 0) && (
            <p className="text-sm text-white/30 italic">Kein Pfand erfasst</p>
          )}
        </div>
      ) : <p className="text-sm text-white/30 italic">Schritt nicht abgeschlossen</p>
    },
    {
      n: 2, label: "Lieferschein", icon: "📄",
      done: !!lieferung.lieferschein_data,
      editPath: `/lieferung/lieferschein`,
      content: lieferung.lieferschein_data ? (
        <div className="space-y-1.5">
          <p className="text-xs text-white/30 mb-3">Gelieferte Artikel</p>
          {lieferung.lieferschein_data.gelieferte_artikel?.map((a: any, i: number) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
              <span className="text-sm text-white/70">{a.artikel}</span>
              <span className="text-sm text-white/40">{a.menge}x {a.groesse}</span>
            </div>
          ))}
          {lieferung.lieferschein_data.nicht_geliefert?.length > 0 && (
            <>
              <p className="text-xs text-white/30 mt-4 mb-2">Nicht geliefert</p>
              {lieferung.lieferschein_data.nicht_geliefert.map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-red-500/5 border border-red-500/10 px-4 py-3">
                  <span className="text-sm text-white/70">{a.artikel}</span>
                  <span className="text-xs text-red-400">{a.grund}</span>
                </div>
              ))}
            </>
          )}
        </div>
      ) : <p className="text-sm text-white/30 italic">Schritt nicht abgeschlossen</p>
    },
    {
      n: 3, label: "Abgleich", icon: "⚖️",
      done: !!lieferung.abgleich_data,
      editPath: `/lieferung/abgleich`,
      content: abgleich.length > 0 ? (
        <div className="space-y-1.5">
          {abgleich.map((item: any, i: number) => (
            <div key={i} className={"flex items-center justify-between rounded-lg px-4 py-3 " + (item.status === "ok" ? "bg-white/5" : "bg-red-500/5 border border-red-500/10")}>
              <span className="text-sm text-white/70">{item.artikel}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/30">{item.geliefert}/{item.bestellt}</span>
                <span className={"text-xs font-semibold " + (item.status === "ok" ? "text-emerald-400" : "text-red-400")}>
                  {item.status === "ok" ? "OK" : (item.abweichung > 0 ? "+" : "") + item.abweichung}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-white/30 italic">Schritt nicht abgeschlossen</p>
    },
    {
      n: 4, label: "Rechnung", icon: "🧾",
      done: !!lieferung.rechnung_data,
      editPath: `/lieferung/rechnung`,
      content: lieferung.rechnung_data ? (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[["Lieferant", lieferung.rechnung_data.lieferant], ["Rechnungsnr.", lieferung.rechnung_data.rechnungs_nummer], ["Datum", lieferung.rechnung_data.datum], ["Netto", lieferung.rechnung_data.netto ? "EUR " + lieferung.rechnung_data.netto.toFixed(2) : "-"], ["MwSt", lieferung.rechnung_data.mwst ? "EUR " + lieferung.rechnung_data.mwst.toFixed(2) : "-"], ["Brutto", lieferung.rechnung_data.brutto ? "EUR " + lieferung.rechnung_data.brutto.toFixed(2) : "-"]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/5 px-3 py-2">
                <p className="text-[10px] text-white/30 mb-0.5">{k}</p>
                <p className="text-sm text-white/70">{v || "-"}</p>
              </div>
            ))}
          </div>
          {lieferung.rechnung_data.positionen?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-white/30 mb-2">Positionen</p>
              {lieferung.rechnung_data.positionen.map((pos: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                  <span className="text-sm text-white/70">{pos.artikel}</span>
                  <span className="text-xs text-white/40">{pos.menge}x {pos.einzelpreis ? "EUR " + pos.einzelpreis.toFixed(2) : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : <p className="text-sm text-white/30 italic">Schritt nicht abgeschlossen</p>
    },
    {
      n: 5, label: "Freigabe", icon: "✅",
      done: !!lieferung.freigabe_erteilt,
      editPath: `/lieferung/freigabe`,
      content: (
        <div className="text-sm text-white/70">
          {lieferung.freigabe_erteilt ? "Lieferung wurde freigegeben." : "Freigabe noch ausstehend."}
          {lieferung.notiz && <p className="mt-2 text-white/40 italic">{lieferung.notiz}</p>}
        </div>
      )
    }
  ];

  return (
    <AuthGuard>
      <div className="min-h-screen relative">
        <div className="aurora-bg" />
        <AppHeader />

        <main className="mx-auto max-w-[1000px] px-5 sm:px-8 pt-10 pb-20 space-y-5 relative">
          <div className="flex items-center justify-between gap-4 mb-2 reveal">
            <button onClick={() => router.push("/dashboard")} className="btn-ghost">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Zurück
            </button>
            <div className="text-center min-w-0">
              <p className="text-[14px] font-semibold text-white truncate">Lieferung #{id?.slice(0,8)}</p>
              <p className="text-[11px] text-muted">{fmt(lieferung.erstellt_am)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExportPDF} disabled={pdfLoading} className="btn-secondary" title="Als PDF speichern">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                </svg>
                {pdfLoading ? "Generiere…" : "PDF"}
              </button>
              {lieferung?.status === "abgeschlossen" && lieferung?.rechnung_data && (
                <button onClick={handleExportDATEV} disabled={datevLoading} className="btn-secondary" title="DATEV EXTF exportieren">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {datevLoading ? "Exportiere…" : "DATEV"}
                </button>
              )}
              {lieferung?.status === "abgeschlossen" && (
                (lieferung?.abgleich_data?.abgleich?.some((a: any) => a.status !== "ok") ||
                 lieferung?.rechnung_data?.preisabweichungen?.length > 0) && (
                  <button
                    onClick={() => {
                      setReklamationEmail(lieferantEmail || "");
                      setShowReklamation(true);
                    }}
                    className={reklamationGesendetAm ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12.5px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all inline-flex items-center gap-1.5" : "btn-secondary"}
                    title={reklamationGesendetAm ? `Bereits reklamiert am ${fmt(reklamationGesendetAm)}` : "Reklamations-E-Mail senden"}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      {reklamationGesendetAm
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />}
                    </svg>
                    {reklamationGesendetAm ? "Reklamiert" : "Reklamation"}
                  </button>
                )
              )}
              {isChef && (
                <button onClick={() => setShowDelete(true)}
                  className="rounded-md border border-red-500/30 px-3 py-1.5 text-[12.5px] font-medium text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all">
                  Löschen
                </button>
              )}
            </div>
          </div>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Ersparnis", value: lieferung.ersparnis_eur != null ? "EUR " + Number(lieferung.ersparnis_eur).toFixed(2) : "-", green: true },
              { label: "Abweichungen", value: String(abgleich.filter((a: any) => a.status !== "ok").length) },
              { label: "Artikel", value: String(lieferung.lieferschein_data?.gelieferte_artikel?.length ?? "-") },
              { label: "Rechnungsbetrag", value: lieferung.rechnung_data?.brutto ? "EUR " + lieferung.rechnung_data.brutto.toFixed(2) : "-" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-[11px] text-white/30 mb-1">{s.label}</p>
                <p className={"text-lg font-bold " + (s.green ? "text-emerald-400" : "text-white")}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Preisabweichungen */}
          {preisabweichungen.length > 0 && (
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-orange-400 text-sm">Preise aktualisieren</span>
                    <span className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-400">{preisabweichungen.length}</span>
                  </div>
                  <p className="text-xs text-white/30">Diese Artikel haben neue Preise auf der Rechnung.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={copyList} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors">
                    {copied ? "Kopiert!" : "Kopieren"}
                  </button>
                  <button onClick={exportCSV} className="rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-400 hover:bg-orange-500/30 transition-colors">CSV</button>
                </div>
              </div>
              <div className="space-y-2">
                {preisabweichungen.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-black/20 px-4 py-3">
                    <span className="text-sm text-white/70">{a.artikel}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/30 line-through">{a.altPreis.toFixed(2)}</span>
                      <span className="text-sm font-semibold text-orange-400">{a.neuPreis.toFixed(2)} EUR</span>
                      <span className={"text-[11px] font-semibold " + (a.differenz > 0 ? "text-red-400" : "text-emerald-400")}>
                        {a.differenz > 0 ? "+" : ""}{a.differenz.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step cards - clickable */}
          <div className="space-y-2">
            {steps.map(step => (
              <div key={step.n} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setOpenStep(openStep === step.n ? null : step.n)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={"flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold " + (step.done ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/30")}>
                      {step.done ? "✓" : step.n}
                    </span>
                    <span className="text-sm font-medium text-white">{step.label}</span>
                    {!step.done && <span className="text-[10px] text-white/25">Nicht abgeschlossen</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {isChef && step.done && (
                      <a
                        href={step.editPath}
                        onClick={e => e.stopPropagation()}
                        className="rounded-md bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        Bearbeiten
                      </a>
                    )}
                    <svg className={"h-4 w-4 text-white/30 transition-transform " + (openStep === step.n ? "rotate-180" : "")} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>
                {openStep === step.n && (
                  <div className="px-5 pb-4 border-t border-white/5 pt-4">
                    {step.content}
                    {isChef && (
                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                        <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                        <span className="text-[11px] text-blue-400">Chef: Du kannst diesen Schritt über "Bearbeiten" ändern</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>

        {showReklamation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111116] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Reklamations-E-Mail senden</h3>
                <button onClick={() => setShowReklamation(false)} className="text-white/30 hover:text-white transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {reklamationGesendetAm && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 mb-4 text-xs text-emerald-400">
                  Bereits reklamiert am {fmt(reklamationGesendetAm)}. Erneutes Senden möglich.
                </div>
              )}

              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 mb-4 text-xs text-white/40">
                <p className="text-white/60 mb-1">Folgende Abweichungen werden gemeldet:</p>
                {lieferung?.abgleich_data?.abgleich?.filter((a: any) => a.status !== "ok").length > 0 && (
                  <p>• {lieferung.abgleich_data.abgleich.filter((a: any) => a.status !== "ok").length} Mengenabweichung(en)</p>
                )}
                {lieferung?.rechnung_data?.preisabweichungen?.length > 0 && (
                  <p>• {lieferung.rechnung_data.preisabweichungen.length} Preisabweichung(en)</p>
                )}
                <p className="mt-1.5 text-white/30">Der PDF-Lieferbericht wird automatisch angehängt.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Empfänger E-Mail *</label>
                  <input
                    type="email"
                    value={reklamationEmail}
                    onChange={(e) => setReklamationEmail(e.target.value)}
                    placeholder="lieferant@beispiel.de"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Zusatztext (optional)</label>
                  <textarea
                    value={reklamationZusatz}
                    onChange={(e) => setReklamationZusatz(e.target.value)}
                    placeholder="Bitte prüfen und bis Freitag zurückmelden..."
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 focus:outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowReklamation(false)} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors">
                  Abbrechen
                </button>
                <button
                  onClick={handleReklamation}
                  disabled={reklamationSending || !reklamationEmail || reklamationSent}
                  className="flex-1 rounded-lg bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {reklamationSent ? "Gesendet ✓" : reklamationSending ? "Sende..." : "E-Mail senden"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111116] p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-white mb-1">Lieferung löschen?</h3>
              <p className="text-sm text-white/40 mb-6">Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDelete(false)} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors">Abbrechen</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                  {deleting ? "Löschen..." : "Ja, löschen"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

export default function LieferungDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    }>
      <LieferungDetailContent />
    </Suspense>
  );
}
