"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Interessent = {
  id: string;
  name: string;
  firma: string | null;
  email: string;
  telefon: string | null;
  paket: string | null;
  nachricht: string | null;
  status: "neu" | "kontaktiert" | "umgewandelt" | "abgelehnt";
  erstellt_am: string;
};

const STATUS_LABEL: Record<string, string> = {
  neu: "Neu",
  kontaktiert: "Kontaktiert",
  umgewandelt: "Kunde",
  abgelehnt: "Abgelehnt",
};

const STATUS_STYLE: Record<string, string> = {
  neu: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25",
  kontaktiert: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",
  umgewandelt: "bg-green-500/15 text-green-400 ring-1 ring-green-500/25",
  abgelehnt: "bg-red-500/15 text-red-400 ring-1 ring-red-500/25",
};

const NEXT_STATUS: Record<string, Interessent["status"]> = {
  neu: "kontaktiert",
  kontaktiert: "umgewandelt",
  umgewandelt: "abgelehnt",
  abgelehnt: "neu",
};

const NEXT_LABEL: Record<string, string> = {
  neu: "Als kontaktiert markieren",
  kontaktiert: "Als Kunde markieren ✓",
  umgewandelt: "Als abgelehnt markieren",
  abgelehnt: "Wieder auf Neu setzen",
};

const SQL_MIGRATION = `-- In Supabase SQL Editor ausführen:
CREATE TABLE IF NOT EXISTS public.interessenten (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  firma       text,
  email       text NOT NULL,
  telefon     text,
  paket       text,
  nachricht   text,
  status      text DEFAULT 'neu' CHECK (status IN ('neu','kontaktiert','umgewandelt','abgelehnt')),
  erstellt_am timestamptz DEFAULT now()
);
ALTER TABLE public.interessenten ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Alle authentifizierten" ON public.interessenten FOR ALL USING (auth.role() = 'authenticated');`;

