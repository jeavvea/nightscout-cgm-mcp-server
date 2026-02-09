import { CompactGlucoseResponse, GlucoseUnit, NightScoutEntry } from '../types.js';

function toMmolPerL(sgvMgPerDl: number): number {
  return Math.round((sgvMgPerDl / 18) * 10) / 10;
}

// Converts Nightscout entries into a compact, token-efficient structure.
export function formatEntriesToCompact(
  entries: NightScoutEntry[],
  unit: GlucoseUnit = 'mmol/l',
  startDate?: number,
  endDate?: number
): CompactGlucoseResponse {
  const first = entries?.[0];
  const utcOffset = typeof first?.utcOffset === 'number' ? first!.utcOffset! : 0;

  const readings = (entries || [])
    .filter((e) => e && e.type === 'sgv' && typeof e.sgv === 'number')
    .map((e) => {
      const raw = e.sgv as number;
      const value = unit === 'mmol/l' ? toMmolPerL(raw) : raw;
      const dateString = e.dateString || e.sysTime || new Date(e.date).toISOString();
      return {
        value,
        direction: e.direction,
        dateString,
      };
    });

  return {
    unit: unit,
    utcOffset,
    blood_glucose_readings: readings,
    count: readings.length,
    startDate: startDate || 0,
    endDate: endDate || Date.now(),
  };
}
