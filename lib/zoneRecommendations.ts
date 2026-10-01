import { supabase } from './supabaseClient';

const fields = ['soil_moisture', 'soil_temperature', 'air_temperature', 'humidity', 'ph', 'nitrogen', 'phosphorus', 'potassium'] as const;
const legacyBackends = new Set<string>();

async function request(url: string, options: RequestInit, label: string) {
  try {
    return await fetch(url, options);
  } catch {
    if (options.signal?.aborted) throw new Error('The recommendation request timed out. Please try again.');
    throw new Error(`${label}: unable to connect to the recommendation server. Check the phone's internet connection and try again.`);
  }
}

export async function loadZoneRecommendations(baseUrl: string, zoneId: number, signal: AbortSignal) {
  const base = baseUrl.replace(/\/+$/, '');
  if (!legacyBackends.has(base)) {
    const response = await request(`${base}/zones/${zoneId}/recommendations`, { signal }, 'Loading zone recommendations');
    if (response.status !== 404) {
      const json = await response.json();
      if (!response.ok) throw new Error(typeof json.detail === 'string' ? json.detail : 'Unable to generate recommendations.');
      return json;
    }
    legacyBackends.add(base);
  }

  // Older deployments expose /predict but not the zone-specific route.
  // Select the source explicitly; never use global prediction history.
  const { data: reading, error } = await supabase.from('sensor_readings')
    .select('*').eq('zone_id', zoneId)
    .order('created_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false }).limit(1).abortSignal(signal).maybeSingle();
  if (error) throw new Error(`Unable to load this zone's readings: ${error.message}`);
  if (!reading) return { zone_id: zoneId, reading: null, crop: null, fertilizer: null };

  const measurements: Record<string, number> = {};
  for (const field of fields) {
    const raw = reading[field];
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    if (!Number.isFinite(value)) throw new Error(`The latest reading is missing a valid ${field}.`);
    if ((field === 'ph' && (value < 0 || value > 14)) ||
      ((field === 'humidity' || field === 'soil_moisture') && (value < 0 || value > 100)) ||
      (['nitrogen', 'phosphorus', 'potassium'].includes(field) && (value < 0 || !Number.isInteger(value)))) {
      throw new Error(`The latest reading has an invalid ${field}.`);
    }
    measurements[field] = value;
  }
  const prediction = await request(`${base}/predict`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(measurements),
  }, 'Generating predictions');
  const json = await prediction.json();
  if (!prediction.ok) throw new Error(typeof json.detail === 'string' ? json.detail : 'Unable to generate predictions from this zone\'s latest reading.');
  if (!Array.isArray(json.crop?.recommendations)) throw new Error('The prediction service returned an unexpected crop result.');
  return {
    zone_id: zoneId, reading, crop: json.crop,
    fertilizer: Array.isArray(json.fertilizer?.recommendations) ? json.fertilizer : null,
    fertilizer_crop: json.crop.best_crop,
    fertilizer_crop_source: 'legacy-predicted',
  };
}
