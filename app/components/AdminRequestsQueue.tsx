"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminClient";

type Anfrage = {
  id: string;
  email: string;
  vorname: string | null;
  rolle: string;
  angefragt_von_email: string | null;
  organisation_name: string | null;
  erstellt_am: string;
  approval_token: string;
};

// Offene Mitarbeiter-Anfragen mit Annehmen/Ablehnen. Entscheidung über die
// bestehende token-basierte Route /api/anfrage/entscheiden (gibt HTML zurück –
// wir prüfen nur res.ok und laden neu).
export function AdminRequestsQueue({ onChange }: { onChange?: () => void }) {
  const [anfragen, setAnfragen] = useState<Anfrage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setAnfragen(await adminFetch<Anfrage[]>("/api/admin/requests"));
    } catch {
      /* still ok – Übersicht zeigt Fehler separat */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const entscheiden = async (a: Anfrage, aktion: "approve" | "reject") => {
    if (aktion === "reject" && !confirm(`Anfrage für ${a.email} wirklich ablehnen?`)) return;
    setBusyId(a.id);
    try {
      const res = await fetch(`/api/anfrage/entscheiden?token=${encodeURIComponent(a.approval_token)}&aktion=${aktion}`);
      if (!res.ok) throw new Error("Fehler bei der Bearbeitung");
      await load();
      onChange?.();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading || anfragen.length === 0) return null; // nichts anzeigen, wenn leer

  return (
    <div className="mb-6 rounded-xl p-4 sm:p-5 reveal" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.28)" }}>
      <p className="text-[10.5px] font-medium uppercase tracking-wider mb-3" style={{ color: "#f59e0b" }}>
        Offene Mitarbeiter-Anfragen ({anfragen.length})
      </p>
      <ul className="space-y-2">
        {anfragen.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
            <div className="min-w-0 text-[12.5px]">
              <p className="font-medium text-white truncate">
                {a.email} <span className="text-muted">· {a.rolle}</span>
              </p>
              <p className="text-[11px] text-muted truncate">
                {a.organisation_name || "—"} · angefragt von {a.angefragt_von_email || "?"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => entscheiden(a, "approve")} disabled={busyId === a.id}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50" style={{ background: "var(--green)" }}>
                {busyId === a.id ? "…" : "Annehmen"}
              </button>
              <button onClick={() => entscheiden(a, "reject")} disabled={busyId === a.id}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium disabled:opacity-50" style={{ background: "var(--red-muted)", color: "var(--red)" }}>
                Ablehnen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
