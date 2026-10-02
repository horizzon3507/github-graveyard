import type { FactorResult, ScoreResult } from "@/types/analysis";
import { clamp } from "@/lib/utils";

export interface FactorDefinition {
  key: string;
  label: string;
  weight: number;
  /** null when the signal could not be measured. */
  value: number | null;
  detail: string;
}

/**
 * Weighted average over the factors that have data. Missing factors are left out and
 * the remaining weights are renormalised, so a quick scan still yields a 0-100 score
 * with an honest confidence value.
 */
export function combine(definitions: FactorDefinition[]): ScoreResult {
  const totalWeight = definitions.reduce((sum, f) => sum + f.weight, 0);
  const availableWeight = definitions.filter((f) => f.value !== null).reduce((sum, f) => sum + f.weight, 0);
  const factors: FactorResult[] = definitions.map((f) => ({
    key: f.key,
    label: f.label,
    weight: f.weight,
    value: f.value === null ? null : round(clamp(f.value), 3),
    points: f.value === null || availableWeight === 0 ? 0 : round((clamp(f.value) * f.weight * 100) / availableWeight, 1),
    available: f.value !== null,
    detail: f.detail,
  }));
  const raw = factors.reduce((sum, f) => sum + f.points, 0);
  return {
    score: Math.round(clamp(raw, 0, 100)),
    confidence: totalWeight === 0 ? 0 : Math.round((availableWeight / totalWeight) * 100),
    factors,
  };
}

export function round(n: number, digits = 0): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

/** Log-scaled 0..1 mapping where `ceiling` maps to 1. */
export function logScale(value: number, ceiling: number): number {
  if (value <= 0) return 0;
  return clamp(Math.log10(value + 1) / Math.log10(ceiling + 1));
}
