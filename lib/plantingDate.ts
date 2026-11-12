/** Calendar dates stay in local time; never convert them through UTC timestamps. */
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validPlantingDate(value: string, today = localDate()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value && value <= today;
}

export function daysSincePlanting(value: string, today = localDate()): number | null {
  if (!validPlantingDate(value, today)) return null;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${value}T00:00:00Z`)) / 86400000);
}
