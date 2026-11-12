import { localDate } from './plantingDate';

export type CropEvent = {
  id: string; user_id: string; zone_id: number; crop: string; planted_on: string;
  kind: 'harvest' | 'fertilizer'; event_date: string; notify_at: string;
  completed: boolean; source: 'manual' | 'ai';
};

export function validCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value;
}

export function parseCropSchedule(value: string, plantedOn: string) {
  let data;
  try { data = JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch { throw new Error('AI returned an unreadable schedule. Please retry or choose dates manually.'); }
  if (!data || typeof data !== 'object' || !validCalendarDate(plantedOn) || !validCalendarDate(data.harvest_date) ||
      data.harvest_date <= plantedOn || !Array.isArray(data.fertilizer_dates) ||
      data.fertilizer_dates.length > 6 || !data.fertilizer_dates.every((date: unknown) =>
        validCalendarDate(date) && date >= plantedOn && date <= data.harvest_date) ||
      typeof data.explanation !== 'string' || !data.explanation.trim()) {
    throw new Error('AI returned an invalid schedule. Please retry or choose dates manually.');
  }
  const limit = new Date(`${plantedOn}T12:00:00`);
  limit.setFullYear(limit.getFullYear() + 3);
  if (data.harvest_date > localDate(limit)) throw new Error('AI returned a harvest date too far from planting.');
  return { harvest_date: data.harvest_date as string, fertilizer_dates: [...new Set<string>(data.fertilizer_dates)], explanation: data.explanation.slice(0, 2000) };
}

export function reminderTime(date: string): string {
  if (!validCalendarDate(date)) throw new Error('Choose a valid calendar date.');
  // Store an absolute instant so the server does not guess the farmer's timezone.
  return new Date(`${date}T08:00:00`).toISOString();
}
