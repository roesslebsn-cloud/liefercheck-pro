"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import { supabase } from "../../lib/supabase";
import { getAllUsers, updateUserRole, removeUserFromTeam, getUserRole } from "../../lib/database";

export default function TeamPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [accessDenied, setAccessDenied] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"chef" | "mitarbeiter">("mitarbeiter");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/"); return; }
    setCurrentUserId(user.id);

    const role = await getUserRole();
    if (role !== "chef") { setAccessDenied(true); setLoading(false); return; }

    try {
      const data = await getAllUsers();
      setUsers(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleRoleChange = async (userId: string, newRole: "chef" | "mitarbeiter") => {
    try {
      await updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, role: newRole } : u));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemove = async () => {
    if (!confirmRemoveId) return;
    setRemoving(true);
    try {
      await removeUserFromTeam(confirmRemoveId);
      setUsers((prev) => prev.filter((u) => u.user_id !== confirmRemoveId));
      setConfirmRemoveId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setRemoving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError("");
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Einladen");
      }
      setInviteSuccess(true);
      setInviteEmail("");
      setTimeout(() => setInviteSuccess(false), 4000);
    } catch (err: any) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  };

  if (accessDenied) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen items-center justify-center bg-[#070709]">
          <div className="text-center">
            <p className="text-white/40 text-sm">Kein Zugriff. Nur für Chefs.</p>
            <button onClick={() => router.push("/dashboard")} className="mt-4 text-xs text-blue-400 hover:underline">
              Zurück zum Dashboard
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#070709] text-white">

        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#070709]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center justify-center rounded-lg p-1.5 text-white/35 hover:bg-white/[0.05] hover:text-white/70 transition-all"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div className="h-4 w-px bg-white/[0.08]" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Team</span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">

          {/* Invite Card */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold text-white">Mitarbeiter einladen</h2>
              <p className="text-xs text-white/35 mt-1">
                Sende eine Einladungs-E-Mail. Der Mitarbeiter erhält einen Link zur Registrierung.
              </p>
            </div>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@restaurant.de"
                required
                className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/40 focus:bg-blue-500/[0.04] transition-all"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="rounded-xl border border-white/[0.08] bg-[#111116] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-all"
              >
                <option value="mitarbeiter">Mitarbeiter</option>
                <option value="chef">Chef</option>
              </select>
              <button
                type="submit"
                disabled={inviting || !inviteEmail}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
              >
                {inviting ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                )}
                {inviting ? "Wird gesendet..." : "Einladen"}
              </button>
            </form>

            {inviteSuccess && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="text-xs font-medium text-emerald-400">Einladung wurde gesendet!</p>
              </div>
            )}
            {inviteError && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                <svg className="h-4 w-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-xs text-red-400">{inviteError}</p>
              </div>
            )}
          </div>

          {/* Team List */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
              <div>
                <h2 className="text-sm font-semibold text-white">Teammitglieder</h2>
                {!loading && (
                  <p className="text-xs text-white/30 mt-0.5">
                    {users.length} {users.length === 1 ? "Person" : "Personen"} im Team
                  </p>
                )}
              </div>
            </div>

            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-white/25">Noch keine Teammitglieder</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {users.map((u) => {
                  const isMe = u.user_id === currentUserId;
                  const displayName = u.email || `${u.user_id?.slice(0, 8)}...`;
                  const initials = (u.email || u.user_id)?.charAt(0).toUpperCase();

                  return (
                    <li key={u.user_id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.015] transition-colors">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Avatar */}
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                          u.role === "chef" ? "bg-blue-500/15 text-blue-400" : "bg-white/[0.06] text-white/45"
                        }`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white/85 truncate">
                            {displayName}
                            {isMe && (
                              <span className="ml-2 text-[10px] font-normal text-white/25">Du</span>
                            )}
                          </p>
                          <p className="text-xs text-white/25">
                            Dabei seit {new Date(u.created_at).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        {isMe ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            u.role === "chef"
                              ? "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
                              : "bg-white/[0.05] text-white/35 ring-1 ring-white/[0.08]"
                          }`}>
                            {u.role === "chef" ? "Chef" : "Mitarbeiter"}
                          </span>
                        ) : (
                          <>
                            <select
                              value={u.role || "mitarbeiter"}
                              onChange={(e) => handleRoleChange(u.user_id, e.target.value as any)}
                              className="rounded-lg border border-white/[0.08] bg-[#111116] px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-blue-500/40 transition-all"
                            >
                              <option value="mitarbeiter">Mitarbeiter</option>
                              <option value="chef">Chef</option>
                            </select>
                            <button
                              onClick={() => setConfirmRemoveId(u.user_id)}
                              className="rounded-lg p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                              title="Aus Team entfernen"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Info box */}
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 px-5 py-4">
            <svg className="h-4 w-4 text-amber-400/70 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <p className="text-xs text-white/35 leading-relaxed">
              Mitarbeiter können Lieferungen erfassen und einsehen, aber nichts löschen oder bearbeiten. Nur Chefs haben vollen Zugriff. Das Einladen erfordert einen konfigurierten <code className="text-white/50">SUPABASE_SERVICE_ROLE_KEY</code> in der <code className="text-white/50">.env.local</code>.
            </p>
          </div>
        </main>

        {/* Confirm Remove Modal */}
        {confirmRemoveId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#111116] p-6 shadow-2xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 mb-4">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white mb-1">Mitarbeiter entfernen?</h3>
              <p className="text-sm text-white/40 mb-6">
                Der Mitarbeiter verliert den Zugriff. Er kann sich erneut registrieren, erhält dann aber nur Mitarbeiter-Rechte.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmRemoveId(null)}
                  className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-sm font-medium text-white hover:bg-white/[0.08] transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {removing ? "Wird entfernt..." : "Entfernen"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
