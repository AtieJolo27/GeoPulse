import { classifyCropMoisture, type CropMoistureRange } from '@/lib/cropMoisture';
import { useCropMoisture } from '@/shared/appLib/useCropMoisture';
import CropWateringGuide from '@/components/CropWateringGuide';
import { parseSensorNumber } from '@/lib/soilHealthScore';
import { TutorialTarget } from '@/shared/appLib/TutorialContext';
import { RefreshButton } from '@/shared/components/ui/RefreshButton';
import { ScreenIntro } from '@/shared/components/ui/ScreenIntro';
import { SectionHeader } from '@/shared/components/ui/SectionHeader';
import { StateFeedback } from '@/shared/components/ui/StateFeedback';
import { StatusBadge, StatusTone } from '@/shared/components/ui/StatusBadge';
import { useApp } from '@/shared/appLib/AppContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { CACHE_KEYS, getCache, setCache } from '../../../../lib/cache';
import { supabase } from '../../../../lib/supabaseClient';

interface IrrigationRecommendation { id: number; moisture: number | null; created_at: string; }
const HISTORY_LIMIT = 10;
function getDecision(moisture: number | null, t: (en: string, tl: string) => string, range: CropMoistureRange | null): { title: string; message: string; tone: StatusTone; icon: React.ComponentProps<typeof Ionicons>['name']; color: string } {
  if (moisture === null) return { title: t('Reading unavailable', 'Walang reading'), message: t('Wait for a valid soil moisture reading.', 'Maghintay ng wastong datos ng halumigmig.'), tone: 'neutral', icon: 'cloud-offline-outline', color: '#64748B' };
  const status = classifyCropMoisture(moisture, range);
  if (status === 'low') return { title: t('Below crop range', 'Mas mababa sa kailangan'), message: t('Moisture is below the planted crop target for this soil type. Check field conditions and consider watering according to the crop guide.', 'Mas mababa sa target ng pananim at lupa ang moisture. Suriin ang bukid at isaalang-alang ang patubig ayon sa gabay.'), tone: 'warning', icon: 'water-outline', color: '#B7791F' };
  if (status === 'high') return { title: t('Above crop range', 'Lampas sa kailangan'), message: t('Moisture is above the planted crop target. Avoid adding water and check drainage and the crop guide.', 'Lampas sa target ng pananim ang moisture. Iwasang dagdagan ng tubig at suriin ang drainage at gabay.'), tone: 'warning', icon: 'rainy-outline', color: '#B7791F' };
  if (status === 'within') return { title: t('Within crop range', 'Nasa saklaw ng pananim'), message: t('The reading is within the dataset moisture range for this crop and soil type.', 'Nasa saklaw ng dataset para sa pananim at uri ng lupa ang datos.'), tone: 'healthy', icon: 'checkmark-circle-outline', color: '#28784A' };
  return { title: t('Crop range unavailable', 'Walang saklaw ng pananim'), message: t('Select the planted crop and soil type on Home. A matching dataset range is required to assess watering.', 'Piliin ang pananim at lupa sa Home. Kailangan ang katugmang saklaw ng dataset para sa pagsusuri.'), tone: 'neutral', icon: 'water-outline', color: '#64748B' };
}

