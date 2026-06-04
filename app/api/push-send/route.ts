import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

webpush.setVapidDetails(
  "mailto:liefercheck@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

export async function POST(request: NextRequest) {
  try {
    const { user_id, title, body, url } = await request.json();

    let query = supabase.from("push_subscriptions").select("subscription");
    if (user_id) query = query.eq("user_id", user_id);

    const { data: subscriptions } = await query;
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const payload = JSON.stringify({ title, body, url: url || "/dashboard" });
    let sent = 0;

    await Promise.allSettled(
      subscriptions.map(async (row: any) => {
        try {
          const sub = typeof row.subscription === "string" ? JSON.parse(row.subscription) : row.subscription;
          await webpush.sendNotification(sub, payload);
          sent++;
        } catch (e) {
          console.error("[Push-Send] Fehler für Subscription:", e);
        }
      })
    );

    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    console.error("[Push-Send] Fehler:", error);
    return NextResponse.json({ error: "Push fehlgeschlagen" }, { status: 500 });
  }
}
