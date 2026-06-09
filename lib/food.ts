// ─────────────────────────────────────────────────────────────────────────────
// Food-Helfer: MHD-Status (Mindesthaltbarkeit) zentral & einheitlich berechnen.
// Genutzt von Lieferschein (Erfassung), Freigabe (Warnungen) und Detail (Anzeige).
// ─────────────────────────────────────────────────────────────────────────────

export type MhdTone = "expired" | "critical" | "soon" | "ok" | "unknown";

export interface MhdStatus {
  tone: MhdTone;
  /** Tage bis zum MHD (negativ = abgelaufen), oder null wenn nicht parsebar. */
  days: number | null;
  label: string;
}

// Schwellen (in Tagen) für die Kühlhaus-Praxis. ≤0 abgelaufen, ≤3 kritisch, ≤7 bald.
const KRITISCH_TAGE = 3;
const BALD_TAGE = 7;

// Parst gängige MHD-Formate: YYYY-MM-DD, DD.MM.YYYY, DD.MM.YY.
export function parseMhd(mhd?: string | null): Date | null {
  if (!mhd) return null;
  const s = mhd.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) {
    const jahr = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(jahr, Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function mhdStatus(mhd?: string | null, referenz: Date = new Date()): MhdStatus {
  const d = parseMhd(mhd);
  if (!d) return { tone: "unknown", days: null, label: mhd?.trim() || "—" };

  const ref = new Date(referenz.getFullYear(), referenz.getMonth(), referenz.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((target.getTime() - ref.getTime()) / 86400000);

  const fmt = target.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (days < 0) return { tone: "expired", days, label: `${fmt} · abgelaufen` };
  if (days <= KRITISCH_TAGE) return { tone: "critical", days, label: `${fmt} · in ${days} T.` };
  if (days <= BALD_TAGE) return { tone: "soon", days, label: `${fmt} · in ${days} T.` };
  return { tone: "ok", days, label: fmt };
}

// Tailwind-Klassen je Tonalität (dunkles Theme).
export const MHD_TONE_CLASS: Record<MhdTone, string> = {
  expired: "bg-red-500/20 text-red-300 border border-red-500/40",
  critical: "bg-red-500/15 text-red-300 border border-red-500/30",
  soon: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
  ok: "bg-green-500/10 text-green-300 border border-green-500/20",
  unknown: "bg-surface text-muted border border-border",
};
