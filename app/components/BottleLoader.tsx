"use client";

export default function BottleLoader({ label = "Wird geladen..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: 52, height: 96 }}>
        <svg viewBox="0 0 52 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <clipPath id="lc-bottle">
              <path d="M20 5 L20 8 C15 10 12 18 12 24 L12 70 C12 80 18 86 26 86 C34 86 40 80 40 70 L40 24 C40 18 37 10 32 8 L32 5 Z" />
            </clipPath>
            <linearGradient id="lc-liquid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#059669" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="lc-highlight" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          {/* Liquid fill — animiert von unten hoch */}
          <rect x="0" y="0" width="52" height="96" fill="url(#lc-liquid)" clipPath="url(#lc-bottle)" className="lc-liquid-fill" />

          {/* Highlight on liquid */}
          <rect x="0" y="0" width="52" height="96" fill="url(#lc-highlight)" clipPath="url(#lc-bottle)" className="lc-liquid-fill" style={{ opacity: 0.6 }} />

          {/* Bubbles inside bottle */}
          <g clipPath="url(#lc-bottle)">
            <circle cx="19" cy="72" r="2"   fill="rgba(255,255,255,0.3)" className="lc-bubble lc-bubble-1" />
            <circle cx="30" cy="78" r="1.5" fill="rgba(255,255,255,0.25)" className="lc-bubble lc-bubble-2" />
            <circle cx="24" cy="64" r="1"   fill="rgba(255,255,255,0.2)" className="lc-bubble lc-bubble-3" />
          </g>

          {/* Bottle outline */}
          <path
            d="M20 5 L20 8 C15 10 12 18 12 24 L12 70 C12 80 18 86 26 86 C34 86 40 80 40 70 L40 24 C40 18 37 10 32 8 L32 5"
            stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="none"
            strokeLinejoin="round" strokeLinecap="round"
          />

          {/* Label strip on bottle */}
          <rect x="14" y="46" width="24" height="22" rx="2" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" clipPath="url(#lc-bottle)" />
          <text x="26" y="59" textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.2)" fontFamily="system-ui">LC</text>

          {/* Cap */}
          <rect x="19" y="2" width="14" height="4" rx="1.5" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
        </svg>
      </div>
      {label && (
        <p className="text-[12px] animate-pulse" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
      )}
    </div>
  );
}
