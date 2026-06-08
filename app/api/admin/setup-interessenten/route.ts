import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSuperAdminEmail } from "@/lib/admin";

export async function POST(req: NextRequest) {
  // Admin-Check via Service-Role
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Caller-Auth prüfen
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Kein Token" }, { status: 401 });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  if (!isSuperAdminEmail(user.email)) return NextResponse.json({ error: "Kein Admin" }, { status: 403 });

  // Tabelle anlegen
  const sql = `
    CREATE TABLE IF NOT EXISTS public.interessenten (
      id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      name        text NOT NULL,
      firma       text,
      email       text NOT NULL,
      telefon     text,
      paket       text,
      nachricht   text,
      status      text DEFAULT 'neu' CHECK (status IN ('neu','kontaktiert','umgewandelt','abgelehnt')),
      erstellt_am timestamptz DEFAULT now()
    );
    ALTER TABLE public.interessenten ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interessenten' AND policyname = 'Admins lesen Interessenten'
      ) THEN
        CREATE POLICY "Admins lesen Interessenten" ON public.interessenten FOR SELECT USING (auth.role() = 'authenticated');
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interessenten' AND policyname = 'Admins aendern Interessenten'
      ) THEN
        CREATE POLICY "Admins aendern Interessenten" ON public.interessenten FOR UPDATE USING (auth.role() = 'authenticated');
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'interessenten' AND policyname = 'Service insert Interessenten'
      ) THEN
        CREATE POLICY "Service insert Interessenten" ON public.interessenten FOR INSERT WITH CHECK (true);
      END IF;
    END $$;
  `;

  const { error } = await sb.rpc("exec_sql", { sql }).catch(() => ({ error: { message: "rpc nicht verfügbar" } }));

  // Fallback: direkt per raw SQL via REST (Supabase erlaubt das mit service role)
  if (error) {
    // Versuche direkt via pg_dump nicht möglich, aber wir können prüfen ob Tabelle existiert
    const { error: checkErr } = await sb.from("interessenten").select("id").limit(1);
    if (!checkErr) {
      return NextResponse.json({ ok: true, message: "Tabelle existiert bereits" });
    }
    return NextResponse.json({
      error: "Automatische Einrichtung fehlgeschlagen. Bitte SQL manuell ausführen.",
      sql: sql.trim()
    }, { status: 422 });
  }

  return NextResponse.json({ ok: true, message: "Tabelle erfolgreich angelegt" });
}
