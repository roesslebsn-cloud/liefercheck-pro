"use client";

import { useCountUp } from "../../lib/useCountUp";

// Animierte KPI-Zahl (zählt von 0 zum Zielwert hoch). Geteilt von Dashboard + Admin.
export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  ready = true,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  ready?: boolean;
}) {
  const animated = useCountUp(value, 1100, ready);
  return <>{prefix}{animated.toFixed(decimals)}{suffix}</>;
}