export default function Irrigation() {
  const { t, fontScale, activeZoneId, zones } = useApp();
  const zone = zones.find(item => item.id === activeZoneId);
  const requirement = useCropMoisture(zone?.current_crop, zone?.soil_type);
  const generation = useRef(0);
  const cacheKey = `${CACHE_KEYS.IRRIGATION_RECOMMENDATIONS}:zone:${activeZoneId}:dataset-v1`;
  const colors = useThemeColors();
  const fs = (size: number) => Math.round(size * fontScale);
  const [recommendations, setRecommendations] = useState<IrrigationRecommendation[]>([]);
  const [loadedZoneId, setLoadedZoneId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchIrrigation = useCallback(async (skipCache = false) => {
    const request = ++generation.current;
    if (activeZoneId === null) { setRecommendations([]); setLoading(false); setRefreshing(false); return; }
    try {
      setError(null);
      if (!skipCache) {
        const cached = await getCache<IrrigationRecommendation[]>(cacheKey);
        if (request === generation.current && cached?.length) { setLoadedZoneId(activeZoneId); setRecommendations(cached); setLoading(false); }
      }
      const { data, error: fetchError } = await supabase.from('sensor_readings').select('id, soil_moisture, created_at').eq('zone_id', activeZoneId).order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(HISTORY_LIMIT);
      if (request !== generation.current) return;
      if (fetchError) throw fetchError;
      const built = (data ?? []).map(row => { const value = parseSensorNumber(row.soil_moisture); return { id: row.id, moisture: value !== null && value >= 0 && value <= 100 ? value : null, created_at: row.created_at }; });
      setLoadedZoneId(activeZoneId);
      setRecommendations(built);
      await setCache(cacheKey, built);
    } catch (caught) {
      if (request !== generation.current) return;
      setError(caught instanceof Error ? caught.message : 'Failed to load irrigation guidance.');
      const cached = await getCache<IrrigationRecommendation[]>(cacheKey);
      if (cached && request === generation.current) { setLoadedZoneId(activeZoneId); setRecommendations(cached); }
    } finally { if (request === generation.current) { setLoading(false); setRefreshing(false); } }
  }, [activeZoneId, cacheKey]);

  useEffect(() => {
    const initial = setTimeout(() => { void fetchIrrigation(); }, 0);
    const channel = supabase.channel('irrigation-sensor-readings').on('postgres_changes', { event: '*', schema: 'public', table: 'sensor_readings', filter: `zone_id=eq.${activeZoneId}` }, () => fetchIrrigation(true)).subscribe();
    return () => { generation.current++; clearTimeout(initial); void supabase.removeChannel(channel); };
  }, [fetchIrrigation, activeZoneId]);

  const currentReadings = loadedZoneId === activeZoneId ? recommendations : [];
  const latest = currentReadings[0];
  const decision = useMemo(() => getDecision(latest?.moisture ?? null, t, requirement.range), [latest?.moisture, t, requirement.range]);
  const onRefresh = () => { setRefreshing(true); fetchIrrigation(true); };

  if (loading && !latest) return <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.primary} /><Text className="mt-4" style={{ color: colors.subText }}>{t('Checking your field moisture...', 'Sinusuri ang halumigmig ng inyong bukid...')}</Text></View>;
  if (error && !latest) return <StateFeedback icon="cloud-offline-outline" title={t('We could not load irrigation data', 'Hindi ma-load ang irrigation data')} message={t('Check your connection and try again.', 'Suriin ang inyong koneksyon at subukan muli.')} action={<RefreshButton retry loading={loading || refreshing} onPress={() => { void fetchIrrigation(true); }} />} />;
  if (!latest) return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 110 }}><CropWateringGuide crop={zone?.current_crop} soilType={zone?.soil_type} {...requirement} /><StateFeedback icon="water-outline" title={t('No recent soil reading', 'Walang kamakailang soil reading')} message={t('Collect a soil reading to compare with the crop requirement.', 'Kumuha ng soil reading upang maihambing sa pangangailangan ng pananim.')} /></ScrollView>;

  return <ScrollView className="flex-1 px-5 pt-5" style={{ backgroundColor: colors.bg }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary, colors.primaryLight]} />} contentContainerStyle={{ paddingBottom: 110 }}>
    <ScreenIntro icon="water-outline" eyebrow={t('FIELD MOISTURE', 'HALUMIGMIG NG BUKID')} title={t('Does your field need water?', 'Kailangan ba ng tubig ang inyong bukid?')} description={t('Review soil moisture and irrigation guidance for your field.', 'Suriin ang halumigmig at gabay sa patubig para sa iyong bukid.')} />
    <CropWateringGuide crop={zone?.current_crop} soilType={zone?.soil_type} {...requirement} />
    <SectionHeader title={t('Current conditions', 'Kasalukuyang kondisyon')} action={<TutorialTarget id="moisture-refresh"><RefreshButton loading={refreshing} accessibilityLabel={t('Refresh irrigation data', 'I-refresh ang datos ng patubig')} onPress={onRefresh} /></TutorialTarget>} />
    <TutorialTarget id="moisture-summary">
    <View className="mt-5 rounded-3xl p-5" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderWidth: 1 }}>
      <View className="flex-row items-start justify-between"><StatusBadge label={decision.title} tone={decision.tone} /><Ionicons name={decision.icon} size={26} color={decision.color} /></View>
      <Text className="mt-5" style={{ fontSize: fs(42), lineHeight: fs(48), fontWeight: '800', color: decision.color }}>{latest.moisture === null ? '—' : `${latest.moisture.toFixed(1)}%`}</Text>
      <Text style={{ fontSize: fs(14), color: colors.subText }}>{t('Current soil moisture', 'Kasalukuyang halumigmig ng lupa')}</Text>
      <Text className="mt-5" style={{ fontSize: fs(20), fontWeight: '800', color: colors.text }}>{decision.title}</Text>
      <Text className="mt-1" style={{ fontSize: fs(14), lineHeight: fs(21), color: colors.subText }}>{decision.message}</Text>
    </View>
    </TutorialTarget>
    <View className="mt-6 rounded-2xl border" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}>
      <View className="flex-row items-center border-t p-4" style={{ borderColor: colors.border }}>
        <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: colors.cardBgAlt }}><Ionicons name="time-outline" size={19} color={colors.primaryDark} /></View>
        <View className="ml-3 flex-1"><Text style={{ fontSize: fs(12), color: colors.subText }}>{t('Last updated', 'Huling update')}</Text><Text className="mt-0.5" style={{ fontSize: fs(13), fontWeight: '700', color: colors.text }}>{new Date(latest.created_at).toLocaleString()}</Text></View>
      </View>
    </View>
    <View className="mt-7"><SectionHeader title={t('Recent moisture readings', 'Kamakailang moisture readings')} subtitle={t('Previous measurements for this zone', 'Mga nakaraang sukat sa sonang ito')} /></View>
    {currentReadings.slice(1).map((item) => { const itemDecision = getDecision(item.moisture, t, requirement.range); return <View key={item.id} className="mb-3 flex-row items-center rounded-2xl border p-4" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}><View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: colors.cardBgAlt }}><Ionicons name="water-outline" size={19} color={colors.primaryDark} /></View><View className="ml-3 flex-1"><Text style={{ fontSize: fs(14), fontWeight: '800', color: colors.text }}>{item.moisture === null ? '—' : `${item.moisture.toFixed(1)}%`}</Text><Text className="mt-0.5" style={{ fontSize: fs(12), color: colors.subText }}>{new Date(item.created_at).toLocaleString()}</Text></View><StatusBadge label={itemDecision.title} tone={itemDecision.tone} /></View>; })}
  </ScrollView>;
}
