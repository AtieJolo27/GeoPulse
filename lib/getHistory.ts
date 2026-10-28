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

export async function getSoilHistory(limit = 30, zoneId?: number | null): Promise<SoilHistoryRow[]> {
  if (zoneId == null) return [];
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('id, created_at, nitrogen, phosphorus, potassium, ph, air_temperature, soil_temperature, humidity, soil_moisture')
    .eq('zone_id', zoneId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.log('history fetch error:', error);
    return [];
  }
  return (data ?? []).reverse();
}
