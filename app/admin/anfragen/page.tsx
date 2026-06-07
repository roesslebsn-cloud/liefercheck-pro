"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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
  neu: "bg-blue-500/15 text-blue-400 ring-blue-500/25",
  kontaktiert: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
  umgewandelt: "bg-green-500/15 text-green-400 ring-green-500/25",
  abgelehnt: "bg-red-500/15 text-red-400 ring-red-500/25",
};

const NEXT_STATUS: Record<string, Interessent["status"]> = {
  neu: "kontaktiert",
  kontaktiert: "umgewandelt",
  umgewandelt: "abgelehnt",
  abgelehnt: "neu",
};

const NEXT_LABEL: Record<string, string> = {
  neu: "Als kontaktiert markieren",
  kontaktiert: "Als Kunde markieren",
  umgewandelt: "Als abgelehnt markieren",
  abgelehnt: "Auf neu setzen",
};

export default function AdminAnfragenPage() {
  const [rows, setRows] = useState<Interessent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("alle");

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const load = async () => {
    setLoading(true);
    const { data, error } = await sb
      .from("interessenten")
      .select("*")
      .order("erstellt_am", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        setTableExists(false);
      }
      setLoading(false);
      return;
    }
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: Interessent["status"]) => {
    setUpdating(id);
    await sb.from("interessenten").update({ status }).eq("id", id);
    setRows((r) => r.map((x) => x.id === id ? { ...x, status } : x));
    setUpdating(null);
  };

  const filtered = filter === "alle" ? rows : rows.filter((r) => r.status === filter);
  const counts = {
    neu: rows.filter((r) => r.status === "neu").length,
    kontaktiert: rows.filter((r) => r.status === "kontaktiert").length,
    umgewandelt: rows.filter((r) => r.status === "umgewandelt").length,
    abgelehnt: rows.filter((r) => r.status === "abgelehnt").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-white">Anfragen</h1>
          <p className="mt-1.5 text-[13.5px] text-muted">Interessenten vom Landing-Page-Formular – direkt hier verwalten.</p>
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
            Landing Page ansehen
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
      {!tableExists && (
        <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-500/8 p-5">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-300">Datenbank-Migration erforderlich</p>
              <p className="mt-1 text-xs text-amber-400/80">
                Die Tabelle <code className="rounded bg-white/10 px-1">interessenten</code> existiert noch nicht. Führe diese SQL im Supabase SQL-Editor aus:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-white/70">{`CREATE TABLE interessenten (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  firma text,
  email text NOT NULL,
  telefon text,
  paket text,
  nachricht text,
  status text DEFAULT 'neu' CHECK (status IN ('neu','kontaktiert','umgewandelt','abgelehnt')),
  erstellt_am timestamptz DEFAULT now()
);
ALTER TABLE interessenten ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON interessenten USING (false);`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* KPI-Chips */}
      {tableExists && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { key: "alle", label: "Alle", count: rows.length, color: "text-white" },
            { key: "neu", label: "Neu", count: counts.neu, color: "text-blue-400" },
            { key: "kontaktiert", label: "Kontaktiert", count: counts.kontaktiert, color: "text-amber-400" },
            { key: "umgewandelt", label: "Kunden", count: counts.umgewandelt, color: "text-green-400" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`rounded-xl border p-4 text-left transition-colors ${filter === s.key ? "border-accent bg-surface-elevated" : "border-border bg-surface hover:bg-surface-elevated"}`}
            >
              <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.count}</div>
              <div className="mt-0.5 text-xs text-muted">{s.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted">Lädt …</div>
      ) : !tableExists ? null : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface py-20 text-center">
          <svg className="h-10 w-10 text-muted/50" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <p className="text-sm font-medium text-white">Noch keine Anfragen</p>
          <p className="text-xs text-muted">Sobald jemand das Formular auf der Landing Page ausfüllt, erscheint er hier.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-elevated">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-white">{r.name}</span>
                    {r.firma && <span className="text-[13px] text-muted">· {r.firma}</span>}
                    {r.paket && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400 ring-1 ring-blue-500/20">
                        {r.paket}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${STATUS_STYLE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
                    <a href={`mailto:${r.email}`} className="hover:text-white transition-colors">
                      ✉ {r.email}
                    </a>
                    {r.telefon && (
                      <a href={`tel:${r.telefon}`} className="hover:text-white transition-colors">
                        📞 {r.telefon}
                      </a>
                    )}
                    <span>{new Date(r.erstellt_am).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {r.nachricht && (
                    <p className="mt-2 rounded-lg bg-white/[0.03] px-3 py-2 text-[13px] text-white/70 italic">
                      „{r.nachricht}"
                    </p>
                  )}
                </div>

                {/* Aktionen */}
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
                  <button
                    disabled={updating === r.id}
                    onClick={() => updateStatus(r.id, NEXT_STATUS[r.status])}
                    className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                  >
                    {updating === r.id ? "…" : NEXT_LABEL[r.status]}
                  </button>
                  <a
                    href={`mailto:${r.email}?subject=LieferCheck Pro – Ihre Anfrage&body=Hallo ${r.name.split(" ")[0]},%0A%0Avielen Dank für Ihr Interesse an LieferCheck Pro!%0A%0A`}
                    className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-white/10"
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
