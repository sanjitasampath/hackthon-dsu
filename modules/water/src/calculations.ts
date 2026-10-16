// modules/water/src/calculations.ts

export function litersToCubicMeters(liters: number): number {
  if (liters <= 0) return 0;
  return Number((liters / 1000).toFixed(3));
}

export function lpmToLitersPerHour(lpm: number): number {
  if (lpm <= 0) return 0;
  return Number((lpm * 60).toFixed(1));
}

export function calculateTankFillPercentage(currentVolumeLiters: number, capacityLiters: number): number {
  if (capacityLiters <= 0) return 0;
  const ratio = (currentVolumeLiters / capacityLiters) * 100;
  return Math.min(100, Math.max(0, Math.round(ratio)));
}

export function estimateLeakLossPerHour(currentFlowLpm: number, baselineLpm: number): number {
  if (currentFlowLpm <= baselineLpm) return 0;
  const excessLpm = currentFlowLpm - baselineLpm;
  return Number((excessLpm * 60).toFixed(1));
}

export function calculateWaterCost(liters: number, tariffPer1000Liters: number = 1.85): number {
  if (liters <= 0) return 0;
  return Number(((liters / 1000) * tariffPer1000Liters).toFixed(2));
}

export function isMinimumNightFlowWindow(hourOfDay: number): boolean {
  // Campus minimum night flow (MNF) window is between 01:00 (1 AM) and 05:00 (5 AM)
  return hourOfDay >= 1 && hourOfDay < 5;
}

export function assessAcousticLeak(acousticDb: number, thresholdDb: number = 52): { isAnomaly: boolean; confidence: number } {
  if (acousticDb < 35) {
    return { isAnomaly: false, confidence: 0 };
  }
  if (acousticDb >= thresholdDb) {
    // Confidence scales between 70% and 98% based on severity above threshold
    const confidence = Math.min(98, Math.round(70 + ((acousticDb - thresholdDb) / 25) * 28));
    return { isAnomaly: true, confidence };
  }
  // Elevated but sub-threshold
  if (acousticDb >= 42) {
    const confidence = Math.round(40 + ((acousticDb - 42) / (thresholdDb - 42)) * 25);
    return { isAnomaly: false, confidence };
  }
  return { isAnomaly: false, confidence: 15 };
}
