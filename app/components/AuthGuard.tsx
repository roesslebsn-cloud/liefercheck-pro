"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMeineOrgStatus } from "@/lib/database";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/");
        return;
      }

      // Gesperrte Kunden aussperren (Org-Status vom Admin gesetzt)
      const status = await getMeineOrgStatus();
      if (status === "gesperrt") {
        await supabase.auth.signOut();
        router.replace("/?gesperrt=1");
        return;
      }

      setIsLoading(false);
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">Wird geladen…</p>
      </div>
    );
  }

  return <>{children}</>;
}
