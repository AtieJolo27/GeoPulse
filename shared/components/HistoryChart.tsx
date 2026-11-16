import { RefreshButton } from '@/shared/components/ui/RefreshButton';
import { getSoilHistory, getSoilHistorySince, SoilHistoryRow } from '@/lib/getHistory';
import { computeSoilHealthScore, parseSensorNumber } from '@/lib/soilHealthScore';
import { getSoilTypeRanges } from '@/lib/soilTypeRanges';
import { useApp } from '@/shared/appLib/AppContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

type Point = { value: number | null; date: string; count?: number };
type Metric = { key: keyof SoilHistoryRow; label: string; labelTl: string; unit: string; color: string };
const METRICS: Metric[] = [
  { key: 'soil_moisture', label: 'Soil moisture', labelTl: 'Halumigmig ng lupa', unit: '%', color: '#2685B5' },
  { key: 'soil_temperature', label: 'Soil temperature', labelTl: 'Temperatura ng lupa', unit: '\u00B0C', color: '#C47732' },
  { key: 'ph', label: 'Soil pH', labelTl: 'Antas ng pH', unit: 'pH', color: '#9168C4' },
  { key: 'nitrogen', label: 'Nitrogen (N)', labelTl: 'Nitrogen (N)', unit: 'mg/kg', color: '#288663' },
  { key: 'phosphorus', label: 'Phosphorus (P)', labelTl: 'Posporus (P)', unit: 'mg/kg', color: '#B17830' },
  { key: 'potassium', label: 'Potassium (K)', labelTl: 'Potasyo (K)', unit: 'mg/kg', color: '#527EB8' },
  { key: 'air_temperature', label: 'Air temperature', labelTl: 'Temperatura ng hangin', unit: '\u00B0C', color: '#C47732' },
  { key: 'humidity', label: 'Air humidity', labelTl: 'Halumigmig ng hangin', unit: '%', color: '#2685B5' },
];

function HistoryParameter({ title, unit, color, points, note, daily = false }: {
  title: string; unit: string; color: string; points: Point[]; note?: string; daily?: boolean;
}) {
  const { t, fontScale, language } = useApp();
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const valid = points.filter((point): point is Point & { value: number } => point.value !== null);
  const latest = points[points.length - 1];
  const values = valid.map(point => point.value);
  const format = (value: number) => Number(value.toFixed(1)).toLocaleString(language === 'tagalog' ? 'fil-PH' : 'en-US');
  const date = (value: string) => new Date(value).toLocaleString(language === 'tagalog' ? 'fil-PH' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const point = selected !== null ? valid[selected] : undefined;
  const chartWidth = Math.max(width, valid.length * 46 + 64);
  return <View style={{ padding: 16, borderRadius: 20, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text accessibilityRole="header" style={{ flex: 1, fontSize: 16 * fontScale, fontWeight: '700', color: colors.text }}>{title}</Text>
      <Text style={{ color: colors.subText, fontSize: 12 * fontScale }}>{unit}</Text>
    </View>
    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 28 * fontScale, marginTop: 12 }}>{latest?.value != null ? format(latest.value) : t('Unavailable', 'Hindi makuha')}<Text style={{ fontWeight: '400', fontSize: 12 * fontScale, color: colors.subText }}> {daily ? t('latest daily average', 'pinakahuling average sa araw') : t('latest', 'pinakahuli')}</Text></Text>
    {values.length > 0 && <Text style={{ marginTop: 4, color: colors.subText, fontSize: 12 * fontScale }}>{t('Recorded range', 'Naitalang saklaw')}: {format(Math.min(...values))} - {format(Math.max(...values))} {unit}</Text>}
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ marginTop: 16 }}>
      {valid.length > 0 && width > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ flexGrow: 0 }}>
        <LineChart
          data={{ labels: valid.map((item, index) => index % Math.max(1, Math.ceil(valid.length / 5)) === 0 || index === valid.length - 1 ? daily ? new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''), datasets: [{ data: values }] }}
          width={chartWidth} height={190} segments={3} withShadow={false} withVerticalLines={false}
          onDataPointClick={({ index }) => setSelected(index)}
          chartConfig={{
            backgroundGradientFrom: colors.cardBg, backgroundGradientTo: colors.cardBg,
            decimalPlaces: unit === 'pH' ? 1 : 0, color: () => color, labelColor: () => colors.chartLabel,
            propsForDots: { r: '4', strokeWidth: '2', stroke: colors.cardBg },
            propsForBackgroundLines: { stroke: colors.chartGrid, strokeDasharray: '4 4' },
            propsForLabels: { fontSize: 10 },
          }}
          style={{ paddingRight: 48 }}
        />
      </ScrollView> : <Text style={{ paddingVertical: 16, color: colors.subText }}>{t('No valid readings for this parameter.', 'Walang wastong datos para sa parameter na ito.')}</Text>}
    </View>
    <View accessibilityLiveRegion="polite" style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.cardBgAlt }}>
      <Text style={{ color: colors.subText, fontSize: 12 * fontScale, lineHeight: 18 * fontScale }}>{point ? `${format(point.value)} ${unit} | ${daily ? new Date(point.date).toLocaleDateString() + ' | ' + point.count + ' ' + t('valid readings', 'wastong datos') : date(point.date)}` : t('Tap a dot for its value and date. Swipe the chart to explore.', 'I-tap ang tuldok para sa halaga at petsa. I-swipe para makita ang iba.')}</Text>
    </View>
    {points.length !== valid.length && <Text style={{ color: colors.mutedText, marginTop: 8, fontSize: 11 * fontScale }}>{points.length - valid.length} {t('missing or invalid readings omitted; lines connect available readings.', 'kulang o di-wastong datos ang inalis; pinagdurugtong ang natitirang datos.')}</Text>}
    {note && <Text style={{ color: colors.mutedText, marginTop: 10, fontSize: 12 * fontScale, lineHeight: 18 * fontScale }}>{note}</Text>}
  </View>;
}

