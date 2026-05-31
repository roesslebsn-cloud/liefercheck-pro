"use client";

import { useState, useEffect } from "react";

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
  const [lieferdatum, setLieferdatum] = useState<string>("");

  useEffect(() => {
    const savedDate = localStorage.getItem("lieferdatum");
    if (savedDate) {
      const date = new Date(savedDate);
      setLieferdatum(
        date.toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      );
    }
  }, []);

  return (
    <div className="border-b border-border bg-surface-elevated">
      <div className="mx-auto max-w-6xl px-6 py-4">
        {lieferdatum && (
          <div className="mb-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-muted/50 px-4 py-1.5 text-sm font-medium text-accent ring-1 ring-accent/20">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V7.5m0 11.25h18"
                />
              </svg>
              Lieferdatum: {lieferdatum}
            </span>
          </div>
        )}
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
