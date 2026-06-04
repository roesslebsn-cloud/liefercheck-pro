"use client";

import { useEffect, useState } from "react";

/**
 * Animates a number from 0 to `end` over `duration` ms.
 * Uses ease-out cubic for natural deceleration.
 */
export function useCountUp(end: number, duration = 1200, startWhen: boolean = true): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!startWhen) return;
    if (end === 0) { setValue(0); return; }

    let rafId: number;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(end * eased);
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [end, duration, startWhen]);

  return value;
}
