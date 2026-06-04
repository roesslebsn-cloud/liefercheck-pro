"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function PasswortBanner() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("user_settings")
          .select("passwort_temporaer, role")
          .eq("user_id", user.id)
          .single();
        if (data?.passwort_temporaer && data?.role === "chef") {
          setShow(true);
        }
      } catch {}
    })();
  }, []);

  if (!show) return null;

  return (
    <div
      className="sticky top-0 z-50 w-full"
      style={{
        background: "linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #dc2626 100%)",
        boxShadow: "0 4px 16px rgba(220,38,38,0.4)",
        animation: "pulse-red 2s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes pulse-red {
          0%, 100% { box-shadow: 0 4px 16px rgba(220,38,38,0.4); }
          50% { box-shadow: 0 4px 32px rgba(220,38,38,0.8); }
        }
      `}</style>
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 flex-shrink-0 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            <p className="text-sm font-bold text-white">Sicherheitswarnung: Dein Passwort ist temporär</p>
            <p className="text-xs text-white/90">Bitte ändere dein Passwort jetzt — der Admin kennt dein aktuelles Passwort.</p>
          </div>
        </div>
        <button
          onClick={() => { window.location.href = "/einstellungen#passwort"; }}
          className="flex-shrink-0 rounded-md bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 transition-colors shadow-md"
        >
          Jetzt ändern
        </button>
      </div>
    </div>
  );
}
