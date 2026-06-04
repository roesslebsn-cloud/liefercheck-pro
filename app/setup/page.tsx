"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

function SetupContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [vorname, setVorname] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setAuthenticated(true);
        setEmail(session.user.email || "");
        const meta = session.user.user_metadata as any;
        if (meta?.vorname) setVorname(meta.vorname);
      }
      setLoading(false);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== password2) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;

      if (vorname.trim()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("user_settings")
            .update({ vorname: vorname.trim() })
            .eq("user_id", user.id);
        }
      }

      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Fehler beim Setzen des Passworts");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Wird geladen...</div>;
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-white">Einladung nicht erkannt</h1>
          <p className="mt-3 text-muted">
            Bitte öffne den Einladungs-Link aus deiner E-Mail erneut. Der Link ist 14 Tage gültig.
          </p>
          <p className="mt-2 text-sm text-muted">
            Falls du bereits ein Passwort gesetzt hast, melde dich direkt an.
          </p>
          <a href="/" className="mt-6 inline-block text-accent hover:underline">Zum Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-12 overflow-hidden">
      <div className="aurora-bg" />

      <div className="relative w-full max-w-[420px] reveal">
        <div className="mb-10 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-5"
            style={{ background: "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)" }}>
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight gradient-text">Willkommen!</h1>
          <p className="mt-1.5 text-[13px] text-muted text-center">
            Setze dein Passwort um die Einrichtung abzuschließen.
          </p>
        </div>

        <div className="spotlight-card rounded-2xl p-7"
          style={{ background: "rgba(19,22,29,0.6)", backdropFilter: "blur(24px)", border: "1px solid var(--border-hover)" }}>

          <form onSubmit={handleSubmit} className="space-y-4">
            {email && (
              <div className="rounded-md bg-accent-muted/30 px-3 py-2 text-xs text-muted">
                Konto: <span className="text-white font-medium">{email}</span>
              </div>
            )}

            <div>
              <label className="block text-[11.5px] font-medium mb-1.5 text-muted">Dein Vorname</label>
              <input
                value={vorname}
                onChange={(e) => setVorname(e.target.value)}
                placeholder="z.B. Marco"
                className="input"
              />
            </div>

            <div>
              <label className="block text-[11.5px] font-medium mb-1.5 text-muted">Neues Passwort (min. 8 Zeichen)</label>
              <input
                type="password" required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </div>

            <div>
              <label className="block text-[11.5px] font-medium mb-1.5 text-muted">Passwort wiederholen</label>
              <input
                type="password" required
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
            )}

            <button type="submit" disabled={submitting}
              className="btn-primary w-full mt-2"
              style={{ padding: "10px 16px", fontSize: "13.5px" }}>
              {submitting ? "Wird gespeichert..." : "Passwort setzen und loslegen"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-muted">Lädt...</div>}>
      <SetupContent />
    </Suspense>
  );
}
