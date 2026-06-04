"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../components/AuthGuard";
import { supabase } from "../../lib/supabase";
import {
  getTeamMitglieder,
  getUserRole,
  getMyOrganisation,
  updateUserRole,
  removeUserFromTeam,
  getOffeneEinladungen,
  deleteEinladung,
} from "../../lib/database";
import { TeamMitglied, TeamEinladung, Organisation } from "../../lib/types";

export default function TeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [myRole, setMyRole] = useState<"chef" | "mitarbeiter">("mitarbeiter");
  const [org, setOrg] = useState<Organisation | null>(null);
  const [team, setTeam] = useState<TeamMitglied[]>([]);
  const [einladungen, setEinladungen] = useState<TeamEinladung[]>([]);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteVorname, setInviteVorname] = useState("");
  const [inviteRole, setInviteRole] = useState<"chef" | "mitarbeiter">("mitarbeiter");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/"); return; }
    setCurrentUserId(user.id);

    const role = await getUserRole();
    setMyRole(role);

    const [organisation, members] = await Promise.all([
      getMyOrganisation(),
      getTeamMitglieder(),
    ]);
    setOrg(organisation);
    setTeam(members);

    if (role === "chef") {
      const inv = await getOffeneEinladungen();
      setEinladungen(inv);
      // E-Mails aus auth.users laden via RPC oder hier eigenes Mapping
      // Fallback: aus Einladungen oder eigene Email zeigen
      const map: Record<string, string> = {};
      if (user.email) map[user.id] = user.email;
      setEmailMap(map);
    }

    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, vorname: inviteVorname }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler");
      setInviteMsg({ ok: true, text: `Einladung an ${inviteEmail} verschickt.` });
      setInviteEmail("");
      setInviteVorname("");
      init();
    } catch (err: any) {
      setInviteMsg({ ok: false, text: err.message });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "chef" | "mitarbeiter") => {
    await updateUserRole(userId, newRole);
    setTeam((prev) => prev.map((u) => u.user_id === userId ? { ...u, role: newRole } : u));
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Mitarbeiter wirklich entfernen?")) return;
    await removeUserFromTeam(userId);
    setTeam((prev) => prev.filter((u) => u.user_id !== userId));
  };

  const handleDeleteInvite = async (id: string) => {
    await deleteEinladung(id);
    setEinladungen((prev) => prev.filter((e) => e.id !== id));
  };

  if (loading) {
    return <AuthGuard><div className="flex min-h-screen items-center justify-center text-muted">Wird geladen...</div></AuthGuard>;
  }

  const chefs = team.filter((m) => m.role === "chef");
  const mitarbeiter = team.filter((m) => m.role === "mitarbeiter");

  // ─── MITARBEITER-ANSICHT ──────────────────────────────────────────────
  if (myRole !== "chef") {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-[#070709] text-white">
          <header className="border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-6">
              <a href="/dashboard" className="text-sm text-muted hover:text-white">&larr; Dashboard</a>
              <div className="h-4 w-px bg-white/[0.08]" />
              <span className="text-sm font-semibold">Team</span>
            </div>
          </header>

          <main className="mx-auto max-w-3xl px-6 py-12">
            {org && (
              <div className="mb-6">
                <p className="text-xs uppercase tracking-wider text-muted">Organisation</p>
                <h1 className="mt-1 text-2xl font-bold text-white">{org.name}</h1>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <p className="text-xs uppercase tracking-wider text-muted">Chefs</p>
                <p className="mt-2 text-3xl font-bold text-white">{chefs.length}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <p className="text-xs uppercase tracking-wider text-muted">Mitarbeiter</p>
                <p className="mt-2 text-3xl font-bold text-white">{mitarbeiter.length}</p>
              </div>
            </div>

            <h2 className="mt-10 text-sm font-semibold text-white">Team-Mitglieder</h2>
            <p className="text-xs text-muted">Nur Vornamen und Rollen sind sichtbar.</p>
            <div className="mt-4 space-y-2">
              {team.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${m.role === "chef" ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/20 text-blue-300"}`}>
                      {(m.vorname || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{m.vorname || "Unbekannt"}{m.user_id === currentUserId && <span className="ml-2 text-xs text-muted">(du)</span>}</p>
                      <p className="text-xs text-muted">{m.role === "chef" ? "Chef" : "Mitarbeiter"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </AuthGuard>
    );
  }

  // ─── CHEF-ANSICHT ────────────────────────────────────────────────────
  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#070709] text-white">
        <header className="border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
            <a href="/dashboard" className="text-sm text-muted hover:text-white">&larr; Dashboard</a>
            <div className="h-4 w-px bg-white/[0.08]" />
            <span className="text-sm font-semibold">Team-Verwaltung</span>
            <span className="ml-2 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-300">Chef</span>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-6 py-12 space-y-8">
          {org && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Organisation</p>
              <h1 className="mt-1 text-2xl font-bold text-white">{org.name}</h1>
            </div>
          )}

          {/* Einladen */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="text-sm font-semibold text-white">Mitarbeiter einladen</h2>
            <p className="mt-1 text-xs text-muted">Verschickt eine Einladungs-Mail mit Magic-Link.</p>
            <form onSubmit={handleInvite} className="mt-4 grid gap-3 sm:grid-cols-[1fr,1fr,150px,auto]">
              <input
                required type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@restaurant.de"
                className="input"
              />
              <input
                value={inviteVorname}
                onChange={(e) => setInviteVorname(e.target.value)}
                placeholder="Vorname"
                className="input"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="input"
              >
                <option value="mitarbeiter">Mitarbeiter</option>
                <option value="chef">Chef</option>
              </select>
              <button type="submit" disabled={inviting} className="btn-primary">
                {inviting ? "..." : "Einladen"}
              </button>
            </form>
            {inviteMsg && (
              <p className={`mt-3 text-xs ${inviteMsg.ok ? "text-green-400" : "text-red-400"}`}>{inviteMsg.text}</p>
            )}
          </div>

          {/* Team-Liste */}
          <div>
            <h2 className="text-sm font-semibold text-white">Team ({team.length})</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03]">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted">Vorname</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">E-Mail</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Rolle</th>
                    <th className="px-4 py-3 text-left font-medium text-muted">Zuletzt aktiv</th>
                    <th className="px-4 py-3 text-right font-medium text-muted">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((m) => (
                    <tr key={m.user_id} className="border-t border-white/[0.06]">
                      <td className="px-4 py-3 text-white">{m.vorname || "-"}</td>
                      <td className="px-4 py-3 text-muted">{emailMap[m.user_id] || (m.user_id === currentUserId ? "" : "(verdeckt)")}</td>
                      <td className="px-4 py-3">
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.user_id, e.target.value as any)}
                          disabled={m.user_id === currentUserId}
                          className="rounded-md border border-white/[0.08] bg-[#111116] px-2 py-1 text-xs"
                        >
                          <option value="mitarbeiter">Mitarbeiter</option>
                          <option value="chef">Chef</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {m.zuletzt_aktiv ? new Date(m.zuletzt_aktiv).toLocaleDateString("de-DE") : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m.user_id !== currentUserId && (
                          <button
                            onClick={() => handleRemove(m.user_id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >Entfernen</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Offene Einladungen */}
          {einladungen.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-white">Offene Einladungen ({einladungen.length})</h2>
              <div className="mt-4 space-y-2">
                {einladungen.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div>
                      <p className="text-sm text-white">{e.email}</p>
                      <p className="text-xs text-muted">{e.vorname || "-"} &middot; {e.rolle} &middot; verschickt am {e.erstellt_am ? new Date(e.erstellt_am).toLocaleDateString("de-DE") : "-"}</p>
                    </div>
                    <button onClick={() => handleDeleteInvite(e.id!)} className="text-xs text-red-400 hover:text-red-300">Loeschen</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
