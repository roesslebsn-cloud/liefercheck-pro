"use client";

interface ProgressBarProps {
  currentStep: number;
  lieferungId?: string | null;
  lieferdatum?: string | null;
}

const steps = [
  { number: 1, label: "Pfand", path: "/lieferung/pfand" },
  { number: 2, label: "Lieferschein", path: "/lieferung/lieferschein" },
  { number: 3, label: "Abgleich", path: "/lieferung/abgleich" },
  { number: 4, label: "Rechnung", path: "/lieferung/rechnung" },
  { number: 5, label: "Freigabe", path: "/lieferung/freigabe" },
];

export default function ProgressBar({ currentStep, lieferungId, lieferdatum }: ProgressBarProps) {
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

  const progressPct = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className="border-b border-border bg-surface/50">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 py-5">
        {lieferdatum && (
          <div className="mb-5 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[11.5px] font-medium" style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V7.5m0 11.25h18" />
              </svg>
              Lieferdatum {formatDate(lieferdatum)}
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="relative">
          {/* Background line */}
          <div className="absolute left-0 right-0 top-[14px] h-[1px]" style={{ background: "var(--border)" }} />
          {/* Progress line */}
          <div className="absolute left-0 top-[14px] h-[1px] transition-all duration-500" style={{ width: `${progressPct}%`, background: "var(--accent)" }} />

          <div className="relative flex items-start justify-between">
            {steps.map((step) => {
              const isActive = currentStep === step.number;
              const isDone = currentStep > step.number;
              return (
                <div key={step.number} className="flex flex-col items-center">
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
                    ) : step.number}
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
