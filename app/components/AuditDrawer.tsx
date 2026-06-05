"use client";

import { useEffect } from "react";
import { AuditLogEintrag, TeamMitglied } from "../../lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// AuditDrawer – Slide-over mit dem Aktivitaetsprotokoll eines Mitarbeiters.
// Zeigt eine vertikale Timeline aller GoBD-Audit-Eintraege, gruppiert nach Tag.
// ─────────────────────────────────────────────────────────────────────────────

type Tone = "green" | "orange" | "purple" | "red" | "blue" | "slate";

const TONE_CLASSES: Record<Tone, string> = {
  green: "bg-green-500/15 text-green-300 ring-green-500/30",
  orange: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  purple: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
  red: "bg-red-500/15 text-red-300 ring-red-500/30",
  blue: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  slate: "bg-white/[0.06] text-muted ring-white/10",
};

function meta(aktion: string): { label: string; tone: Tone; icon: string } {
  switch (aktion) {
    case "freigabe": return { label: "Lieferung freigegeben", tone: "green", icon: "check" };
    case "reklamation": return { label: "Reklamation gesendet", tone: "orange", icon: "mail" };
    case "passwort_geaendert": return { label: "Passwort geändert", tone: "slate", icon: "key" };
    case "chef_angelegt": return { label: "Chef angelegt", tone: "purple", icon: "user" };
    case "anfrage_angenommen": return { label: "Mitarbeiter-Anfrage angenommen", tone: "green", icon: "user" };
    case "anfrage_abgelehnt": return { label: "Mitarbeiter-Anfrage abgelehnt", tone: "red", icon: "user" };
    default: return { label: aktion, tone: "slate", icon: "dot" };
  }
}

function Icon({ name }: { name: string }) {
  const common = { className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", strokeWidth: 2, stroke: "currentColor" } as const;
  switch (name) {
    case "check":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>;
    case "mail":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>;
    case "key":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" /></svg>;
    case "user":
      return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="4" /></svg>;
  }
}

function relTime(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `vor ${days} Tag${days > 1 ? "en" : ""}`;
  return new Date(iso).toLocaleDateString("de-DE");
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Heute";
  if (same(d, yest)) return "Gestern";
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function chips(e: AuditLogEintrag): string[] {
  const d = e.details || {};
  const out: string[] = [];
  if (d.lieferant) out.push(String(d.lieferant));
  if (typeof d.ersparnis_eur === "number" && d.ersparnis_eur > 0.005)
    out.push(`Ersparnis ${d.ersparnis_eur.toFixed(2).replace(".", ",")} €`);
  const mengen = d.anzahl_abweichungen ?? d.anzahl_mengenabweichungen;
  if (mengen) out.push(`${mengen} Mengenabweichung${mengen > 1 ? "en" : ""}`);
  if (d.anzahl_preisabweichungen) out.push(`${d.anzahl_preisabweichungen} Preisabweichung${d.anzahl_preisabweichungen > 1 ? "en" : ""}`);
  if (d.rechnungs_nummer) out.push(`Rg. ${d.rechnungs_nummer}`);
  if (d.empfaenger) out.push(`an ${d.empfaenger}`);
  if (d.mit_pdf_anhang) out.push("PDF-Anhang");
  if (d.rechnung_quelle) out.push(String(d.rechnung_quelle));
  return out;
}

function buildGroups(entries: AuditLogEintrag[]): { label: string; items: AuditLogEintrag[] }[] {
  const groups: { label: string; items: AuditLogEintrag[] }[] = [];
  for (const e of entries) {
    const label = dayLabel(e.erstellt_am);
    let g = groups.find((x) => x.label === label);
    if (!g) { g = { label, items: [] }; groups.push(g); }
    g.items.push(e);
  }
  return groups;
}

export default function AuditDrawer({
  member, entries, loading, onClose,
}: {
  member: TeamMitglied | null;
  entries: AuditLogEintrag[];
  loading: boolean;
  onClose: () => void;
}) {
  const open = !!member;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const groups = buildGroups(entries);
  const initials = (member?.vorname || "?").slice(0, 2).toUpperCase();

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0a0a0f] shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-sm font-semibold text-blue-300">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{member?.vorname || "Unbekannt"}</p>
            <p className="text-xs text-muted">{member?.role === "chef" ? "Chef" : "Mitarbeiter"} · Aktivitätsprotokoll</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Schließen"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-muted">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white">Noch keine Aktivität</p>
              <p className="mt-1 text-xs text-muted">Sobald dieser Mitarbeiter Lieferungen freigibt<br />oder Reklamationen sendet, erscheint es hier.</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mb-6 last:mb-0">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.label}</p>
                <div className="space-y-4">
                  {g.items.map((e) => {
                    const m = meta(e.aktion);
                    const cs = chips(e);
                    const notiz = e.details?.notiz as string | undefined;
                    const link = e.entity_type === "lieferung" && e.entity_id ? `/lieferung/detail?id=${e.entity_id}` : null;
                    return (
                      <div key={e.id} className="flex gap-3">
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ring-1 ${TONE_CLASSES[m.tone]}`}>
                          <Icon name={m.icon} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-medium text-white">{m.label}</p>
                            <span className="flex-shrink-0 text-[11px] text-muted" title={new Date(e.erstellt_am).toLocaleString("de-DE")}>
                              {relTime(e.erstellt_am)}
                            </span>
                          </div>
                          {cs.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {cs.map((c, i) => (
                                <span key={i} className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] text-muted">{c}</span>
                              ))}
                            </div>
                          )}
                          {notiz && (
                            <p className="mt-2 rounded-md border-l-2 border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs italic text-muted">„{notiz}"</p>
                          )}
                          {link && (
                            <a href={link} className="mt-2 inline-block text-[11px] text-blue-300 transition-colors hover:text-blue-200">Lieferung ansehen →</a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
