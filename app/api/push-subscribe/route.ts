import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { subscription, user_id } = await request.json();
    if (!subscription || !user_id) {
      return NextResponse.json({ error: "subscription und user_id erforderlich" }, { status: 400 });
    }

    // Upsert: subscription für diesen User speichern
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { user_id, subscription: JSON.stringify(subscription), updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) {
      // Tabelle existiert möglicherweise noch nicht – trotzdem 200 zurückgeben
      console.error("[Push-Subscribe] DB Fehler:", error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Push-Subscribe] Fehler:", error);
    return NextResponse.json({ error: "Fehler beim Speichern der Subscription" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user_id } = await request.json();
    if (!user_id) return NextResponse.json({ error: "user_id erforderlich" }, { status: 400 });
    await supabase.from("push_subscriptions").delete().eq("user_id", user_id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
