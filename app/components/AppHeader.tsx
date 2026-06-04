"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { getUserRole } from "../../lib/database";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userRole, setUserRole] = useState<"chef" | "mitarbeiter">("mitarbeiter");

  useEffect(() => {
    getUserRole().then(setUserRole).catch(() => {});
  }, []);

  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Analyse", path: "/analytics" },
    { label: "Lieferanten", path: "/lieferanten" },
    { label: "Standorte", path: "/standorte" },
    ...(userRole === "chef" ? [{ label: "Einstellungen", path: "/einstellungen" }] : []),
  ];

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + "/");

  return (
    <header className="header-backdrop sticky top-0 z-30">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-md relative overflow-hidden transition-transform duration-300 group-hover:scale-105"
              style={{ background: "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)", boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset, 0 4px 12px rgba(91,108,255,0.3)" }}>
              <svg className="h-3.5 w-3.5 text-white relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9.75 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold tracking-tight text-white transition-colors">LieferCheck</span>
            {userRole === "chef" && <span className="badge badge-blue">Chef</span>}
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              const active = isActive(item.path);
              return (
                <button key={item.path} onClick={() => router.push(item.path)}
                  className="relative text-[13px] font-medium transition-all duration-200 px-3 py-1.5 rounded-md group/nav"
                  style={{ color: active ? "var(--text)" : "var(--text-muted)" }}>
                  {active && (
                    <span className="absolute inset-0 rounded-md transition-all"
                      style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }} />
                  )}
                  <span className="relative">{item.label}</span>
                  {!active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-accent transition-all duration-300 group-hover/nav:w-3/4" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <LogoutButton />
        </div>

        <button className="md:hidden p-2 rounded-md text-muted hover:text-white transition-colors" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            {mobileNavOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
          </svg>
        </button>
      </div>

      {mobileNavOpen && (
        <div className="md:hidden border-t border-border bg-surface px-5 py-3 space-y-1 animate-slide-up">
          {navItems.map(item => {
            const active = isActive(item.path);
            return (
              <button key={item.path} onClick={() => { router.push(item.path); setMobileNavOpen(false); }}
                className="w-full text-left rounded-md px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  color: active ? "var(--text)" : "var(--text-muted)",
                  background: active ? "var(--surface-elevated)" : "transparent",
                }}>
                {item.label}
              </button>
            );
          })}
          <LogoutButton />
        </div>
      )}
    </header>
  );
}
