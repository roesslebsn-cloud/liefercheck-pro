"use client";
import { useEffect, useState } from "react";

export default function DevClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const time = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-xs shadow-lg backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="tabular-nums text-white/70">{time}</span>
        <span className="text-white/25">|</span>
        <span className="text-white/50">{date}</span>
      </div>
    </div>
  );
}
