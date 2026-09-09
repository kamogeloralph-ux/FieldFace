export type EntryType = "clock_in" | "clock_out";

export interface ClockSubmission {
  entryType: EntryType;
  selfieBase64: string; // data URL, e.g. "data:image/jpeg;base64,..."
  latitude: number;
  longitude: number;
  gpsAccuracyMeters?: number;
}
