import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { backendRequest } from '@/lib/backendRequest';

type Attempt = {
  id: number; zone_id: number; attempt_number: number; started_at: string;
  ended_at: string | null; reading_count: number | null;
  averages: Record<string, number | null> | null;
};
const metrics = [
  ['soil_moisture', 'Moisture', '%'], ['soil_temperature', 'Temperature', '°C'],
  ['ph', 'pH', ''], ['nitrogen', 'N', 'ppm'], ['phosphorus', 'P', 'ppm'], ['potassium', 'K', 'ppm'],
];

export default function SensorAttempts() {
  const { activeZoneId, sensorZoneId, t } = useApp();
  const colors = useThemeColors();
  const [state, setState] = useState<{ zone: number | null; attempts: Attempt[]; active: Attempt | null } | null>(null);
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
    const timer = setInterval(() => { if (!mutation.current) void load(); }, 30000);
    return () => { invalidate(); clearTimeout(initial); clearInterval(timer); };
  }, [load]);

  if (activeZoneId === null) return null;
  const current = state?.zone === activeZoneId ? state : null;
  const active = current?.active;
  const perform = async (path: string, body?: object) => {
    if (mutation.current) return;
    mutation.current = true;
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
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{t('Sensor testing attempts', 'Mga attempt ng sensor testing')}</Text>
    <Text style={{ color: colors.subText, marginTop: 6 }}>{t('Press Start when you turn on the sensor, then Finish when testing ends. These controls record the time; they do not switch the device power.', 'Pindutin ang Simulan kapag binuhay ang sensor, at Tapusin kapag tapos na ang testing. Oras ang nire-record nito; hindi nito kinokontrol ang power ng device.')}</Text>
    {error && <><Text accessibilityRole="alert" style={{ color: colors.text, marginTop: 8 }}>{error}</Text><Button label={t('Retry', 'Subukan muli')} onPress={() => { void load(); }} blocked={busy} /></>}
    {loading && !current && <Text style={{ color: colors.subText }}>{t('Loading attempts...', 'Nilo-load ang mga attempt...')}</Text>}
    {active ? <>
      <Text style={{ color: colors.text, marginTop: 10 }}>{t('● Testing in progress', '● Kasalukuyang testing')} · {t('Attempt', 'Attempt')} {active.attempt_number} · {new Date(active.started_at).toLocaleString()}</Text>
      {active.zone_id !== activeZoneId && <Text style={{ color: colors.subText }}>{t('The active attempt belongs to another zone. Finish it there before starting here.', 'Nasa ibang sona ang aktibong attempt. Tapusin muna ito roon.')}</Text>}
      {active.zone_id === activeZoneId && <Button blocked={disabled} label={busy ? t('Saving...', 'Sine-save...') : t('Finish testing', 'Tapusin ang testing')} onPress={() => { void perform(`/sensor-attempts/${active.id}/finish`); }} />}
    </> : <Button label={t('Start new attempt', 'Simulan ang bagong attempt')} onPress={() => { void perform('/sensor-attempts/start', { zone_id: activeZoneId }); }} blocked={disabled || activeZoneId !== sensorZoneId} />}
    {activeZoneId !== sensorZoneId && <Text style={{ color: colors.subText, marginTop: 8 }}>{t('Assign the sensor to this zone before starting.', 'Italaga muna ang sensor sa sonang ito bago magsimula.')}</Text>}
    {current?.attempts.filter(a => a.ended_at).map(a => <View key={a.id} style={{ marginTop: 14, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{t('Attempt', 'Attempt')} {a.attempt_number} · {t('Completed', 'Tapos na')}</Text>
      <Text style={{ color: colors.subText }}>{new Date(a.started_at).toLocaleString()} → {new Date(a.ended_at!).toLocaleString()}</Text>
      <Text style={{ color: colors.subText }}>{((Date.parse(a.ended_at!) - Date.parse(a.started_at)) / 60000).toFixed(1)} min · {a.reading_count ?? 0} {t('readings', 'datos')}</Text>
      <Text style={{ color: colors.text, marginTop: 4 }}>{a.reading_count ? t('Average of recorded samples', 'Average ng naitalang samples') : t('No readings recorded during this attempt.', 'Walang naitalang datos sa attempt na ito.')}</Text>
      {!!a.reading_count && metrics.map(([key, label, unit]) => <Text key={key} style={{ color: colors.subText }}>{label}: {a.averages?.[key] == null ? '—' : Number(a.averages[key]).toFixed(2)} {unit}</Text>)}
    </View>)}
    {current && current.attempts.length === 0 && <Text style={{ color: colors.subText, marginTop: 10 }}>{t('No attempts yet.', 'Wala pang attempt.')}</Text>}
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
