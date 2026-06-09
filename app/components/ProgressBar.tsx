"use client";

import { LieferungTyp } from "../../lib/types";

export type StepKey = "pfand" | "lieferschein" | "abgleich" | "rechnung" | "freigabe";

interface ProgressBarProps {
  /** Aktueller Schritt als Schlüssel, oder null auf der Start-/Übersichtsseite. */
  current: StepKey | null;
  /** Lieferungstyp – bestimmt, ob der Pfand-Schritt angezeigt wird. */
  typ?: LieferungTyp;
  lieferungId?: string | null;
  lieferdatum?: string | null;
}

interface StepDef {
  key: StepKey;
  label: string;
  path: string;
  /** true = Schritt ist auch im Food-Workflow Teil der Kette. */
  food: boolean;
}

const ALL_STEPS: StepDef[] = [
  { key: "pfand", label: "Pfand", path: "/lieferung/pfand", food: false },
  { key: "lieferschein", label: "Lieferschein", path: "/lieferung/lieferschein", food: true },
  { key: "abgleich", label: "Abgleich", path: "/lieferung/abgleich", food: true },
  { key: "rechnung", label: "Rechnung", path: "/lieferung/rechnung", food: true },
  { key: "freigabe", label: "Freigabe", path: "/lieferung/freigabe", food: true },
];

export default function ProgressBar({ current, typ = "getraenke", lieferungId, lieferdatum }: ProgressBarProps) {
  const steps = ALL_STEPS.filter((s) => typ !== "food" || s.food);
  const currentIndex = steps.findIndex((s) => s.key === current); // -1 auf Startseite

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("de-DE", {
        day: "2-digit", month: "short", year: "numeric",
      });
    } catch { return dateStr; }
  };

  const buildStepPath = (basePath: string) => {
    if (!lieferungId) return basePath;
    const params = new URLSearchParams({ id: lieferungId });
    if (lieferdatum) params.set("date", lieferdatum);
    return `${basePath}?${params.toString()}`;
  };

  const progressPct = currentIndex <= 0 ? 0 : (currentIndex / (steps.length - 1)) * 100;

  return (
    <div className="border-b border-border bg-surface/50">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 py-5">
        <div className="mb-5 flex flex-wrap justify-center gap-2">
          {lieferdatum && (
            <div className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[11.5px] font-medium" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V7.5m0 11.25h18" />
              </svg>
              Lieferdatum {formatDate(lieferdatum)}
            </div>
          )}
          <div className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[11.5px] font-medium"
            style={{
              background: typ === "food" ? "rgba(245,158,11,0.12)" : "var(--accent-muted)",
              border: `1px solid ${typ === "food" ? "rgba(245,158,11,0.3)" : "var(--accent)"}`,
              color: typ === "food" ? "#f59e0b" : "var(--accent)",
            }}>
            {typ === "food" ? "🍽 Food" : "🍺 Getränke"}
          </div>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Background line */}
          <div className="absolute left-0 right-0 top-[14px] h-[1px]" style={{ background: "var(--border)" }} />
          {/* Progress line */}
          <div className="absolute left-0 top-[14px] h-[1px] transition-all duration-500" style={{ width: `${progressPct}%`, background: "var(--accent)" }} />

          <div className="relative flex items-start justify-between">
            {steps.map((step, idx) => {
              const isActive = currentIndex === idx;
              const isDone = currentIndex > idx;
              return (
                <div key={step.key} className="flex flex-col items-center">
                  <a href={buildStepPath(step.path)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11.5px] font-semibold transition-all"
                    style={{
                      background: isDone || isActive ? "var(--accent)" : "var(--surface-elevated)",
                      border: `1px solid ${isDone || isActive ? "var(--accent)" : "var(--border)"}`,
                      color: isDone || isActive ? "#fff" : "var(--text-muted)",
                      boxShadow: isActive ? "0 0 0 4px var(--accent-muted)" : "none",
                    }}>
                    {isDone ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : idx + 1}
                  </a>
                  <span className={`mt-2 text-[11.5px] tracking-tight ${isActive ? "font-medium text-white" : "text-muted"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
