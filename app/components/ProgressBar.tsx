interface ProgressBarProps {
  currentStep: number;
}

const steps = [
  { number: 1, label: "Pfand", path: "/lieferung/pfand" },
  { number: 2, label: "Lieferschein", path: "/lieferung/lieferschein" },
  { number: 3, label: "Abgleich", path: "/lieferung/abgleich" },
  { number: 4, label: "Rechnung", path: "/lieferung/rechnung" },
  { number: 5, label: "Freigabe", path: "/lieferung/freigabe" },
];

export default function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="border-b border-border bg-surface-elevated">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <a
                  href={step.path}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    currentStep === step.number
                      ? "bg-accent text-white"
                      : currentStep > step.number
                      ? "bg-accent-muted text-accent"
                      : "bg-surface text-muted"
                  }`}
                >
                  {currentStep > step.number ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  ) : (
                    step.number
                  )}
                </a>
                <span
                  className={`mt-2 text-xs ${
                    currentStep === step.number
                      ? "text-white font-medium"
                      : "text-muted"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-16 ${
                    currentStep > step.number ? "bg-accent" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
