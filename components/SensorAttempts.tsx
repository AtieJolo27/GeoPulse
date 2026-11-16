import { RefreshButton } from '@/shared/components/ui/RefreshButton';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '@/shared/appLib/AppContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
import { backendRequest } from '@/lib/backendRequest';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';
import { computeSoilHealthScore } from '@/lib/soilHealthScore';
import { getSoilTypeRanges } from '@/lib/soilTypeRanges';
import { AnimatedCircularProgress } from 'react-native-circular-progress';

type Attempt = {
  id: number; zone_id: number; attempt_number: number; started_at: string;
  ended_at: string | null; reading_count: number | null;
  paused_at?: string | null; paused_seconds?: number;
  averages: Record<string, number | null> | null;
};
const metrics = [
  ['soil_moisture', 'Moisture', 'Halumigmig', '%'], ['soil_temperature', 'Temperature', 'Temperatura', '°C'],
  ['ph', 'Soil pH', 'pH ng lupa', ''], ['nitrogen', 'Nitrogen', 'Nitroheno', 'ppm'],
  ['phosphorus', 'Phosphorus', 'Posporus', 'ppm'], ['potassium', 'Potassium', 'Potasyo', 'ppm'],
];

export default function SensorAttempts({ history = false, zoneId }: { history?: boolean; zoneId?: number } = {}) {
  const { activeZoneId: selectedZoneId, setActiveZoneId, sensorZoneId, zones, t, fontScale } = useApp();
  const activeZoneId = zoneId ?? selectedZoneId;
  const colors = useThemeColors();
  const [state, setState] = useState<{ zone: number | null; attempts: Attempt[]; active: Attempt | null; latest_reading?: Record<string, number | string | null> | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmFinish, setConfirmFinish] = useState<number | null>(null);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const pendingLoads = useRef(0);
  const generation = useRef(0);
  const mutation = useRef(false);
  const load = useCallback(async (background = false) => {
    const request = ++generation.current;
    pendingLoads.current++;
    if (!background) setLoading(true);
    try {
      if (activeZoneId === null) return;
      const result = await backendRequest(`/sensor-attempts?zone_id=${activeZoneId}`);
      if (request === generation.current) {
        setState({ zone: activeZoneId, ...result });
        setError(null);
      }
    } catch (e) {
      if (request === generation.current) setError(e instanceof Error ? e.message : 'Unable to load attempts');
    } finally {
      pendingLoads.current--;
      if (request === generation.current) setLoading(false);
    }
  }, [activeZoneId]);
  useEffect(() => {
    const initial = setTimeout(() => { void load(); }, 0);
    const invalidate = () => { generation.current++; };
    const timer = setInterval(() => { if (!mutation.current && !pendingLoads.current) void load(true); }, history ? 30000 : 5000);
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
  if (activeZoneId === null) return <View style={{ marginTop: 16, padding: 20, backgroundColor: colors.cardBg, borderRadius: 20 }}><Text style={{ color: colors.text }}>{t('Choose a zone on Home to start a soil test.', 'Pumili ng sona sa Home para magsimula ng test ng lupa.')}</Text></View>;
  const latest = current?.attempts[0];
  const visibleAttempts = history
    ? current?.attempts.filter(a => a.ended_at)
    : latest?.ended_at ? [latest] : [];
  const elapsed = active ? formatDuration(Date.parse(active.paused_at ?? new Date(now).toISOString()) - Date.parse(active.started_at) - (active.paused_seconds ?? 0) * 1000) : '';

  const perform = async (path: string, body?: object) => {
    if (mutation.current) return;
    mutation.current = true;
    generation.current++;
    setBusy(true);
    setError(null);
    try {
      const response = await backendRequest(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const updated = Array.isArray(response.attempt) ? response.attempt[0] : response.attempt;
      if (path.endsWith('/finish') && active) setExpandedResult(active.id);
      setConfirmFinish(null);
      if (updated && typeof updated.id === 'number' && typeof updated.zone_id === 'number' && typeof updated.started_at === 'string') {
        // Use the confirmed write response immediately, including paused_at.
        // A slow follow-up GET must not hide Resume after Pause succeeds.
        setState(previous => previous?.zone === activeZoneId ? {
          ...previous,
          active: updated.ended_at ? null : updated,
          attempts: [updated, ...previous.attempts.filter(attempt => attempt.id !== updated.id)],
        } : previous);
        void load(true);
      } else {
        await load();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save attempt'); }
    finally { mutation.current = false; setBusy(false); }
  };
  const disabled = busy || loading || !current || !!error;
  const zoneName = (id: number) => {
    const zone = zones.find(item => item.id === id);
    return zone ? t(zone.name_en, zone.name_tl) : `${t('Zone', 'Sona')} ${id}`;
  };
  const ownActive = active?.zone_id === activeZoneId;
  const readingTime = Date.parse(String(current?.latest_reading?.created_at ?? ''));
  const fresh = Number.isFinite(readingTime) && now - readingTime < 60000;
  const fs = (size: number) => size * fontScale;
  const soilType = zones.find(zone => zone.id === activeZoneId)?.soil_type;
  return <View style={{ padding: 20, marginTop: 16, borderRadius: 24, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.cardBgAlt, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="pulse-outline" size={22} color={colors.greenText} /></View>
      <View style={{ flex: 1, minWidth: 120 }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fs(20), letterSpacing: -0.4, fontWeight: '800' }}>{history ? t('Saved tests', 'Mga naka-save na test') : t('Test your soil', 'Suriin ang iyong lupa')}</Text>
        <Text style={{ color: colors.subText, marginTop: 4, fontSize: fs(13) }}>{zoneName(activeZoneId)}</Text>
      </View>
      {!history && ownActive && <StatusBadge label={active?.paused_at ? t('Paused', 'Naka-pause') : t('Recording', 'Nagtatala')} tone={active?.paused_at ? 'warning' : 'healthy'} />}
    </View>
    {error && <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: colors.cardBgAlt }}>
      <Text accessibilityRole="alert" style={{ color: colors.text, fontWeight: '700' }}>{t('We could not confirm the test status.', 'Hindi makumpirma ang kalagayan ng test.')}</Text>
      <Text style={{ color: colors.subText, marginTop: 6 }}>{t('Check your connection and refresh before continuing.', 'Suriin ang koneksyon at i-refresh bago magpatuloy.')}</Text>
      <Text style={{ color: colors.subText, marginTop: 6, fontSize: fs(12) }}>{error}</Text>
      <View style={{ marginTop: 12 }}><RefreshButton retry loading={loading} disabled={busy} accessibilityLabel={t('Refresh test status', 'I-refresh ang kalagayan')} onPress={() => { void load(); }} /></View>
    </View>}
    {loading && !current && <Text style={{ color: colors.subText }}>{t('Loading attempts...', 'Nilo-load ang mga attempt...')}</Text>}
    {!history && current && <View style={{ marginTop: 18 }}>
      {active && !ownActive ? <>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: fs(16) }}>{t('A test is open in another zone', 'May bukas na test sa ibang sona')}</Text>
        <Text style={{ color: colors.subText, marginTop: 8, lineHeight: fs(21) }}>{t(`Continue or finish the test in ${zoneName(active.zone_id)} before starting here.`, `Ipagpatuloy o tapusin muna ang test sa ${zoneName(active.zone_id)} bago magsimula rito.`)}</Text>
        <Button secondary icon="arrow-forward-outline" label={t('Go to active test', 'Pumunta sa aktibong test')} onPress={() => { void setActiveZoneId(active.zone_id); }} blocked={busy} />
      </> : <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {[t('1. Place probe', '1. Ilagay ang probe'), t('2. Record', '2. Magtala'), t('3. Save results', '3. I-save')].map((label, index) => <View key={label} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: (active ? index === 1 : index === 0) ? colors.cardBgAlt : colors.bg }}><Text style={{ fontSize: fs(11), fontWeight: '700', color: (active ? index === 1 : index === 0) ? colors.greenText : colors.subText }}>{label}</Text></View>)}
        </View>
        {active ? <>
          <View style={{ padding: 16, borderRadius: 18, backgroundColor: colors.cardBgAlt }}>
            <Text style={{ color: colors.subText, fontSize: fs(12), fontWeight: '600' }}>{t('Test', 'Test')} #{active.attempt_number} · {t('Recording time', 'Oras ng pagtatala')}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.greenText, fontSize: fs(42), letterSpacing: -1, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] }}>{elapsed}</Text>
            <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontWeight: '700', marginTop: 8, fontSize: fs(16) }}>{active.paused_at ? t('Ready to move to the next spot', 'Maaari nang lumipat sa susunod na lugar') : t('Keep the probe steady', 'Panatilihing hindi gumagalaw ang probe')}</Text>
            <Text style={{ color: colors.subText, lineHeight: fs(21), marginTop: 6 }}>{active.paused_at
              ? t('Place the probe in the next spot within this zone. Wait for the readings to settle, then resume.', 'Ilagay ang probe sa susunod na lugar sa sonang ito. Hintaying maging matatag ang datos bago magpatuloy.')
              : t('Pause before lifting the probe or moving to another spot in this zone.', 'I-pause bago iangat ang probe o lumipat sa ibang lugar sa sonang ito.')}</Text>
            <Text style={{ color: colors.greenText, fontSize: fs(12), marginTop: 10 }}>{active.paused_at ? t('Timer stopped. Readings taken while paused will not affect your result.', 'Nakahinto ang oras. Hindi makaaapekto sa resulta ang datos habang naka-pause.') : t('Readings taken now count toward your test average.', 'Kasama sa average ng test ang datos na kinukuha ngayon.')}</Text>
          </View>
          <Button icon="pause-outline" secondary={!!active.paused_at} blocked={disabled || !!active.paused_at} label={busy && !active.paused_at ? t('Updating test…', 'Ina-update ang test…') : t('Pause recording', 'I-pause ang pagtatala')} onPress={() => { void perform(`/sensor-attempts/${active.id}/pause`); }} />
          <Button icon="play-outline" secondary={!active.paused_at} blocked={disabled || !active.paused_at} label={busy && active.paused_at ? t('Updating test…', 'Ina-update ang test…') : t('Resume recording', 'Ipagpatuloy ang pagtatala (Resume)')} onPress={() => { void perform(`/sensor-attempts/${active.id}/resume`); }} />
          {!!active.paused_at && <Text style={{ color: colors.subText, fontSize: fs(12), lineHeight: fs(18), marginTop: 8 }}>{t('Keep the sensor on. Tap Resume recording when the probe is steady in the next spot.', 'Panatilihing bukas ang sensor. Pindutin ang Resume kapag hindi na gumagalaw ang probe sa susunod na lugar.')}</Text>}
          {confirmFinish === active.id ? <View style={{ marginTop: 14, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 16 }}>
            <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: '800', fontSize: fs(16) }}>{t('Save and end this test?', 'I-save at tapusin ang test?')}</Text>
            <Text style={{ color: colors.subText, lineHeight: fs(21), marginTop: 6 }}>{t('Your result will average the recorded readings, leaving out paused periods. Start a new test to collect more afterward.', 'I-a-average ang naitalang datos, maliban sa mga oras na naka-pause. Magsimula ng bagong test kung kukuha pa ng datos pagkatapos.')}</Text>
            <Button icon="checkmark-outline" blocked={disabled} label={busy ? t('Saving results…', 'Sine-save ang resulta…') : t('Save and end test', 'I-save at tapusin')} onPress={() => { void perform(`/sensor-attempts/${active.id}/finish`); }} />
            <Button secondary blocked={busy} label={t('Keep testing', 'Magpatuloy sa test')} onPress={() => setConfirmFinish(null)} />
          </View> : <>
            <Button secondary icon="checkmark-outline" blocked={disabled} label={t('Finish and see results', 'Tapusin at tingnan ang resulta')} onPress={() => setConfirmFinish(active.id)} />
          </>}
        </> : <>
          <Text style={{ color: colors.text, fontSize: fs(17), fontWeight: '800' }}>{t('Place the probe before starting', 'Ilagay muna ang probe bago magsimula')}</Text>
          <Text style={{ color: colors.subText, lineHeight: fs(21), marginTop: 8 }}>{t('Insert the probe into the soil in this zone. Wait for the readings below to settle, then start your test.', 'Ilagay ang probe sa lupa sa sonang ito. Hintaying maging matatag ang datos sa ibaba bago simulan ang test.')}</Text>
          <Button icon="play-outline" label={busy ? t('Starting test…', 'Sinisimulan ang test…') : t('Start soil test', 'Simulan ang test ng lupa')} onPress={() => { void perform('/sensor-attempts/start', { zone_id: activeZoneId }); }} blocked={disabled || activeZoneId !== sensorZoneId} />
        </>}
      </>}
      {activeZoneId !== sensorZoneId && !active && <Text style={{ color: colors.subText, lineHeight: fs(20), marginTop: 10 }}>{t('On Home, assign the sensor to this zone before starting a test.', 'Sa Home, italaga muna ang sensor sa sonang ito bago magsimula ng test.')}</Text>}
    </View>}
    {visibleAttempts?.map(a => <View key={a.id} style={{ marginTop: 14, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: fs(16), fontWeight: '800' }}>{history ? t('Test', 'Test') : t('Latest result · Test', 'Huling resulta · Test')} #{a.attempt_number}</Text>
        <StatusBadge label={t('Saved', 'Naka-save')} tone="healthy" />
      </View>
      <Text style={{ color: colors.subText, marginTop: 8, fontSize: fs(12) }}>{new Date(a.ended_at!).toLocaleString()}</Text>
      <Text style={{ color: colors.text, marginTop: 10 }}>{a.reading_count ?? 0} {t('readings included', 'datos na kasama')} · {formatDuration(Date.parse(a.ended_at!) - Date.parse(a.started_at) - (a.paused_seconds ?? 0) * 1000)} {t('recorded', 'naitala')}</Text>
      <OverallSummary record={a.reading_count ? a.averages : null} soilType={soilType} saved />
      {!a.reading_count ? <Text style={{ color: colors.subText, lineHeight: fs(21), marginTop: 8 }}>{t('No readings were recorded during this test. Check that the sensor is sending data, then start a new test.', 'Walang naitalang datos sa test na ito. Tiyaking nagpapadala ng datos ang sensor, saka magsimula ng bagong test.')}</Text> : <>
        <Button secondary icon={expandedResult === a.id ? 'chevron-up-outline' : 'chevron-down-outline'} label={expandedResult === a.id ? t('Hide averages', 'Itago ang average') : t('View test averages', 'Tingnan ang average ng test')} onPress={() => setExpandedResult(expandedResult === a.id ? null : a.id)} expanded={expandedResult === a.id} />
        {expandedResult === a.id && <>
          <Text style={{ color: colors.subText, marginTop: 12, fontSize: fs(12) }}>{t('Average of included readings. Paused readings are excluded.', 'Average ng kasamang datos. Hindi kasama ang datos habang naka-pause.')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 }}>{metrics.map(([key, label, tl, unit]) => <View key={key} style={{ flexGrow: 1, flexBasis: '45%', padding: 12, borderRadius: 12, backgroundColor: colors.cardBgAlt }}><Text style={{ color: colors.subText, fontSize: fs(12) }}>{t(label, tl)}</Text><Text style={{ color: colors.text, fontWeight: '700', marginTop: 4 }}>{formatValue(a.averages?.[key])} {unit}</Text></View>)}</View>
        </>}
      </>}
    </View>)}
    {!history && <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: fs(16) }}>{t('Sensor readings', 'Datos ng sensor')}</Text>
        <StatusBadge label={fresh ? t('Updated recently', 'Bagong datos') : t('Waiting for data', 'Naghihintay ng datos')} tone={fresh ? 'healthy' : 'warning'} />
      </View>
      <Text style={{ color: colors.subText, marginTop: 8, fontSize: fs(12), lineHeight: fs(18) }}>{active?.paused_at && ownActive ? t('Values still update while paused. They are not included in your test result.', 'Nagbabago pa rin ang datos habang naka-pause. Hindi ito kasama sa resulta ng test.') : t('Latest values from this zone. These are not the test averages.', 'Pinakabagong datos mula sa sonang ito. Hindi ito ang average ng test.')}</Text>
      <OverallSummary record={current?.latest_reading} soilType={soilType} stale={!fresh} />
      {current?.latest_reading ? <>
        <Text style={{ color: colors.subText, marginTop: 4 }}>{t('Last reading', 'Huling datos')}: {new Date(String(current.latest_reading.created_at)).toLocaleString()}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {metrics.map(([key, label, tl, unit]) => <View key={key} style={{ flexGrow: 1, flexBasis: '45%', padding: 12, borderRadius: 14, backgroundColor: colors.cardBgAlt }}>
            <Text style={{ color: colors.subText, fontSize: fs(12), fontWeight: '600' }}>{t(label, tl)}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.text, fontSize: fs(23), letterSpacing: -0.5, fontWeight: '800', marginTop: 6, fontVariant: ['tabular-nums'] }}>{formatValue(current.latest_reading?.[key])} <Text style={{ fontSize: fs(12), fontWeight: '500', color: colors.subText }}>{unit}</Text></Text>
          </View>)}
        </View>
        {now - Date.parse(String(current.latest_reading.created_at)) > 60000 && <Text style={{ color: colors.subText, marginTop: 6 }}>{t('No fresh reading in the last minute. Check the sensor connection.', 'Walang bagong datos sa huling minuto. Suriin ang koneksyon ng sensor.')}</Text>}
      </> : <Text style={{ color: colors.subText, marginTop: 6 }}>{t('No sensor readings for this zone yet.', 'Wala pang datos ng sensor para sa sonang ito.')}</Text>}
    </View>}
    {!history && <TouchableOpacity accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(drawer)/(tabs)/history/attempts', params: { zoneId: String(activeZoneId) } })}
      style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 14, paddingBottom: 6, marginTop: 16, alignItems: 'center' }}>
      <Text style={{ color: colors.greenText, fontWeight: '800' }}>{t('View saved tests', 'Tingnan ang mga naka-save na test')}</Text>
    </TouchableOpacity>}
    {history && current && !visibleAttempts?.length && <Text style={{ color: colors.subText, marginTop: 10 }}>{t('No saved tests yet. Finish a soil test to see its result here.', 'Wala pang naka-save na test. Tapusin ang test ng lupa para makita ang resulta rito.')}</Text>}
  </View>;
}

