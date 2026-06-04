"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { isSuperAdminEmail } from "../../lib/admin";

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [vorname, setVorname] = useState("");
  const [restaurant, setRestaurant] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [anfragen, setAnfragen] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      const ok = isSuperAdminEmail(user.email);
      setAuthorized(ok);
      if (ok) loadAll();
    })();
  }, [router]);

  const loadAll = async () => {
    const [{ data: orgsData }, { data: anfragenData }] = await Promise.all([
      supabase.from("organisationen").select("id, name, chef_user_id, erstellt_am").order("erstellt_am", { ascending: false }),
      supabase.from("mitarbeiter_anfragen").select("*").eq("status", "pending").order("erstellt_am", { ascending: false }),
    ]);
    setOrgs(orgsData || []);
    setAnfragen(anfragenData || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/admin/create-chef", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, vorname, restaurant, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler");
      setResult({ ok: true, msg: `Chef "${vorname}" für "${restaurant}" angelegt. Gib dem Chef seine Login-Daten: ${email} / ${password}` });
      setEmail("");
      setVorname("");
      setRestaurant("");
      setPassword("");
      loadAll();
    } catch (err: any) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEntscheidung = async (anfrageId: string, token: string, aktion: "approve" | "reject") => {
    if (!confirm(`Anfrage wirklich ${aktion === "approve" ? "annehmen" : "ablehnen"}?`)) return;
    try {
      const res = await fetch(`/api/anfrage/entscheiden?token=${token}&aktion=${aktion}`);
      if (!res.ok && res.status !== 200) {
        throw new Error("Fehler beim Bearbeiten");
      }
      loadAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (authorized === null) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Wird geladen...</div>;
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-white">Zugriff verweigert</h1>
          <p className="mt-3 text-muted">Diese Seite ist nur für Super-Admins.</p>
          <a href="/dashboard" className="mt-6 inline-block text-accent hover:underline">Zurück zum Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface-elevated">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-400">Super-Admin</span>
            <span className="text-sm font-semibold text-white">LieferCheck Pro</span>
          </div>
          <a href="/dashboard" className="text-sm text-muted hover:text-white">Dashboard</a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 space-y-12">

        {/* Offene Anfragen */}
        {anfragen.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
              Offene Mitarbeiter-Anfragen
              <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-xs font-medium text-orange-400">{anfragen.length}</span>
            </h2>
            <div className="mt-4 space-y-3">
              {anfragen.map((a) => (
                <div key={a.id} className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="text-muted">Chef</span> <span className="font-medium text-white">{a.angefragt_von_email}</span>{" "}
                        <span className="text-muted">möchte einen {a.rolle === "chef" ? "Chef" : "Mitarbeiter"} anlegen:</span>
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted">E-Mail:</span><span className="text-white font-medium">{a.email}</span>
                        <span className="text-muted">Vorname:</span><span className="text-white">{a.vorname || "-"}</span>
                        <span className="text-muted">Rolle:</span><span className="text-white">{a.rolle}</span>
                        <span className="text-muted">Erstellt:</span><span className="text-white">{new Date(a.erstellt_am).toLocaleString("de-DE")}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEntscheidung(a.id, a.approval_token, "approve")}
                        className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
                      >Annehmen</button>
                      <button
                        onClick={() => handleEntscheidung(a.id, a.approval_token, "reject")}
                        className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
                      >Ablehnen</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Neuen Chef anlegen */}
        <section>
          <h1 className="text-3xl font-bold text-white">Neuen Chef anlegen</h1>
          <p className="mt-3 text-muted">Account wird direkt mit temporärem Passwort angelegt. Du teilst dem Chef Email + Passwort persönlich mit. Beim ersten Login muss er das Passwort selbst ändern.</p>

          <form onSubmit={handleCreate} className="mt-8 max-w-xl space-y-4 rounded-xl border border-border bg-surface-elevated p-6">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Restaurant / Betriebsname</label>
              <input required value={restaurant} onChange={(e) => setRestaurant(e.target.value)} placeholder="z.B. Trattoria Bella" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Vorname des Chefs</label>
              <input value={vorname} onChange={(e) => setVorname(e.target.value)} placeholder="z.B. Marco" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">E-Mail des Chefs</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="chef@restaurant.de" className="input" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-muted">Temporäres Passwort (min. 8 Zeichen)</label>
                <button type="button" onClick={() => setShowPw(!showPw)} className="text-[11px] text-muted hover:text-white">
                  {showPw ? "Verbergen" : "Anzeigen"}
                </button>
              </div>
              <input required type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} placeholder="••••••••" className="input" />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Wird angelegt..." : "Chef anlegen"}
            </button>
            {result && (
              <div className={`rounded-lg p-3 text-sm ${result.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                {result.msg}
              </div>
            )}
          </form>
        </section>

        {/* Bestehende Orgs */}
        <section>
          <h2 className="text-xl font-semibold text-white">Bestehende Organisationen ({orgs.length})</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Chef-ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Angelegt</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-3 text-white">{o.name}</td>
                    <td className="px-4 py-3 text-muted font-mono text-xs">{o.chef_user_id?.slice(0, 8) || "-"}</td>
                    <td className="px-4 py-3 text-muted">{new Date(o.erstellt_am).toLocaleDateString("de-DE")}</td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-muted">Noch keine Organisationen.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
