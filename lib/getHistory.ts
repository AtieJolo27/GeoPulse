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

export async function getSoilHistory(limit = 30): Promise<SoilHistoryRow[]> {
  const { data, error } = await supabase
    .from('crop_predictions')
    .select('id, created_at, nitrogen, phosphorus, potassium, ph, air_temperature, soil_temperature, humidity, soil_moisture')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.log('history fetch error:', error);
    return [];
  }
  return data ?? [];
}