export default function AdminAnfragenPage() {
  const [rows, setRows] = useState<Interessent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("alle");
  const [settingUp, setSettingUp] = useState(false);
  const [setupMsg, setSetupMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("interessenten")
      .select("*")
      .order("erstellt_am", { ascending: false });

    if (error) {
      const notExist = error.code === "42P01" || error.message?.includes("does not exist") || error.message?.includes("relation");
      setTableExists(!notExist ? true : false);
      setLoading(false);
      return;
    }
    setTableExists(true);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: Interessent["status"]) => {
    setUpdating(id);
    await supabase.from("interessenten").update({ status }).eq("id", id);
    setRows((r) => r.map((x) => x.id === id ? { ...x, status } : x));
    setUpdating(null);
  };

  const copySQL = () => {
    navigator.clipboard.writeText(SQL_MIGRATION);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = filter === "alle" ? rows : rows.filter((r) => r.status === filter);
  const counts = {
    neu: rows.filter((r) => r.status === "neu").length,
    kontaktiert: rows.filter((r) => r.status === "kontaktiert").length,
    umgewandelt: rows.filter((r) => r.status === "umgewandelt").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between reveal">
        <div>
          <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-white">Anfragen</h1>
          <p className="mt-1.5 text-[13.5px] text-muted">
            Interessenten vom Landing-Page-Formular · {rows.length} gesamt
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/landing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-surface-elevated"
          >
            <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Landing Page
          </a>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-surface-elevated"
          >
            <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Migration-Hinweis */}
      {tableExists === false && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-amber-300">Datenbank einmalig einrichten</p>
              <p className="mt-1 text-[13px] text-amber-400/80">
                Die Tabelle für Anfragen existiert noch nicht. Führe einmalig dieses SQL in Supabase aus:
              </p>
              <div className="mt-3 relative">
                <pre className="overflow-x-auto rounded-xl bg-black/50 p-4 text-[11px] leading-relaxed text-white/70 border border-white/10">{SQL_MIGRATION}</pre>
                <button
                  onClick={copySQL}
                  className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-white/20 transition-colors"
                >
                  {copied ? "✓ Kopiert!" : "SQL kopieren"}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3">
                <svg className="h-4 w-4 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                </svg>
                <span className="text-[12px] text-blue-300">
                  <strong>So geht's:</strong> Supabase Dashboard → SQL Editor → SQL einfügen → Run. E-Mails bekommst du bereits, Daten werden dann auch hier gespeichert.
                </span>
              </div>
              {setupMsg && (
                <p className="mt-2 text-[13px] text-green-400">{setupMsg}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI-Chips */}
      {tableExists === true && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { key: "alle", label: "Alle Anfragen", count: rows.length, color: "text-white" },
            { key: "neu", label: "Neu", count: counts.neu, color: "text-blue-400" },
            { key: "kontaktiert", label: "Kontaktiert", count: counts.kontaktiert, color: "text-amber-400" },
            { key: "umgewandelt", label: "Kunden", count: counts.umgewandelt, color: "text-green-400" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`rounded-xl border p-4 text-left transition-all ${filter === s.key ? "border-accent/40 bg-surface-elevated ring-1 ring-accent/20" : "border-border bg-surface hover:bg-surface-elevated"}`}
            >
              <div className={`text-[28px] font-bold tabular-nums leading-none ${s.color}`}>{s.count}</div>
              <div className="mt-1 text-[11px] text-muted">{s.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent mr-2" />
          Lädt…
        </div>
      ) : tableExists === false ? null : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface py-24 text-center">
          <svg className="h-10 w-10 text-muted/40" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <p className="text-[15px] font-semibold text-white">
            {filter === "alle" ? "Noch keine Anfragen" : `Keine Anfragen mit Status „${STATUS_LABEL[filter]}"`}
          </p>
          <p className="text-[13px] text-muted max-w-xs">
            Sobald jemand das Formular auf der Landing Page ausfüllt, erscheint er hier.
          </p>
          {filter !== "alle" && (
            <button onClick={() => setFilter("alle")} className="mt-2 text-[13px] text-accent hover:underline">
              Alle anzeigen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-white/15">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                {/* Linke Info */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Name + Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-white">{r.name}</span>
                    {r.firma && <span className="text-[13px] text-muted">· {r.firma}</span>}
                    {r.paket && (
                      <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent ring-1 ring-accent/20">
                        {r.paket}
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>

                  {/* Kontaktdaten */}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                    <a href={`mailto:${r.email}`} className="flex items-center gap-1 text-accent hover:underline">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                      {r.email}
                    </a>
                    {r.telefon && (
                      <a href={`tel:${r.telefon}`} className="flex items-center gap-1 text-muted hover:text-white transition-colors">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                        </svg>
                        {r.telefon}
                      </a>
                    )}
                    <span className="text-muted">
                      {new Date(r.erstellt_am).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} Uhr
                    </span>
                  </div>

                  {/* Nachricht */}
                  {r.nachricht && (
                    <p className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white/65 italic">
                      „{r.nachricht}"
                    </p>
                  )}
                </div>

                {/* Rechte Aktionen */}
                <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-end">
                  <button
                    disabled={updating === r.id}
                    onClick={() => updateStatus(r.id, NEXT_STATUS[r.status])}
                    className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50 whitespace-nowrap"
                  >
                    {updating === r.id ? "…" : NEXT_LABEL[r.status]}
                  </button>
                  <a
                    href={`mailto:${r.email}?subject=Ihre Anfrage – LieferCheck Pro&body=Hallo ${r.name.split(" ")[0]},%0A%0Avielen Dank für Ihr Interesse an LieferCheck Pro!%0A%0AIch melde mich gerne persönlich für ein kostenloses Erstgespräch.%0A%0AMit freundlichen Grüßen%0ASilas Rößle%0ALieferCheck Pro`}
                    className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-white/10 text-center whitespace-nowrap"
                  >
                    E-Mail schreiben
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
