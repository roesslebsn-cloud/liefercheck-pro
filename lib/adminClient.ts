"use client";

import { supabase } from "./supabase";

// Client-Helper für alle /api/admin/* Aufrufe: hängt den Bearer-Token an und
// wirft bei Fehlern eine Error mit der Server-Meldung.
export async function adminFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || `Fehler ${res.status}`);
  return json as T;
}
