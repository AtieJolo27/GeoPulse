export type SensorConnection = 'checking' | 'online' | 'offline' | 'unknown';
export const SENSOR_ONLINE_WINDOW_MS = 60_000;

export function sensorConnectionFromReading(timestamp: string | null, now: number): SensorConnection {
  if (!timestamp) return 'offline';
  const recordedAt = Date.parse(timestamp);
  if (!Number.isFinite(recordedAt) || recordedAt > now + 5000) return 'unknown';
  return now - recordedAt <= SENSOR_ONLINE_WINDOW_MS ? 'online' : 'offline';
}
