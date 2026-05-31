import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Check environment variables at startup
const CRON_SECRET = process.env.CRON_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!CRON_SECRET) {
  throw new Error("CRON_SECRET environment variable is missing");
}
if (!RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY environment variable is missing");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is missing");
}
if (!SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable is missing");
}

const resend = new Resend(RESEND_API_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const testMode = searchParams.get("test") === "true";

    // Verify cron secret header (skip for test mode)
    if (!testMode) {
      const cronSecret = request.headers.get("x-cron-secret");
      if (cronSecret !== CRON_SECRET) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // Get all users
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) {
      console.error("Error fetching users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekNumber = getWeekNumber(now);

    // Process each user
    for (const user of users.users) {
      try {
        // Get user settings
        const { data: settings } = await supabaseAdmin
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .single();

        // Skip if weekly report is disabled
        if (settings && !settings.wochen_bericht_aktiv) {
          continue;
        }

        // Get user's lieferungen from last 7 days
        const { data: lieferungen } = await supabaseAdmin
          .from("lieferungen")
          .select("*")
          .eq("user_id", user.id)
          .gte("created_at", sevenDaysAgo.toISOString())
          .order("created_at", { ascending: false });

        if (!lieferungen || lieferungen.length === 0) {
          // Send "no deliveries" email
          if (user.email) {
            await sendNoDeliveriesEmail(user.email, weekNumber);
          }
          continue;
        }

        // Calculate stats
        const totalLieferungen = lieferungen.length;
        const totalErsparnis = lieferungen.reduce(
          (sum, l) => sum + (l.ersparnis_eur || 0),
          0
        );
        let totalAbweichungen = 0;

        lieferungen.forEach((l: any) => {
          if (l.abgleich_data?.abgleich) {
            totalAbweichungen += l.abgleich_data.abgleich.filter(
              (item: any) => item.status !== "ok"
            ).length;
          }
        });

        // Send weekly report email
        if (user.email) {
          await sendWeeklyReportEmail(
            user.email,
            weekNumber,
            totalLieferungen,
            totalErsparnis,
            totalAbweichungen
          );
        }
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
        // Continue with next user instead of crashing
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in weekly report cron:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}

async function sendWeeklyReportEmail(
  email: string,
  weekNumber: number,
  totalLieferungen: number,
  totalErsparnis: number,
  totalAbweichungen: number
) {
  const subject = `Ihr LieferCheck Wochenbericht - KW ${weekNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #0f172a;
          color: #f1f5f9;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #1e293b;
          border-radius: 12px;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: white;
        }
        .content {
          padding: 30px;
        }
        .stats {
          background-color: #0f172a;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .stat-item {
          margin-bottom: 15px;
        }
        .stat-label {
          font-size: 14px;
          color: #94a3b8;
          margin-bottom: 5px;
        }
        .stat-value {
          font-size: 18px;
          font-weight: 600;
          color: #f1f5f9;
        }
        .highlight {
          background-color: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
        }
        .highlight h2 {
          margin: 0 0 10px 0;
          font-size: 28px;
          font-weight: 700;
          color: #22c55e;
        }
        .highlight p {
          margin: 0;
          font-size: 14px;
          color: #94a3b8;
        }
        .cta-button {
          display: inline-block;
          background-color: #3b82f6;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          margin: 20px 0;
        }
        .footer {
          background-color: #0f172a;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LieferCheck Pro</h1>
        </div>
        <div class="content">
          <h2 style="margin: 0 0 10px 0; font-size: 20px;">Ihre Woche im Überblick:</h2>
          
          <div class="highlight">
            <h2>${totalErsparnis.toFixed(2)} EUR</h2>
            <p>gespart</p>
          </div>
          
          <div class="stats">
            <div class="stat-item">
              <div class="stat-label">Lieferungen geprüft</div>
              <div class="stat-value">${totalLieferungen}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Abweichungen gefunden</div>
              <div class="stat-value">${totalAbweichungen}</div>
            </div>
          </div>
          
          ${totalErsparnis > 0 ? `
            <div class="highlight">
              <p style="font-size: 16px; color: #22c55e;">
                Sie haben diese Woche ${totalErsparnis.toFixed(2)} EUR an falschen Rechnungen verhindert
              </p>
            </div>
          ` : ''}
          
          <div style="text-align: center;">
            <a href="https://liefercheck.de/dashboard" class="cta-button">Dashboard öffnen</a>
          </div>
        </div>
        <div class="footer">
          LieferCheck Pro | <a href="#" style="color: #64748b; text-decoration: none;">Abmelden</a>
        </div>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: "bericht@liefercheck.de",
    to: email,
    subject,
    html,
  });
}

async function sendNoDeliveriesEmail(email: string, weekNumber: number) {
  const subject = `Ihr LieferCheck Wochenbericht - KW ${weekNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #0f172a;
          color: #f1f5f9;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #1e293b;
          border-radius: 12px;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: white;
        }
        .content {
          padding: 30px;
        }
        .message {
          background-color: #0f172a;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
        }
        .message p {
          margin: 0;
          font-size: 16px;
          color: #94a3b8;
        }
        .cta-button {
          display: inline-block;
          background-color: #3b82f6;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          margin: 20px 0;
        }
        .footer {
          background-color: #0f172a;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>LieferCheck Pro</h1>
        </div>
        <div class="content">
          <h2 style="margin: 0 0 10px 0; font-size: 20px;">Ihre Woche im Überblick:</h2>
          
          <div class="message">
            <p>Diese Woche keine Lieferungen - denken Sie daran LieferCheck bei der nächsten Lieferung zu nutzen</p>
          </div>
          
          <div style="text-align: center;">
            <a href="https://liefercheck.de/dashboard" class="cta-button">Dashboard öffnen</a>
          </div>
        </div>
        <div class="footer">
          LieferCheck Pro | <a href="#" style="color: #64748b; text-decoration: none;">Abmelden</a>
        </div>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: "bericht@liefercheck.de",
    to: email,
    subject,
    html,
  });
}
