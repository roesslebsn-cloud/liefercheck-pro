"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "../../../lib/adminClient";

type Kunde = {
  id: string;
  name: string;
  status: "aktiv" | "gesperrt";
  erstellt_am: string;
  chef: { user_id: string | null; vorname: string | null; email: string | null };
  mitarbeiterAnzahl: number;
  standortAnzahl: number;
  lieferungAnzahl: number;
  ersparnis: number;
  letzteAktivitaet: string | null;
  onboarding: { kontoEingerichtet: boolean; standortAngelegt: boolean; ersteLieferung: boolean };
};

type SortKey = "name" | "ersparnis" | "lieferungAnzahl" | "letzteAktivitaet" | "erstellt_am";

function relativ(iso: string | null): string {
  if (!iso) return "nie";
  const diff = Date.now() - new Date(iso).getTime();
  const tage = Math.floor(diff / 86_400_000);
  if (tage <= 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 30) return `vor ${tage} T`;
  if (tage < 365) return `vor ${Math.floor(tage / 30)} Mon`;
  return `vor ${Math.floor(tage / 365)} J`;
}

function randomPw(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function AdminKundenPage() {
  const router = useRouter();
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"alle" | "aktiv" | "gesperrt">("alle");
  const [sortKey, setSortKey] = useState<SortKey>("erstellt_am");

  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      setKunden(await adminFetch<Kunde[]>("/api/admin/orgs"));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sichtbar = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = kunden.filter((kd) => {
      if (statusFilter !== "alle" && kd.status !== statusFilter) return false;
      if (q) {
        const hay = `${kd.name} ${kd.chef.vorname || ""} ${kd.chef.email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    arr = [...arr].sort((a, b) => {
      switch (sortKey) {
        case "name": return a.name.localeCompare(b.name);
        case "ersparnis": return b.ersparnis - a.ersparnis;
        case "lieferungAnzahl": return b.lieferungAnzahl - a.lieferungAnzahl;
        case "letzteAktivitaet": return new Date(b.letzteAktivitaet || 0).getTime() - new Date(a.letzteAktivitaet || 0).getTime();
        default: return new Date(b.erstellt_am).getTime() - new Date(a.erstellt_am).getTime();
      }
    });
    return arr;
  }, [kunden, search, statusFilter, sortKey]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between reveal">
        <div>
          <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-white">Kunden</h1>
          <p className="mt-1.5 text-[13.5px] text-muted">{loading ? "Wird geladen…" : `${kunden.length} ${kunden.length === 1 ? "Betrieb" : "Betriebe"}`}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary shrink-0 self-start sm:self-auto">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Chef anlegen
        </button>
      </div>

      {err && <div className="mb-6 rounded-lg p-4 text-sm" style={{ background: "var(--red-muted)", color: "var(--red)" }}>{err}</div>}

      {/* Filterleiste */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <svg className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, Chef, E-Mail…" className="input !pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={`input cursor-pointer ${statusFilter !== "alle" ? "text-accent" : "text-muted"}`} style={{ width: "auto", paddingRight: 30 }}>
          <option value="alle">Alle Status</option>
          <option value="aktiv">Aktiv</option>
          <option value="gesperrt">Gesperrt</option>
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="input cursor-pointer text-muted" style={{ width: "auto", paddingRight: 30 }}>
          <option value="erstellt_am">Neueste zuerst</option>
          <option value="name">Name (A–Z)</option>
          <option value="ersparnis">Höchste Ersparnis</option>
          <option value="lieferungAnzahl">Meiste Lieferungen</option>
          <option value="letzteAktivitaet">Zuletzt aktiv</option>
        </select>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto rounded-xl border border-border" style={{ background: "var(--surface-elevated)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {["Betrieb", "Status", "Onboarding", "Standorte", "Team", "Lieferungen", "Ersparnis", "Zuletzt aktiv"].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-border last:border-0"><td colSpan={8} className="px-4 py-3"><div className="skeleton h-8 rounded" /></td></tr>
              ))
            ) : sichtbar.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">{kunden.length === 0 ? "Noch keine Kunden – lege den ersten Chef an." : "Keine Treffer."}</td></tr>
            ) : (
              sichtbar.map((kd) => {
                const ob = [kd.onboarding.kontoEingerichtet, kd.onboarding.standortAngelegt, kd.onboarding.ersteLieferung];
                const obDone = ob.filter(Boolean).length;
                return (
                  <tr key={kd.id} onClick={() => router.push(`/admin/kunden/${kd.id}`)} className="border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-surface">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white truncate max-w-[220px]">{kd.name}</p>
                      <p className="text-[11.5px] text-muted truncate max-w-[220px]">{kd.chef.vorname ? `${kd.chef.vorname} · ` : ""}{kd.chef.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${kd.status === "gesperrt" ? "badge-red" : "badge-green"}`}>{kd.status === "gesperrt" ? "Gesperrt" : "Aktiv"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" title={`${obDone}/3 Schritten`}>
                        {ob.map((done, i) => (
                          <span key={i} className="h-1.5 w-5 rounded-full" style={{ background: done ? "var(--green)" : "var(--border)" }} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">{kd.standortAnzahl}</td>
                    <td className="px-4 py-3 tabular-nums text-muted">{kd.mitarbeiterAnzahl}</td>
                    <td className="px-4 py-3 tabular-nums text-muted">{kd.lieferungAnzahl}</td>
                    <td className="px-4 py-3 tabular-nums font-medium" style={{ color: kd.ersparnis > 0 ? "var(--green)" : "var(--text-muted)" }}>€{kd.ersparnis.toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{relativ(kd.letzteAktivitaet)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateChefModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setLoading(true); load(); }} />}
    </>
  );
}

// ─── Chef-anlegen-Modal ──────────────────────────────────────────────────────
function CreateChefModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [restaurant, setRestaurant] = useState("");
  const [vorname, setVorname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPw());
  const [showPw, setShowPw] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      await adminFetch("/api/admin/create-chef", { method: "POST", body: JSON.stringify({ email, vorname, restaurant, password }) });
      setResult({ ok: true, msg: `Chef „${vorname || email}" für „${restaurant}" angelegt. Login-Daten: ${email} / ${password}` });
      setRestaurant(""); setVorname(""); setEmail(""); setPassword(randomPw());
    } catch (err: any) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ background: "rgba(8,9,12,0.7)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-6 animate-scale-in" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-hover)", boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-semibold text-white">Neuen Chef anlegen</h3>
        <p className="mt-1 text-[12.5px] text-muted">Konto wird mit temporärem Passwort erstellt. Gib dem Chef E-Mail + Passwort persönlich.</p>

        <form onSubmit={handleCreate} className="mt-5 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-muted mb-1.5">Restaurant / Betrieb</label>
            <input required value={restaurant} onChange={(e) => setRestaurant(e.target.value)} placeholder="z. B. Trattoria Bella" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1.5">Vorname</label>
              <input value={vorname} onChange={(e) => setVorname(e.target.value)} placeholder="Marco" className="input" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1.5">E-Mail</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="chef@betrieb.de" className="input" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-medium text-muted">Temporäres Passwort</label>
              <button type="button" onClick={() => setPassword(randomPw())} className="text-[11px] text-accent hover:underline">Neu generieren</button>
            </div>
            <input required type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} className="input font-mono" />
          </div>

          {result && <div className={`rounded-lg p-3 text-[12.5px] ${result.ok ? "text-green-400" : "text-red-400"}`} style={{ background: result.ok ? "var(--green-muted)" : "var(--red-muted)" }}>{result.msg}</div>}

          <div className="flex gap-2 justify-end pt-1">
            {result?.ok ? (
              <button type="button" onClick={onCreated} className="btn-primary">Fertig</button>
            ) : (
              <>
                <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
                <button type="submit" disabled={submitting} className="btn-primary">{submitting ? "Wird angelegt…" : "Anlegen"}</button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
