// modules/energy/src/calculations.ts
import { EnergyCalculationResult } from './types.js';

/**
 * Calculates energy in kWh from power in kW and duration in hours.
 * Pure function: kWh = kW * hours
 */
export function calculateKwh(powerKw: number, durationHours: number): number {
  if (powerKw < 0 || durationHours < 0) return 0;
  return Number((powerKw * durationHours).toFixed(4));
}

/**
 * Calculates energy savings and percentage.
 * Rules:
 * - Saved = baseline - optimized
 * - savings % = (saved / baseline) * 100 ONLY if baseline > 0
 * - Never show negative savings as positive (if optimized > baseline, saved <= 0 and % <= 0)
 * - Zero baseline handled safely (returns 0% savings)
 */
export function calculateEnergySavings(params: {
  baselineKw: number;
  optimizedKw: number;
  durationHours: number;
  tariffPerKwh: number;
}): EnergyCalculationResult {
  const { baselineKw, optimizedKw, durationHours, tariffPerKwh } = params;

  const validBaselineKw = Math.max(0, baselineKw);
  const validOptimizedKw = Math.max(0, optimizedKw);
  const validDuration = Math.max(0, durationHours);
  const validTariff = Math.max(0, tariffPerKwh);

  const energyBaselineKwh = calculateKwh(validBaselineKw, validDuration);
  const energyOptimizedKwh = calculateKwh(validOptimizedKw, validDuration);

  // Saved = baseline - optimized
  const rawSavedKwh = energyBaselineKwh - energyOptimizedKwh;
  // If baseline is 0 or optimized consumes more than baseline, saved is <= 0
  const energySavedKwh = Number(rawSavedKwh.toFixed(4));

  let savingsPercent = 0;
  if (energyBaselineKwh > 0) {
    savingsPercent = Number(((energySavedKwh / energyBaselineKwh) * 100).toFixed(2));
    // Guard against negative showing as positive
    if (energySavedKwh <= 0) {
      savingsPercent = 0;
    }
  }

  // Cost saved = saved * tariff (if saved > 0)
  const costSavedUsd = energySavedKwh > 0 ? Number((energySavedKwh * validTariff).toFixed(2)) : 0;

  return {
    powerCurrentKw: validOptimizedKw,
    powerBaselineKw: validBaselineKw,
    energyBaselineKwh,
    energyOptimizedKwh,
    energySavedKwh: Math.max(0, energySavedKwh),
    savingsPercent: Math.max(0, savingsPercent),
    costSavedUsd,
    tariffPerKwh: validTariff,
    durationHours: validDuration,
    label: 'simulated_estimate'
  };
}
