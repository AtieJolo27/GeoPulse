import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { backendRequest } from '@/lib/backendRequest';
import { router } from 'expo-router';

type Attempt = {
  id: number; zone_id: number; attempt_number: number; started_at: string;
  ended_at: string | null; reading_count: number | null;
  paused_at?: string | null; paused_seconds?: number;
  averages: Record<string, number | null> | null;
};
const metrics = [
  ['soil_moisture', 'Moisture', '%'], ['soil_temperature', 'Temperature', '°C'],
  ['ph', 'pH', ''], ['nitrogen', 'N', 'ppm'], ['phosphorus', 'P', 'ppm'], ['potassium', 'K', 'ppm'],
];

export default function SensorAttempts({ history = false, zoneId }: { history?: boolean; zoneId?: number } = {}) {
  const { activeZoneId: selectedZoneId, sensorZoneId, t } = useApp();
  const activeZoneId = zoneId ?? selectedZoneId;
  const colors = useThemeColors();
  const [state, setState] = useState<{ zone: number | null; attempts: Attempt[]; active: Attempt | null; latest_reading?: Record<string, number | string | null> | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const mutation = useRef(false);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      if (activeZoneId === null) return;
      const result = await backendRequest(`/sensor-attempts?zone_id=${activeZoneId}`);
      if (request === generation.current) {
        setState({ zone: activeZoneId, ...result });
        setError(null);
      }
    } catch (e) {
      if (request === generation.current) setError(e instanceof Error ? e.message : 'Unable to load attempts');
    } finally { if (request === generation.current) setLoading(false); }
  }, [activeZoneId]);
  useEffect(() => {
    const initial = setTimeout(() => { void load(); }, 0);
    const invalidate = () => { generation.current++; };
    const timer = setInterval(() => { if (!mutation.current) void load(); }, history ? 30000 : 5000);
    return () => { invalidate(); clearTimeout(initial); clearInterval(timer); };
  }, [load, history]);

  const current = state?.zone === activeZoneId ? state : null;
  const active = current?.active;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (history) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [history]);
  if (activeZoneId === null) return null;
  const latest = current?.attempts[0];
  const visibleAttempts = history
    ? current?.attempts.slice(1).filter(a => a.ended_at)
    : latest?.ended_at ? [latest] : [];
  const elapsed = active ? formatDuration(Date.parse(active.paused_at ?? new Date(now).toISOString()) - Date.parse(active.started_at) - (active.paused_seconds ?? 0) * 1000) : '';

  const perform = async (path: string, body?: object) => {
    if (mutation.current) return;
    mutation.current = true;
    generation.current++;
    setBusy(true);
    setError(null);
    try {
      await backendRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save attempt'); }
    finally { mutation.current = false; setBusy(false); }
  };
  const disabled = busy || loading || !current;
  return <View style={{ padding: 16, marginTop: 16, borderRadius: 16, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{history ? t('Previous attempts', 'Mga nakaraang attempt') : t('Attempts', 'Mga attempt')}</Text>
    {!history && !active && <Text style={{ color: colors.subText, marginTop: 6 }}>{t('Start a test to track its duration and averages.', 'Simulan ang test para maitala ang tagal at average.')}</Text>}
    {error && <><Text accessibilityRole="alert" style={{ color: colors.text, marginTop: 8 }}>{error}</Text><Button label={t('Retry', 'Subukan muli')} onPress={() => { void load(); }} blocked={busy} /></>}
    {loading && !current && <Text style={{ color: colors.subText }}>{t('Loading attempts...', 'Nilo-load ang mga attempt...')}</Text>}
    {!history && <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{t('Current parameters', 'Kasalukuyang mga parameter')}</Text>
      {current?.latest_reading ? <>
        <Text style={{ color: colors.subText, marginTop: 4 }}>{t('Last reading', 'Huling datos')}: {new Date(String(current.latest_reading.created_at)).toLocaleString()}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {metrics.map(([key, label, unit]) => <Text key={key} style={{ color: colors.text, minWidth: '45%' }}>{label}: {current.latest_reading?.[key] == null ? '—' : Number(current.latest_reading[key]).toFixed(2)} {unit}</Text>)}
        </View>
        {now - Date.parse(String(current.latest_reading.created_at)) > 60000 && <Text style={{ color: colors.subText, marginTop: 6 }}>{t('No fresh reading in the last minute. Check the sensor connection.', 'Walang bagong datos sa huling minuto. Suriin ang koneksyon ng sensor.')}</Text>}
      </> : <Text style={{ color: colors.subText, marginTop: 6 }}>{t('No sensor readings for this zone yet.', 'Wala pang datos ng sensor para sa sonang ito.')}</Text>}
    </View>}
    {!history && (active ? <>
      <Text style={{ color: colors.primary, fontSize: 32, fontWeight: '700', marginTop: 16, fontVariant: ['tabular-nums'] }}>{elapsed}</Text>
      <Text style={{ color: colors.subText }}>{t('Attempt', 'Attempt')} {active.attempt_number} · {active.paused_at ? t('Paused', 'Naka-pause') : t('Recording', 'Nagtatala')} · {t('Recording time', 'Oras ng pagtatala')}</Text>
      {active.zone_id === activeZoneId && <>
        <Text style={{ color: colors.subText, marginTop: 8 }}>{active.paused_at
          ? t('Move to the next spot in this zone. Let the probe settle, then resume. Readings while paused are excluded from this attempt.', 'Lumipat sa susunod na lugar sa sonang ito. Hintaying maging matatag ang probe bago magpatuloy. Hindi kasama sa attempt ang datos habang naka-pause.')
          : t('Pause before moving the probe to another spot. Finish this attempt before switching zones.', 'I-pause bago ilipat ang probe sa ibang lugar. Tapusin ang attempt bago lumipat ng sona.')}</Text>
        <Button blocked={disabled} label={active.paused_at ? t('Resume recording', 'Ipagpatuloy ang pagtatala') : t('Pause to move', 'I-pause para lumipat')}
          onPress={() => { void perform(`/sensor-attempts/${active.id}/${active.paused_at ? 'resume' : 'pause'}`); }} />
      </>}
      {active.zone_id !== activeZoneId && <Text style={{ color: colors.subText }}>{t('The active attempt belongs to another zone. Finish it there before starting here.', 'Nasa ibang sona ang aktibong attempt. Tapusin muna ito roon.')}</Text>}
      {active.zone_id === activeZoneId && <Button blocked={disabled} label={busy ? t('Saving...', 'Sine-save...') : t('Finish', 'Tapusin')} onPress={() => { void perform(`/sensor-attempts/${active.id}/finish`); }} />}
    </> : <Button label={t('Start attempt', 'Simulan ang attempt')} onPress={() => { void perform('/sensor-attempts/start', { zone_id: activeZoneId }); }} blocked={disabled || activeZoneId !== sensorZoneId} />)}
    {!history && activeZoneId !== sensorZoneId && <Text style={{ color: colors.subText, marginTop: 8 }}>{t('Assign the sensor to this zone before starting.', 'Italaga muna ang sensor sa sonang ito bago magsimula.')}</Text>}
    {visibleAttempts?.map(a => <View key={a.id} style={{ marginTop: 14, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{t('Attempt', 'Attempt')} {a.attempt_number} · {t('Completed', 'Tapos na')}</Text>
      <Text style={{ color: colors.subText }}>{new Date(a.started_at).toLocaleString()} → {new Date(a.ended_at!).toLocaleString()}</Text>
      <Text style={{ color: colors.subText }}>{formatDuration(Date.parse(a.ended_at!) - Date.parse(a.started_at) - (a.paused_seconds ?? 0) * 1000)} {t('recording', 'pagtatala')} · {a.reading_count ?? 0} {t('readings', 'datos')}</Text>
      <Text style={{ color: colors.text, marginTop: 4 }}>{a.reading_count ? t('Averages', 'Mga average') : t('No readings recorded.', 'Walang naitalang datos.')}</Text>
      {!!a.reading_count && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 8 }}>{metrics.map(([key, label, unit]) => <Text key={key} style={{ color: colors.subText, minWidth: '45%' }}>{label}: {a.averages?.[key] == null ? '—' : Number(a.averages[key]).toFixed(2)} {unit}</Text>)}</View>}
    </View>)}
    {!history && <TouchableOpacity accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(drawer)/(tabs)/history/attempts', params: { zoneId: String(activeZoneId) } })}
      style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 14, paddingBottom: 6, marginTop: 16, alignItems: 'center' }}>
      <Text style={{ color: colors.greenText, fontWeight: '800' }}>{t('View previous attempts', 'Tingnan ang mga nakaraang attempt')}</Text>
    </TouchableOpacity>}
    {history && current && !visibleAttempts?.length && <Text style={{ color: colors.subText, marginTop: 10 }}>{t('No previous attempts yet.', 'Wala pang nakaraang attempt.')}</Text>}
    {!history && current && current.attempts.length === 0 && <Text style={{ color: colors.subText, marginTop: 10 }}>{t('No attempts yet.', 'Wala pang attempt.')}</Text>}
  </View>;
}

const Button = ({ label, onPress, blocked = false }: { label: string; onPress: () => void; blocked?: boolean }) => {
  const colors = useThemeColors();
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: blocked }} disabled={blocked} onPress={onPress}
      style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 14, marginTop: 10, opacity: blocked ? 0.5 : 1 }}>
      <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </TouchableOpacity>
  );
};

function formatDuration(milliseconds: number) {
  const seconds = Number.isFinite(milliseconds) ? Math.max(0, Math.floor(milliseconds / 1000)) : 0;
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}
