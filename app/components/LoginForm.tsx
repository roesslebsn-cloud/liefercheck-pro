"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

function getLoginErrorMessage(message: string): string {
  if (message.includes("Invalid login credentials")) return "E-Mail oder Passwort ist falsch.";
  if (message.includes("Email not confirmed")) return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  return "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(getLoginErrorMessage(authError.message));
      setIsLoading(false);
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-md px-3 py-2.5 text-[12.5px] animate-fade-in"
          style={{ background: "var(--red-muted)", border: "1px solid rgba(239,68,68,0.18)", color: "var(--red)" }}>
          <svg className="h-3.5 w-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-[11.5px] font-medium mb-1.5 text-muted">
          E-Mail
        </label>
        <input
          id="email" type="email" autoComplete="email" required
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="name@restaurant.de"
          disabled={isLoading}
          className="input"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="block text-[11.5px] font-medium text-muted">
            Passwort
          </label>
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="text-[11px] text-muted hover:text-white transition-colors">
            {showPw ? "Verbergen" : "Anzeigen"}
          </button>
        </div>
        <input
          id="password" type={showPw ? "text" : "password"} autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={isLoading}
          className="input"
        />
      </div>

      <button type="submit" disabled={isLoading}
        className="btn-primary w-full mt-2"
        style={{ padding: "10px 16px", fontSize: "13.5px" }}>
        {isLoading ? (
          <>
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Anmelden
          </>
        ) : "Anmelden"}
      </button>
    </form>
  );
}
