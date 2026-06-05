"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminClient";

type Ankuendigung = { ankuendigung_text: string | null; ankuendigung_aktiv: boolean; ankuendigung_typ: "info" | "warnung" | "wartung" };

const TYP_STYLE: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  info: { bg: "rgba(91,108,255,0.1)", fg: "var(--accent)", border: "rgba(91,108,255,0.3)", label: "Info" },
  warnung: { bg: "rgba(245,158,11,0.1)", fg: "#f59e0b", border: "rgba(245,158,11,0.3)", label: "Warnung" },
  wartung: { bg: "rgba(239,68,68,0.1)", fg: "var(--red)", border: "rgba(239,68,68,0.3)", label: "Wartung" },
};

const FEATURES = [
  { label: "Analyse-Seite", hint: "Statistiken & Auswertungen (/analytics)" },
  { label: "E-Rechnung (XML)", hint: "XRechnung/ZUGFeRD-Import im Rechnungs-Schritt" },
  { label: "Mehrere Standorte", hint: "Filial-Verwaltung & Standort-Filter" },
  { label: "Team-Verwaltung", hint: "Mitarbeiter einladen & verwalten" },
];

export default function AdminPlattformPage() {
  const [a, setA] = useState<Ankuendigung>({ ankuendigung_text: "", ankuendigung_aktiv: false, ankuendigung_typ: "info" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await adminFetch<Ankuendigung>("/api/admin/announcement");
        setA({ ankuendigung_text: data.ankuendigung_text || "", ankuendigung_aktiv: !!data.ankuendigung_aktiv, ankuendigung_typ: data.ankuendigung_typ || "info" });
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true); setErr(null); setSaved(false);
    try {
      await adminFetch("/api/admin/announcement", { method: "PUT", body: JSON.stringify(a) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const ts = TYP_STYLE[a.ankuendigung_typ];

  return (
    <>
      <div className="mb-6 reveal">
        <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-white">Plattform</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">Globaler Ankündigungs-Banner und Feature-Übersicht.</p>
      </div>

      {err && <div className="mb-6 rounded-lg p-4 text-sm" style={{ background: "var(--red-muted)", color: "var(--red)" }}>{err}</div>}

      {/* Ankündigungs-Banner */}
      <div className="rounded-xl p-5 sm:p-6 mb-6" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-inset)" }}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Ankündigungs-Banner</h2>
            <p className="text-[12px] text-muted mt-0.5">Wird allen Kunden oben im Dashboard angezeigt.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[12px] text-muted">{a.ankuendigung_aktiv ? "Aktiv" : "Inaktiv"}</span>
            <button type="button" onClick={() => setA({ ...a, ankuendigung_aktiv: !a.ankuendigung_aktiv })}
              className="relative h-5 w-9 shrink-0 rounded-full transition-colors" style={{ background: a.ankuendigung_aktiv ? "var(--green)" : "var(--border-hover)" }}>
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: a.ankuendigung_aktiv ? "18px" : "2px" }} />
            </button>
          </label>
        </div>

        {loading ? <div className="skeleton h-32 rounded-lg" /> : (
          <>
            <div className="mb-3">
              <label className="block text-[11px] font-medium text-muted mb-1.5">Typ</label>
              <div className="flex gap-2">
                {(Object.keys(TYP_STYLE) as (keyof typeof TYP_STYLE)[]).map((t) => (
                  <button key={t} onClick={() => setA({ ...a, ankuendigung_typ: t as any })}
                    className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all"
                    style={a.ankuendigung_typ === t ? { background: TYP_STYLE[t].bg, color: TYP_STYLE[t].fg, boxShadow: `inset 0 0 0 1px ${TYP_STYLE[t].border}` } : { background: "var(--surface)", color: "var(--text-muted)" }}>
                    {TYP_STYLE[t].label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-[11px] font-medium text-muted mb-1.5">Nachricht</label>
            <textarea value={a.ankuendigung_text || ""} onChange={(e) => setA({ ...a, ankuendigung_text: e.target.value })} rows={2}
              placeholder="z. B. Am Sonntag 10–12 Uhr Wartungsarbeiten – kurze Ausfälle möglich." className="input resize-none" />

            {/* Live-Vorschau */}
            <p className="text-[11px] font-medium text-muted mt-4 mb-1.5">Vorschau</p>
            <div className="rounded-lg px-4 py-2.5 text-[12.5px]" style={{ background: ts.bg, color: ts.fg, border: `1px solid ${ts.border}` }}>
              {a.ankuendigung_text?.trim() || "—"}
            </div>

            <div className="flex items-center gap-3 mt-5">
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Speichern…" : "Speichern"}</button>
              {saved && <span className="text-[12.5px]" style={{ color: "var(--green)" }}>✓ Gespeichert</span>}
            </div>
          </>
        )}
      </div>

      {/* Feature-Übersicht */}
      <div className="rounded-xl p-5 sm:p-6" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-inset)" }}>
        <h2 className="text-[15px] font-semibold text-white">Features</h2>
        <p className="text-[12px] text-muted mt-0.5 mb-4">Standardmäßig für alle Kunden aktiv. Pro Kunde abschaltbar im jeweiligen Kunden-Detail unter „Feature-Flags".</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.label} className="rounded-lg px-3 py-2.5" style={{ background: "var(--surface)" }}>
              <p className="text-[12.5px] font-medium text-white">{f.label}</p>
              <p className="text-[11px] text-muted">{f.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
