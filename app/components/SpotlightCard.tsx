"use client";

import React from "react";

// Karten-Wrapper mit maus-folgendem Glow (CSS-Variablen --mouse-x/--mouse-y).
// Geteilt von Dashboard + Admin-Cockpit.
export function SpotlightCard({
  children,
  className = "",
  onClick,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };
  return (
    <div className={`spotlight-card spotlight-border ${className}`} onMouseMove={handleMouseMove} onClick={onClick} style={style}>
      {children}
    </div>
  );
}
