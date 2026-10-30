import type { SensorReading } from './sensorAlerts';
import { classifySoilValue, getSoilTypeRanges } from './soilTypeRanges';
import { SENSOR_REFERENCE_RANGES } from './soilHealthScore';

export function sensorNotifications(reading: SensorReading | null, soilType?: string | null) {
  if (!reading) return [];
  const ranges = { ...SENSOR_REFERENCE_RANGES, ...getSoilTypeRanges(soilType) };
  return (Object.keys(SENSOR_REFERENCE_RANGES) as (keyof typeof SENSOR_REFERENCE_RANGES)[]).flatMap(key => {
    const value = reading[key];
    const result = classifySoilValue(value, ranges[key]);
    if (result.level !== 'low' && result.level !== 'high') return [];
    return [{
      id: JSON.stringify([reading.id ?? null, reading.created_at ?? null, key, value, result.level, result.risk ?? null]),
      field: key.replace(/_/g, ' '),
      message: `${value} ${ranges[key].unit} - ${result.level}${result.risk ? `. ${result.risk}` : ''}.`,
      urgent: !!result.risk,
    }];
  }).sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

const listeners = new Set<() => void>();
const memory = new Map<string, string>();
const storageKey = (userId: string | null, zoneId: number | null) => userId && zoneId !== null ? `geopulse_notifications_read:${userId}:${zoneId}` : null;

export function subscribeNotificationReadState(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function readNotificationSnapshot(userId: string | null, zoneId: number | null) {
  const key = storageKey(userId, zoneId);
  if (!key) return '';
  const cached = memory.get(key);
  if (cached !== undefined) return cached;
  try { return localStorage.getItem(key) ?? ''; }
  catch { return ''; }
}

export function readNotificationIds(snapshot: string): string[] {
  try {
    const value = JSON.parse(snapshot);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch { return []; }
}

export function markNotificationsRead(userId: string | null, zoneId: number | null, ids: string[]) {
  const key = storageKey(userId, zoneId);
  if (!key || !ids.length) return;
  const existing = readNotificationIds(readNotificationSnapshot(userId, zoneId));
  if (ids.every(id => existing.includes(id))) return;
  const snapshot = JSON.stringify([...new Set([...existing, ...ids])].slice(-200));
  memory.set(key, snapshot);
  try { localStorage.setItem(key, snapshot); } catch { /* Keep read state for this session if device storage is unavailable. */ }
  listeners.forEach(listener => listener());
}