function OverallSummary({ record, soilType, saved = false, stale = false }: {
  record?: Parameters<typeof computeSoilHealthScore>[0] | null;
  soilType?: string | null; saved?: boolean; stale?: boolean;
}) {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const [showDetails, setShowDetails] = useState(false);
  const ranges = getSoilTypeRanges(soilType);
  const result = computeSoilHealthScore(record ?? {}, ranges ?? {});
  const available = result.overall !== null;
  const tint = !available ? colors.mutedText : result.needsAttention ? colors.warning : colors.greenText;
  const label = !available ? t('Incomplete data', 'Kulang na datos') : result.needsAttention
    ? t('Check readings', 'Suriin ang datos') : t('Within reference bands', 'Nasa saklaw');
  const fs = (size: number) => size * fontScale;
  return <View style={{ marginTop: 16, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: '800', fontSize: fs(17) }}>{t('Overall soil condition', 'Pangkalahatang kondisyon ng lupa')}</Text>
    <Text style={{ color: colors.subText, fontSize: fs(12), marginTop: 4 }}>{saved ? t('Based on this test’s saved averages', 'Batay sa naka-save na average ng test') : t('Based on the latest sensor reading', 'Batay sa pinakabagong datos ng sensor')}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 16 }}>
      <View accessible accessibilityLabel={`${t('Overall score', 'Kabuuang iskor')}: ${available ? `${result.overall}/100` : t('Unavailable', 'Walang datos')}`}>
        <AnimatedCircularProgress size={112} width={9} fill={result.overall ?? 0} tintColor={tint} backgroundColor={colors.progressTrack} rotation={0} lineCap="round" duration={300}>
          {() => <View style={{ alignItems: 'center' }}>
            <Text style={{ color: tint, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{result.overall ?? '—'}</Text>
            <Text style={{ color: colors.subText, fontSize: 11 }}>{available ? t('out of 100', 'mula sa 100') : t('No index yet', 'Wala pang index')}</Text>
          </View>}
        </AnimatedCircularProgress>
      </View>
      <View style={{ flex: 1, minWidth: 130, gap: 8 }}>
        <StatusBadge label={label} tone={!available ? 'neutral' : result.needsAttention ? 'warning' : 'healthy'} />
        <Text style={{ color: colors.subText, fontSize: fs(13) }}>{result.validCount}/{result.totalCount} {t('valid parameters', 'wastong parameter')}</Text>
        {!available && <Text style={{ color: colors.subText, fontSize: fs(12), lineHeight: fs(18) }}>{t('All six parameters are needed to calculate the overall score.', 'Kailangan ang anim na wastong parameter para makuha ang kabuuang iskor.')}</Text>}
        {!saved && stale && <Text style={{ color: colors.subText, fontSize: fs(12) }}>{t('Waiting for a fresh reading.', 'Naghihintay ng bagong datos.')}</Text>}
      </View>
    </View>
    <Text style={{ color: colors.subText, fontSize: fs(12), lineHeight: fs(18), marginTop: 12 }}>{ranges
      ? t(`Uses current ${soilType} reference ranges, like the dashboard.`, `Gamit ang kasalukuyang batayan ng ${soilType}, tulad ng dashboard.`)
      : t('Uses the same default reference ranges as the dashboard.', 'Gamit ang parehong karaniwang batayan ng dashboard.')}</Text>
    <Text style={{ color: colors.mutedText, fontSize: fs(11), lineHeight: fs(17), marginTop: 4 }}>{t('Provisional condition index, not a soil-health percentage.', 'Pansamantalang index ng kondisyon, hindi porsiyento ng kalusugan ng lupa.')}</Text>
    <Button secondary expanded={showDetails} icon={showDetails ? 'chevron-up-outline' : 'information-circle-outline'} label={showDetails ? t('Hide score details', 'Itago ang detalye ng iskor') : t('How is this scored?', 'Paano kinukuwenta ang iskor?')} onPress={() => setShowDetails(value => !value)} />
    {showDetails && <View style={{ gap: 10, marginTop: 14 }}>
      {result.factors.map(factor => <View key={factor.key} style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ flex: 1, color: colors.text, fontSize: fs(12) }}>{t(factor.label, factor.labelTl)}</Text>
          <Text style={{ color: colors.subText, fontSize: fs(12) }}>{factor.score === null ? '—' : `${Math.round(factor.score)}/100`}</Text>
        </View>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.progressTrack, overflow: 'hidden' }}><View style={{ height: 5, width: `${factor.score ?? 0}%`, backgroundColor: factor.status === 'optimal' ? colors.greenText : colors.warning }} /></View>
      </View>)}
      <Text style={{ color: colors.subText, fontSize: fs(12), lineHeight: fs(18) }}>{t(result.interpretation.en, result.interpretation.tl)}</Text>
    </View>}
  </View>;
}

const Button = ({ label, onPress, blocked = false, secondary = false, icon, expanded }: { label: string; onPress: () => void; blocked?: boolean; secondary?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name']; expanded?: boolean }) => {
  const colors = useThemeColors();
  const { fontScale } = useApp();
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: blocked, expanded }} disabled={blocked} onPress={onPress}
      activeOpacity={0.8} style={{ backgroundColor: secondary ? colors.cardBg : colors.primary, borderWidth: 1, borderColor: secondary ? colors.border : colors.primary, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', borderRadius: 14, padding: 14, marginTop: 10, opacity: blocked ? 0.5 : 1 }}>
      {icon && <Ionicons name={icon} size={20} color={secondary ? colors.greenText : '#FFFFFF'} />}
      <Text style={{ flexShrink: 1, color: secondary ? colors.text : '#fff', fontSize: 14 * fontScale, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </TouchableOpacity>
  );
};

function formatValue(value: string | number | null | undefined) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  return Number(value).toFixed(2);
}

function formatDuration(milliseconds: number) {
  const seconds = Number.isFinite(milliseconds) ? Math.max(0, Math.floor(milliseconds / 1000)) : 0;
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}
