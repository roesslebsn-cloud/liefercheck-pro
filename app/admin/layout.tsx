"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { isSuperAdminEmail } from "../../lib/admin";
import LogoutButton from "../components/LogoutButton";

const NAV = [
  { label: "Übersicht", path: "/admin" },
  { label: "Anfragen", path: "/admin/anfragen" },
  { label: "Kunden", path: "/admin/kunden" },
  { label: "Standorte", path: "/admin/standorte" },
  { label: "Plattform", path: "/admin/plattform" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      if (!isSuperAdminEmail(user.email)) { router.replace("/dashboard"); return; }
      setAuthorized(true);
    })();
  }, [router]);

  // Aktiver Nav-Punkt: exakte Übereinstimmung für /admin, sonst Präfix-Match.
  const isActive = (path: string) =>
    path === "/admin" ? pathname === "/admin" : pathname.startsWith(path);

  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Wird geladen…
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="aurora-bg" />
      <div
        className="fixed inset-0 grid-bg pointer-events-none"
        style={{ zIndex: -1, maskImage: "radial-gradient(ellipse at center, #000 0%, transparent 70%)" }}
      />

      <header className="header-backdrop sticky top-0 z-30">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md relative overflow-hidden" style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)" }}>
                <svg className="h-3.5 w-3.5 text-white relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <span className="text-[14px] font-semibold tracking-tight text-white">LieferCheck</span>
              <span className="badge" style={{ background: "rgba(239,68,68,0.14)", color: "#f87171", boxShadow: "inset 0 0 0 1px rgba(239,68,68,0.22)" }}>Admin</span>
            </div>

            <nav className="hidden sm:flex items-center gap-4">
              {NAV.map((item) => (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`underline-grow text-[13px] font-medium transition-colors py-1.5 ${isActive(item.path) ? "text-white" : "text-muted hover:text-white"}`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")} className="text-[13px] text-muted hover:text-white transition-colors">
              Zum Dashboard
            </button>
            <LogoutButton />
          </div>

          <button className="sm:hidden p-2 rounded-md text-muted hover:text-white" onClick={() => setMobileOpen(!mobileOpen)}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div className="sm:hidden border-t border-border bg-surface px-5 py-3 space-y-1 animate-slide-up">
            {NAV.map((item) => (
              <button
                key={item.path}
                onClick={() => { router.push(item.path); setMobileOpen(false); }}
                className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive(item.path) ? "bg-surface-elevated text-white" : "text-muted hover:bg-surface-elevated hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
            <button onClick={() => { router.push("/dashboard"); setMobileOpen(false); }} className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-surface-elevated hover:text-white transition-colors">
              Zum Dashboard
            </button>
            <LogoutButton />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1200px] px-5 sm:px-8 pt-10 pb-20 relative">
        {children}
      </main>
    </div>
  );
}
