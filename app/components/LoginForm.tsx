"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function getLoginErrorMessage(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "E-Mail oder Passwort ist falsch.";
  }
  if (message.includes("Email not confirmed")) {
    return "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.";
  }
  return "Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.";
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.log("Supabase Login-Fehler:", authError);
      setError(getLoginErrorMessage(authError.message));
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
          E-Mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@restaurant.de"
          disabled={isLoading}
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-zinc-600 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-70"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
          Passwort
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={isLoading}
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-zinc-600 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-70"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? "Wird angemeldet…" : "Anmelden"}
      </button>
    </form>
  );
}
