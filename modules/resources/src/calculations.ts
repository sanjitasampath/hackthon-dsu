import { UtilizationStatus } from './types.js';

export function calculateRoomUtilization(capacity: number, attendance: number): number {
  if (capacity <= 0) return 0;
  const rate = (Math.max(0, attendance) / capacity) * 100;
  return Math.round(rate * 10) / 10;
}

export function evaluateUtilizationStatus(utilizationRate: number): UtilizationStatus {
  if (utilizationRate > 100) return 'overcrowded';
  if (utilizationRate >= 75) return 'optimal';
  if (utilizationRate >= 40) return 'moderate';
  return 'severely_underutilized';
}

export function calculateWastedPower(
  capacity: number,
  attendance: number,
  baseHvacKw: number,
  lightingKw: number
): { wastedKw: number; wastedPercent: number } {
  if (capacity <= 0) return { wastedKw: 0, wastedPercent: 0 };
  const safeAttendance = Math.min(capacity, Math.max(0, attendance));
  const unusedRatio = (capacity - safeAttendance) / capacity;
  const totalKw = baseHvacKw + lightingKw;
  const wastedKw = Number((totalKw * unusedRatio).toFixed(2));
  const wastedPercent = Number((unusedRatio * 100).toFixed(1));
  return { wastedKw, wastedPercent };
}

export function calculateReallocationSavings(
  sourceHvacKw: number,
  sourceLightingKw: number,
  targetHvacKw: number,
  targetLightingKw: number,
  durationHours: number,
  tariffUsdPerKwh: number = 0.14
): {
  energySavedKwh: number;
  costSavedUsd: number;
  co2KgSaved: number;
} {
  const sourceKw = sourceHvacKw + sourceLightingKw;
  const targetKw = targetHvacKw + targetLightingKw;
  const deltaKw = Math.max(0, sourceKw - targetKw);

  const energySavedKwh = Number((deltaKw * durationHours).toFixed(2));
  const costSavedUsd = Number((energySavedKwh * tariffUsdPerKwh).toFixed(2));
  const co2KgSaved = Number((energySavedKwh * 0.42).toFixed(2)); // 0.42 kg CO2 / kWh

  return { energySavedKwh, costSavedUsd, co2KgSaved };
}

export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function findUnoccupiedIntervals(
  scheduledIntervals: { start: string; end: string }[],
  dayStart: string = '08:00',
  dayEnd: string = '18:00'
): { start: string; end: string; durationHours: number }[] {
  const dayStartMin = timeToMinutes(dayStart);
  const dayEndMin = timeToMinutes(dayEnd);

  if (scheduledIntervals.length === 0) {
    const dur = Number(((dayEndMin - dayStartMin) / 60).toFixed(2));
    return dur > 0 ? [{ start: dayStart, end: dayEnd, durationHours: dur }] : [];
  }

  // Sort intervals chronologically
  const sorted = [...scheduledIntervals]
    .map(i => ({ startMin: timeToMinutes(i.start), endMin: timeToMinutes(i.end) }))
    .sort((a, b) => a.startMin - b.startMin);

  const gaps: { start: string; end: string; durationHours: number }[] = [];
  let currentPointer = dayStartMin;

  for (const interval of sorted) {
    if (interval.startMin > currentPointer) {
      const dur = Number(((interval.startMin - currentPointer) / 60).toFixed(2));
      if (dur >= 0.5) { // Minimum 30 min idle block
        gaps.push({
          start: minutesToTime(currentPointer),
          end: minutesToTime(interval.startMin),
          durationHours: dur
        });
      }
    }
    currentPointer = Math.max(currentPointer, interval.endMin);
  }

  if (currentPointer < dayEndMin) {
    const dur = Number(((dayEndMin - currentPointer) / 60).toFixed(2));
    if (dur >= 0.5) {
      gaps.push({
        start: minutesToTime(currentPointer),
        end: minutesToTime(dayEndMin),
        durationHours: dur
      });
    }
  }

  return gaps;
}
