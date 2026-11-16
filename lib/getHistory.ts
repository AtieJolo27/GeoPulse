import { supabase } from '@/lib/supabaseClient';

export interface SoilHistoryRow {
  id: number;
  created_at: string;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  air_temperature: number;
  soil_temperature: number;
  humidity: number;
  soil_moisture: number;
}

export async function getSoilHistory(limit = 30, zoneId?: number | null, throwOnError = false): Promise<SoilHistoryRow[]> {
  if (zoneId == null) return [];
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('id, created_at, nitrogen, phosphorus, potassium, ph, air_temperature, soil_temperature, humidity, soil_moisture')
    .eq('zone_id', zoneId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (throwOnError) throw new Error(`Unable to load sensor history: ${error.message}`);
    console.log('history fetch error:', error);
    return [];
  }
  return (data ?? []).reverse();
}

/** All readings in a date window, paged to avoid truncating daily averages. */
export async function getSoilHistorySince(since: string, zoneId?: number | null): Promise<SoilHistoryRow[]> {
  if (zoneId == null) return [];
  const rows: SoilHistoryRow[] = [];
  const until = new Date().toISOString();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('sensor_readings')
      .select('id, created_at, nitrogen, phosphorus, potassium, ph, air_temperature, soil_temperature, humidity, soil_moisture')
      .eq('zone_id', zoneId).gte('created_at', since).lte('created_at', until)
      .order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 999);
    if (error) throw new Error(`Unable to load daily history: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}
