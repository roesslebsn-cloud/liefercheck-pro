"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import { getLieferungById, deleteLieferung, getUserRole, normalizeArtikelKey } from "../../../lib/database";

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

  useEffect(() => {
    if (id) { loadLieferung(id); getUserRole().then(setUserRole); }
  }, [id]);

  const loadLieferung = async (lid: string) => {
    try { setLieferung(await getLieferungById(lid)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try { await deleteLieferung(id); router.push("/dashboard"); }
    finally { setDeleting(false); setShowDelete(false); }
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
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <header className="sticky top-0 z-10 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
              Zurück
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold">Lieferung #{id?.slice(0,8)}</p>
              <p className="text-[11px] text-white/30">{fmt(lieferung.erstellt_am)}</p>
            </div>
            {isChef ? (
              <button onClick={() => setShowDelete(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                Löschen
              </button>
            ) : <div className="w-20" />}
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-4">
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
