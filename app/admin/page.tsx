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
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [orgs, setOrgs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      const ok = isSuperAdminEmail(user.email);
      setAuthorized(ok);
      if (ok) loadOrgs();
    })();
  }, [router]);

  const loadOrgs = async () => {
    const { data } = await supabase
      .from("organisationen")
      .select("id, name, chef_user_id, erstellt_am")
      .order("erstellt_am", { ascending: false });
    setOrgs(data || []);
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
        body: JSON.stringify({ email, vorname, restaurant }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler");
      setResult({ ok: true, msg: `Chef "${vorname}" fuer "${restaurant}" angelegt. Einladungs-Mail an ${email} verschickt.` });
      setEmail("");
      setVorname("");
      setRestaurant("");
      loadOrgs();
    } catch (err: any) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setSubmitting(false);
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
          <p className="mt-3 text-muted">Diese Seite ist nur fuer Super-Admins.</p>
          <a href="/dashboard" className="mt-6 inline-block text-accent hover:underline">Zurueck zum Dashboard</a>
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

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-bold text-white">Neuen Chef anlegen</h1>
        <p className="mt-3 text-muted">Legt eine neue Organisation an und verschickt eine Einladungs-Mail an den Chef.</p>

        <form onSubmit={handleCreate} className="mt-8 max-w-xl space-y-4 rounded-xl border border-border bg-surface-elevated p-6">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Restaurant / Betriebsname</label>
            <input
              required
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
              placeholder="z.B. Trattoria Bella"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Vorname des Chefs</label>
            <input
              value={vorname}
              onChange={(e) => setVorname(e.target.value)}
              placeholder="z.B. Marco"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">E-Mail des Chefs</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="chef@restaurant.de"
              className="input"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? "Wird angelegt..." : "Chef anlegen + Einladung senden"}
          </button>
          {result && (
            <div className={`rounded-lg p-3 text-sm ${result.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {result.msg}
            </div>
          )}
        </form>

        <h2 className="mt-12 text-xl font-semibold text-white">Bestehende Organisationen ({orgs.length})</h2>
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
      </main>
    </div>
  );
}
