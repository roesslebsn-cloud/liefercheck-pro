"use client";

import { useEffect } from "react";

/**
 * Globaler Spotlight-Tracker.
 * Setzt --mouse-x und --mouse-y auf alle Elemente mit Klasse .spotlight (oder .spotlight-card / .spotlight-border).
 * Läuft via Event-Delegation für Performance.
 */
export default function SpotlightProvider() {
  useEffect(() => {
    let rafId: number | null = null;
    let lastEvent: PointerEvent | null = null;

    const handler = (e: PointerEvent) => {
      lastEvent = e;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!lastEvent) return;
        const target = lastEvent.target as Element | null;
        if (!target) return;

        // Find all spotlight ancestors and self
        let el: Element | null = target;
        const seen = new Set<Element>();
        while (el && el !== document.body) {
          if (
            el.classList?.contains("spotlight") ||
            el.classList?.contains("spotlight-card") ||
            el.classList?.contains("spotlight-border")
          ) {
            if (!seen.has(el)) {
              const rect = (el as HTMLElement).getBoundingClientRect();
              (el as HTMLElement).style.setProperty("--mouse-x", `${lastEvent.clientX - rect.left}px`);
              (el as HTMLElement).style.setProperty("--mouse-y", `${lastEvent.clientY - rect.top}px`);
              seen.add(el);
            }
          }
          el = el.parentElement;
        }
      });
    };

    document.addEventListener("pointermove", handler, { passive: true });
    return () => {
      document.removeEventListener("pointermove", handler);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}
