export interface NightScoutEntry {
  _id: string;
  type: string;
  sgv?: number;
  direction?: string;
  date: number;
  dateString?: string;
  device?: string;
  mills?: number;
  sysTime?: string;
  utcOffset?: number;
}

export interface JWTResponse {
  token: string;
  sub?: string;
  iat?: number;
  exp?: number;
}

export interface TreatmentResponse {
  _id?: string;
  eventType: string;
  carbs: number;
  created_at: string;
  notes?: string;
  enteredBy?: string;
  [key: string]: unknown;
}

// Compact response types for MCP token efficiency
export type GlucoseUnit = 'mmol/l' | 'mg/dl';

export interface BloodGlucoseReading {
  // Glucose value in the chosen unit
  value: number;
  // Trend direction label from Nightscout (e.g., "Flat", "FortyFiveUp")
  direction?: string;
  // ISO timestamp of the reading
  dateString: string;
}

export interface CompactGlucoseResponse {
  unit: GlucoseUnit;
  utcOffset: number;
  blood_glucose_readings: BloodGlucoseReading[];
  // Number of entries returned
  count: number;
  // Start date filter as epoch milliseconds
  startDate: number;
  // End date filter as epoch milliseconds
  endDate: number;
  [key: string]: unknown;
}
