// Read-only diagnostics. Never print keys, tokens, or sensor values.
process.loadEnvFile('.env');
const base = process.env.EXPO_PUBLIC_API_URL ?? 'https://capstone-eem0.onrender.com';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let zoneId;
let zoneIds = [];
for (const path of ['/zones', '/device/active-zone']) {
  try {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20000) });
    const json = await response.json();
    console.log(`${path}: HTTP ${response.status}`);
    if (path === '/zones') {
      zoneIds = (json.data ?? []).map(zone => zone.id);
      console.log(`Visible backend zones: ${zoneIds.length}`);
    }
    else {
      zoneId = json.zone?.id;
      console.log(`Sensor zone ID: ${zoneId ?? 'unassigned'}`);
    }
  } catch (error) {
    console.log(`${path}: ${error.name}`);
  }
}
if (!url || !key) throw new Error('Missing public Supabase URL or publishable key in .env');
for (const [label, query] of [
  ['all readable readings', 'select=id,zone_id&limit=5'],
  ['unassigned readings', 'select=id&zone_id=is.null&limit=1'],
  ['assigned readings', 'select=id&zone_id=not.is.null&limit=1'],
  ...(zoneId ? [['sensor zone readings', `select=id,zone_id&zone_id=eq.${encodeURIComponent(zoneId)}&limit=5`]] : []),
  ...zoneIds.filter(id => id !== zoneId).map(id => [`zone ${id} readings`, `select=id,zone_id&zone_id=eq.${encodeURIComponent(id)}&limit=1`]),
]) {
  try {
    const response = await fetch(`${url}/rest/v1/sensor_readings?${query}`, {
      headers: { apikey: key, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(20000),
    });
    const json = await response.json();
    console.log(`Supabase ${label}: HTTP ${response.status}; count=${response.headers.get('content-range') ?? 'unknown'}`);
    if (!response.ok) console.log(`Database error code: ${json.code ?? 'unknown'}`);
  } catch (error) {
    console.log(`Supabase ${label}: ${error.name}`);
  }
}
console.log('Supabase checks use the public key without a user session; signed-in RLS visibility may differ.');
