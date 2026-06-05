"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "../../../lib/adminClient";

type StandortZeile = {
  id: string;
  name: string;
  adresse: string | null;
  aktiv: boolean;
  erstellt_am: string;
  organisation_id: string;
  organisation_name: string;
};

export default function AdminStandortePage() {
  const router = useRouter();
  const [rows, setRows] = useState<StandortZeile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setRows(await adminFetch<StandortZeile[]>("/api/admin/standorte"));
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sichtbar = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.adresse || ""} ${r.organisation_name}`.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <>
      <div className="mb-6 reveal">
        <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-white">Standorte</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">{loading ? "Wird geladen…" : `${rows.length} ${rows.length === 1 ? "Standort" : "Standorte"} über alle Kunden`}</p>
      </div>

      {err && <div className="mb-6 rounded-lg p-4 text-sm" style={{ background: "var(--red-muted)", color: "var(--red)" }}>{err}</div>}

      <div className="mb-4 relative max-w-md">
        <svg className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Standort, Kunde, Adresse…" className="input !pl-9" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border" style={{ background: "var(--surface-elevated)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {["Standort", "Kunde", "Adresse", "Status", "Angelegt"].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4].map((i) => <tr key={i} className="border-b border-border last:border-0"><td colSpan={5} className="px-4 py-3"><div className="skeleton h-8 rounded" /></td></tr>)
            ) : sichtbar.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted">{rows.length === 0 ? "Noch keine Standorte angelegt." : "Keine Treffer."}</td></tr>
            ) : (
              sichtbar.map((r) => (
                <tr key={r.id} onClick={() => router.push(`/admin/kunden/${r.organisation_id}`)} className="border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-surface">
                  <td className="px-4 py-3 font-medium text-white">{r.name}</td>
                  <td className="px-4 py-3 text-muted">{r.organisation_name}</td>
                  <td className="px-4 py-3 text-muted">{r.adresse || "—"}</td>
                  <td className="px-4 py-3"><span className={`badge ${r.aktiv ? "badge-green" : "badge-gray"}`}>{r.aktiv ? "Aktiv" : "Inaktiv"}</span></td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{new Date(r.erstellt_am).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11.5px] text-muted">Tipp: Klicke einen Standort an, um ihn im Kunden-Detail zu verwalten.</p>
    </>
  );
}
