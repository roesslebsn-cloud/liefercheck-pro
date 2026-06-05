"use client";

import { useId, useState } from "react";

export type TrendPoint = { label: string; value: number };

// Dependency-freier SVG-Trend (Fläche + Linie + Hover-Tooltip).
// Plottet `value` direkt gegen das Maximum – der Aufrufer entscheidet, ob er
// kumulierte oder rohe Werte übergibt. viewBox 0..100 mit preserveAspectRatio="none",
// damit das HTML-Hover-Overlay (in %) deckungsgleich liegt.
export function TrendChart({
  data,
  color = "var(--green)",
  height = 120,
  formatValue = (n: number) => n.toFixed(0),
  emptyHint = "Zu wenig Daten für einen Verlauf.",
}: {
  data: TrendPoint[];
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
  emptyHint?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = `tc-${useId().replace(/[:]/g, "")}`;

  const maxVal = Math.max(1, ...data.map((d) => d.value));
  const coords = data.map((p, i) => ({
    x: data.length === 1 ? 50 : (i / (data.length - 1)) * 100,
    y: 92 - (p.value / maxVal) * 78, // Bereich 14..92
    ...p,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ");
  const areaPath = coords.length ? `${linePath} L 100 100 L 0 100 Z` : "";

  if (coords.length < 2) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border text-center"
        style={{ height }}
      >
        <p className="text-[11.5px] text-muted px-4">{emptyHint}</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path className="trend-area" d={areaPath} fill={`url(#${gid})`} />
          <path
            className="trend-line"
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>

        {hover !== null && coords[hover] && (
          <>
            <div className="pointer-events-none absolute top-0 bottom-0 w-px" style={{ left: `${coords[hover].x}%`, background: "rgba(255,255,255,0.18)" }} />
            <div
              className="pointer-events-none absolute h-2.5 w-2.5 rounded-full ring-2"
              style={{ left: `${coords[hover].x}%`, top: `${coords[hover].y}%`, transform: "translate(-50%,-50%)", background: color, boxShadow: `0 0 0 4px ${color}30` }}
            />
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-center"
              style={{ left: `${Math.min(88, Math.max(12, coords[hover].x))}%`, top: 0, background: "var(--surface-hover)", border: "1px solid var(--border-hover)", boxShadow: "var(--shadow)" }}
            >
              <p className="text-[11px] font-semibold tabular-nums text-white">{formatValue(coords[hover].value)}</p>
              <p className="text-[10px] text-muted">{coords[hover].label}</p>
            </div>
          </>
        )}

        {/* Unsichtbare Hover-Spalten */}
        <div className="absolute inset-0 flex">
          {coords.map((_, i) => (
            <div key={i} className="h-full flex-1 cursor-crosshair" onMouseEnter={() => setHover(i)} />
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[10.5px] text-muted">
        <span>{coords[0].label}</span>
        <span>{coords[coords.length - 1].label}</span>
      </div>
    </>
  );
}