export default function NutrientHistoryChart() {
  const { t, fontScale, activeZoneId, zones } = useApp();
  const colors = useThemeColors();
  const [history, setHistory] = useState<SoilHistoryRow[]>([]);
  const [dailyHistory, setDailyHistory] = useState<SoilHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 29);
    void Promise.all([getSoilHistory(30, activeZoneId, true), getSoilHistorySince(since.toISOString(), activeZoneId)]).then(([data, dailyData]) => {
      if (active) { setHistory(data); setDailyHistory(dailyData); }
    }).catch(error => {
      if (active) { setHistory([]); setError(error instanceof Error ? error.message : 'Unable to load history.'); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // The retry counter intentionally reruns the focused request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeZoneId, retry]));
  const ranges = getSoilTypeRanges(zones.find(zone => zone.id === activeZoneId)?.soil_type) ?? {};
  const days = new Map<string, { date: string; total: number; count: number }>();
  for (const row of dailyHistory) {
    const date = new Date(row.created_at);
    date.setHours(0, 0, 0, 0);
    const key = date.toISOString();
    const day = days.get(key) ?? { date: key, total: 0, count: 0 };
    const score = computeSoilHealthScore(row, ranges).overall;
    if (score !== null) { day.total += score; day.count++; }
    days.set(key, day);
  }
  const dailyPoints = Array.from(days.values()).map(day => ({ date: day.date, value: day.count ? day.total / day.count : null, count: day.count }));
  return <View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginVertical: 16 }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20 * fontScale, fontWeight: '800' }}>{t('Sensor history', 'Kasaysayan ng sensor')}</Text>
      <RefreshButton loading={loading} retry={!!error} onPress={() => setRetry(value => value + 1)} accessibilityLabel={t('Refresh history', 'I-refresh ang kasaysayan')} />
    </View>
    {loading ? <Text style={{ color: colors.subText }}>{t('Loading history...', 'Kinukuha ang kasaysayan...')}</Text>
      : error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>
      : !history.length ? <Text style={{ color: colors.subText }}>{t('No readings recorded for this zone yet.', 'Wala pang naitalang datos para sa sonang ito.')}</Text>
      : <>
        <Text style={{ color: colors.subText, fontSize: 12 * fontScale, lineHeight: 18 * fontScale, marginBottom: 16 }}>{t('Latest 30 readings, shown from oldest to newest. Each parameter has its own scale.', 'Pinakahuling 30 datos, mula pinakaluma hanggang pinakabago. May sariling sukatan ang bawat parameter.')} {new Date(history[0].created_at).toLocaleDateString()} - {new Date(history[history.length - 1].created_at).toLocaleDateString()}</Text>
        <HistoryParameter daily title={t('Daily soil condition', 'Kondisyon ng lupa bawat araw')} unit="/100" color={colors.primary}
          points={dailyPoints}
          note={t('Daily averages over the last 30 days (local dates), using complete valid readings only. Today is still in progress. Days without valid readings are omitted. Provisional average of six soil parameters. This is not a soil-health percentage; check the individual charts even when the index is high. Current soil-type reference bands are used for this history.', 'Pansamantalang average ng anim na parameter, para lamang sa kumpleto at wastong datos. Hindi ito porsiyento ng kalusugan ng lupa; suriin ang bawat chart kahit mataas ang index. Ginagamit ang kasalukuyang batayan ng uri ng lupa.')} />
        {METRICS.map(metric => <HistoryParameter key={metric.key} title={t(metric.label, metric.labelTl)} unit={metric.unit} color={metric.color}
          points={history.map(row => {
            const value = parseSensorNumber(row[metric.key]);
            const valid = value !== null && (metric.key !== 'ph' || value >= 0 && value <= 14) && (!['humidity', 'soil_moisture'].includes(metric.key) || value >= 0 && value <= 100) && (!['nitrogen', 'phosphorus', 'potassium'].includes(metric.key) || value >= 0);
            return { value: valid ? value : null, date: row.created_at };
          })} />)}
      </>}
  </View>;
}
