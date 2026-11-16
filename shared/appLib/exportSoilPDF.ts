import { supabase } from '@/lib/supabaseClient';
import { exportSensorReadingsPdf } from '@/lib/exportSensorReadings';

export async function exportSoilHistoryPDF(zoneId: number | null, zoneName?: string): Promise<void> {
  if (zoneId == null) throw new Error('Select a zone on the dashboard before exporting a report.');
  const { data, error } = await supabase.from('sensor_readings')
    .select('id, created_at, nitrogen, phosphorus, potassium, ph, soil_moisture, humidity, soil_temperature, air_temperature')
    .eq('zone_id', zoneId)
    .order('created_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false }).limit(30);
  if (error) throw new Error(`Unable to load soil readings: ${error.message}`);
  if (!data?.length) throw new Error('No sensor readings are recorded for this zone yet.');
  await exportSensorReadingsPdf(data, zoneName ?? `Zone ${zoneId}`);
}
