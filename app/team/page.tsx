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
  getAuditLogFuerUser,
} from "../../lib/database";
import { TeamMitglied, TeamEinladung, Organisation, AuditLogEintrag } from "../../lib/types";
import AuditDrawer from "../components/AuditDrawer";
import BottleLoader from "../components/BottleLoader";

function SpotlightCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };
  return (
    <div className={`spotlight-card spotlight-border ${className}`} onMouseMove={handleMouseMove} style={style}>
      {children}
    </div>
  );
}

function Avatar({ name, role }: { name: string; role: string }) {
  const initials = (name || "?").slice(0, 2).toUpperCase();
  const isChef = role === "chef";
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold shrink-0"
      style={{
        background: isChef ? "rgba(167,139,250,0.15)" : "rgba(91,108,255,0.12)",
        color: isChef ? "#a78bfa" : "var(--accent)",
        boxShadow: `inset 0 0 0 1px ${isChef ? "rgba(167,139,250,0.2)" : "rgba(91,108,255,0.2)"}`,
      }}>
      {initials}
    </div>
  );
}

export default function TeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [myRole, setMyRole] = useState<"chef" | "mitarbeiter">("mitarbeiter");
  const [org, setOrg] = useState<Organisation | null>(null);
  const [team, setTeam] = useState<TeamMitglied[]>([]);
  const [einladungen, setEinladungen] = useState<TeamEinladung[]>([]);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteVorname, setInviteVorname] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [showInvitePw, setShowInvitePw] = useState(false);
  const [inviteRole, setInviteRole] = useState<"chef" | "mitarbeiter">("mitarbeiter");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [auditMember, setAuditMember] = useState<TeamMitglied | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditLogEintrag[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

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
      const map: Record<string, string> = {};
      if (user.email) map[user.id] = user.email;
      setEmailMap(map);
    }
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !invitePassword) return;
    if (invitePassword.length < 8) {
      setInviteMsg({ ok: false, text: "Passwort muss mind. 8 Zeichen lang sein." });
      return;
    }
    setInviting(true);
    setInviteMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/anfrage/erstellen", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: inviteEmail, vorname: inviteVorname, password: invitePassword, rolle: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fehler");
      setInviteMsg({ ok: true, text: `Anfrage gesendet! Sobald freigegeben, kannst du ${inviteEmail} die Login-Daten mitteilen.` });
      setInviteEmail(""); setInviteVorname(""); setInvitePassword("");
      init();
    } catch (err: any) {
      setInviteMsg({ ok: false, text: err.message });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "chef" | "mitarbeiter") => {
    await updateUserRole(userId, newRole);
    setTeam(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Mitarbeiter wirklich entfernen?")) return;
    await removeUserFromTeam(userId);
    setTeam(prev => prev.filter(u => u.user_id !== userId));
  };

  const handleDeleteInvite = async (id: string) => {
    await deleteEinladung(id);
    setEinladungen(prev => prev.filter(e => e.id !== id));
  };

  const openAudit = async (member: TeamMitglied) => {
    setAuditMember(member);
    setAuditEntries([]);
    setAuditLoading(true);
    try {
      const entries = await getAuditLogFuerUser(member.user_id);
      setAuditEntries(entries);
    } finally {
      setAuditLoading(false);
    }
  };

  const bgShell = (
    <>
      <div className="aurora-bg" />
      <div className="fixed inset-0 grid-bg pointer-events-none" style={{ zIndex: -1, maskImage: "radial-gradient(ellipse at center, #000 0%, transparent 70%)" }} />
    </>
  );

  const PageHeader = ({ title }: { title: string }) => (
    <header className="header-backdrop sticky top-0 z-30">
      <div className="mx-auto flex h-14 max-w-4xl items-center px-5 sm:px-8 gap-3">
        <button onClick={() => router.push("/dashboard")} className="back-btn">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Dashboard
        </button>
        <div className="h-4 w-px" style={{ background: "var(--border-hover)" }} />
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-white">{title}</span>
          {myRole === "chef" && <span className="badge badge-blue">Chef</span>}
        </div>
      </div>
    </header>
  );

  if (loading) {
    return (
      <AuthGuard>
        <div className="relative min-h-screen">
          {bgShell}
          <div className="page-loading">
            <BottleLoader label="Team wird geladen..." />
          </div>
        </div>
      </AuthGuard>
    );
  }

  const chefs = team.filter(m => m.role === "chef");
  const mitarbeiter = team.filter(m => m.role === "mitarbeiter");

  // ─── MITARBEITER-ANSICHT ─────────────────────────────────────────
  if (myRole !== "chef") {
    return (
      <AuthGuard>
        <div className="relative min-h-screen">
          {bgShell}
          <PageHeader title="Team" />
          <main className="mx-auto max-w-3xl px-5 sm:px-8 pt-10 pb-20 space-y-6">
            {org && (
              <div className="reveal">
                <p className="text-[10.5px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Organisation</p>
                <h1 className="text-[26px] font-semibold tracking-tight text-white">{org.name}</h1>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 reveal" style={{ animationDelay: "0.06s" }}>
              {[
                { label: "Chefs", value: chefs.length, color: "#a78bfa" },
                { label: "Mitarbeiter", value: mitarbeiter.length, color: "var(--accent)" },
              ].map(s => (
                <SpotlightCard key={s.label} className="rounded-xl p-5"
                  style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-inset)" }}>
                  <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted">{s.label}</p>
                  <p className="mt-2 text-[28px] font-semibold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                </SpotlightCard>
              ))}
            </div>

            <div className="reveal" style={{ animationDelay: "0.14s" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold text-white">Team-Mitglieder</p>
                <span className="badge badge-gray">{team.length} Personen</span>
              </div>
              <p className="text-[11.5px] text-muted mb-4">Für Mitarbeiter sind nur Vornamen und Rollen sichtbar.</p>
              <div className="space-y-2">
                {team.map(m => (
                  <div key={m.user_id} className="flex items-center gap-3 rounded-xl p-3.5 transition-colors"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
                    <Avatar name={m.vorname || "?"} role={m.role} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white truncate">
                        {m.vorname || "Unbekannt"}
                        {m.user_id === currentUserId && <span className="ml-1.5 text-[11px] text-muted">(du)</span>}
                      </p>
                      <p className="text-[11.5px] text-muted">{m.role === "chef" ? "Chef" : "Mitarbeiter"}</p>
                    </div>
                    <span className={`badge ${m.role === "chef" ? "badge-blue" : "badge-gray"}`}>
                      {m.role === "chef" ? "Chef" : "Mitarbeiter"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </AuthGuard>
    );
  }

  // ─── CHEF-ANSICHT ────────────────────────────────────────────────
  return (
    <AuthGuard>
      <div className="relative min-h-screen">
        {bgShell}
        <PageHeader title="Team-Verwaltung" />

        <main className="mx-auto max-w-4xl px-5 sm:px-8 pt-10 pb-20 space-y-6">
          {org && (
            <div className="reveal">
              <p className="text-[10.5px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>Organisation</p>
              <h1 className="text-[26px] font-semibold tracking-tight text-white">{org.name}</h1>
            </div>
          )}

          {/* Mitarbeiter anlegen */}
          <SpotlightCard className="rounded-xl p-6 reveal" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-inset)", animationDelay: "0.06s" }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-white">Mitarbeiter anlegen</h2>
                <p className="text-[11.5px] text-muted">Anfrage wird an den Admin zur Freigabe gesendet</p>
              </div>
            </div>

            <form onSubmit={handleInvite} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1.5">E-Mail</label>
                  <input required type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@restaurant.de" className="input" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1.5">Vorname</label>
                  <input value={inviteVorname} onChange={e => setInviteVorname(e.target.value)} placeholder="z.B. Lisa" className="input" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-medium text-muted">Passwort (min. 8 Zeichen)</label>
                    <button type="button" onClick={() => setShowInvitePw(!showInvitePw)}
                      className="text-[11px] text-muted hover:text-white transition-colors">
                      {showInvitePw ? "Verbergen" : "Anzeigen"}
                    </button>
                  </div>
                  <input required type={showInvitePw ? "text" : "password"} value={invitePassword}
                    onChange={e => setInvitePassword(e.target.value)} minLength={8} placeholder="••••••••" className="input" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted mb-1.5">Rolle</label>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value as any)} className="input">
                    <option value="mitarbeiter">Mitarbeiter</option>
                    <option value="chef">Chef</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={inviting} className="btn-primary w-full">
                {inviting ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Wird gesendet...
                  </>
                ) : "Anfrage an Admin senden"}
              </button>
            </form>

            {inviteMsg && (
              <div className="mt-3 rounded-lg p-3 text-[12px] animate-fade-in"
                style={{
                  background: inviteMsg.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${inviteMsg.ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                  color: inviteMsg.ok ? "var(--green)" : "var(--red)",
                }}>
                {inviteMsg.text}
              </div>
            )}
          </SpotlightCard>

          {/* Team-Liste */}
          <SpotlightCard className="rounded-xl overflow-hidden reveal" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", animationDelay: "0.14s" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-[13px] font-semibold text-white">Team</h2>
              <span className="badge badge-gray">{team.length} {team.length === 1 ? "Person" : "Personen"}</span>
            </div>

            <div>
              {team.map((m, idx) => (
                <div key={m.user_id}
                  className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-[rgba(255,255,255,0.018)]"
                  style={{ borderBottom: idx < team.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <Avatar name={m.vorname || "?"} role={m.role} />
                  <div className="flex-1 min-w-0">
                    <button onClick={() => openAudit(m)}
                      className="group flex items-center gap-1 transition-colors hover:text-accent">
                      <span className="text-[13px] font-medium text-white group-hover:text-accent transition-colors">
                        {m.vorname || "—"}
                      </span>
                      {m.user_id === currentUserId && <span className="text-[11px] text-muted ml-1">(du)</span>}
                      <svg className="h-3 w-3 text-muted group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                    <p className="text-[11.5px] text-muted">
                      {emailMap[m.user_id] || (m.user_id === currentUserId ? "" : "(verdeckt)")}
                      {m.zuletzt_aktiv && ` · ${new Date(m.zuletzt_aktiv).toLocaleDateString("de-DE")}`}
                    </p>
                  </div>

                  <select
                    value={m.role}
                    onChange={e => handleRoleChange(m.user_id, e.target.value as any)}
                    disabled={m.user_id === currentUserId}
                    className="input cursor-pointer disabled:opacity-50"
                    style={{ width: "auto", paddingRight: "28px", fontSize: "12px" }}>
                    <option value="mitarbeiter">Mitarbeiter</option>
                    <option value="chef">Chef</option>
                  </select>

                  {m.user_id !== currentUserId ? (
                    <button onClick={() => handleRemove(m.user_id)}
                      className="btn-ghost text-[12px] shrink-0"
                      style={{ color: "var(--red)", padding: "4px 10px" }}>
                      Entfernen
                    </button>
                  ) : (
                    <div style={{ width: "74px" }} />
                  )}
                </div>
              ))}
            </div>
          </SpotlightCard>

          {/* Offene Einladungen */}
          {einladungen.length > 0 && (
            <div className="reveal" style={{ animationDelay: "0.22s" }}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-[13px] font-semibold text-white">Offene Einladungen</h2>
                <span className="badge badge-orange">{einladungen.length}</span>
              </div>
              <div className="space-y-2">
                {einladungen.map(e => (
                  <div key={e.id} className="flex items-center justify-between rounded-xl p-4"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-white truncate">{e.email}</p>
                      <p className="text-[11.5px] text-muted">
                        {e.vorname || "—"} · {e.rolle}
                        {e.erstellt_am && ` · ${new Date(e.erstellt_am).toLocaleDateString("de-DE")}`}
                      </p>
                    </div>
                    <button onClick={() => handleDeleteInvite(e.id!)}
                      className="btn-ghost text-[12px] shrink-0 ml-3"
                      style={{ color: "var(--red)" }}>
                      Löschen
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        <AuditDrawer
          member={auditMember}
          entries={auditEntries}
          loading={auditLoading}
          onClose={() => setAuditMember(null)}
        />
      </div>
    </AuthGuard>
  );
}
