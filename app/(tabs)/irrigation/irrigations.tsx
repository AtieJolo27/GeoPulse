import { PrimaryButton } from '@/app/components/ui/PrimaryButton';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { StateFeedback } from '@/app/components/ui/StateFeedback';
import { StatusBadge, StatusTone } from '@/app/components/ui/StatusBadge';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { CACHE_KEYS, getCache, setCache } from '../../../lib/cache';
import { supabase } from '../../../lib/supabaseClient';

interface IrrigationRecommendation { id: number; moisture: number | null; recommendation: string; confidence: number; created_at: string; }
const HISTORY_LIMIT = 10;
const OPTIMAL_MOISTURE_MIN = 70;
const OPTIMAL_MOISTURE_MAX = 75;

function buildRecommendation(moisture: number | null, createdAt: string, id: number, t: (en: string, tl: string) => string): IrrigationRecommendation {
  if (moisture === null) return { id, moisture, confidence: 0, created_at: createdAt, recommendation: t('No moisture data available', 'Walang datos ng halumigmig') };
  if (moisture < OPTIMAL_MOISTURE_MIN) return { id, moisture, created_at: createdAt, confidence: Math.min(100, ((OPTIMAL_MOISTURE_MIN - moisture) / OPTIMAL_MOISTURE_MIN) * 100), recommendation: t('Watering is recommended', 'Inirerekomenda ang pagdidilig') };
  if (moisture > OPTIMAL_MOISTURE_MAX) return { id, moisture, created_at: createdAt, confidence: Math.min(100, ((moisture - OPTIMAL_MOISTURE_MAX) / (100 - OPTIMAL_MOISTURE_MAX)) * 100), recommendation: t('Avoid watering for now', 'Iwasan muna ang pagdidilig') };
  return { id, moisture, created_at: createdAt, confidence: 90, recommendation: t('No watering needed', 'Hindi kailangan ng pagdidilig') };
}

function getDecision(moisture: number | null, t: (en: string, tl: string) => string): { title: string; message: string; tone: StatusTone; icon: React.ComponentProps<typeof Ionicons>['name']; color: string } {
  if (moisture === null) return { title: t('Reading unavailable', 'Walang reading'), message: t('Wait for a new soil moisture reading.', 'Maghintay ng bagong soil moisture reading.'), tone: 'neutral', icon: 'cloud-offline-outline', color: '#64748B' };
  if (moisture < OPTIMAL_MOISTURE_MIN) return { title: t('Water needed', 'Kailangan ng pagdidilig'), message: t('Soil moisture is below the recommended range.', 'Mas mababa ang halumigmig ng lupa sa inirerekomendang antas.'), tone: 'warning', icon: 'water-outline', color: '#B7791F' };
  if (moisture > OPTIMAL_MOISTURE_MAX) return { title: t('No watering yet', 'Huwag munang magdilig'), message: t('The soil is already wet. Let it drain first.', 'Basa na ang lupa. Hayaan muna itong matuyo.'), tone: 'warning', icon: 'rainy-outline', color: '#B7791F' };
  return { title: t('No watering needed', 'Hindi kailangan ng pagdidilig'), message: t('Your field has enough soil moisture right now.', 'Sapat ang halumigmig ng inyong bukid ngayon.'), tone: 'healthy', icon: 'checkmark-circle-outline', color: '#28784A' };
}

export default function Irrigation() {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const fs = (size: number) => Math.round(size * fontScale);
  const [recommendations, setRecommendations] = useState<IrrigationRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchIrrigation = useCallback(async (skipCache = false) => {
    try {
      setError(null);
      if (!skipCache) {
        const cached = await getCache<IrrigationRecommendation[]>(CACHE_KEYS.IRRIGATION_RECOMMENDATIONS);
        if (cached?.length) { setRecommendations(cached); setLoading(false); }
      }
      const { data, error: fetchError } = await supabase.from('sensor_readings').select('id, soil_moisture, created_at').order('created_at', { ascending: false }).limit(HISTORY_LIMIT);
      if (fetchError) throw fetchError;
      const built = (data ?? []).map((row) => buildRecommendation(row.soil_moisture ?? null, row.created_at, row.id, t));
      setRecommendations(built);
      if (built.length) await setCache(CACHE_KEYS.IRRIGATION_RECOMMENDATIONS, built);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load irrigation guidance.');
      const cached = await getCache<IrrigationRecommendation[]>(CACHE_KEYS.IRRIGATION_RECOMMENDATIONS);
      if (cached) setRecommendations(cached);
    } finally { setLoading(false); setRefreshing(false); }
  }, [t]);

  useEffect(() => {
    fetchIrrigation();
    const channel = supabase.channel('irrigation-sensor-readings').on('postgres_changes', { event: '*', schema: 'public', table: 'sensor_readings' }, () => fetchIrrigation(true)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchIrrigation]);

  const latest = recommendations[0];
  const decision = useMemo(() => getDecision(latest?.moisture ?? null, t), [latest?.moisture, t]);
  const onRefresh = () => { setRefreshing(true); fetchIrrigation(true); };

  if (loading && !latest) return <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.primary} /><Text className="mt-4" style={{ color: colors.subText }}>{t('Checking your field moisture...', 'Sinusuri ang halumigmig ng inyong bukid...')}</Text></View>;
  if (error && !latest) return <StateFeedback icon="cloud-offline-outline" title={t('We could not load irrigation data', 'Hindi ma-load ang irrigation data')} message={t('Check your connection and try again.', 'Suriin ang inyong koneksyon at subukan muli.')} action={<PrimaryButton label={t('Try again', 'Subukan muli')} onPress={() => fetchIrrigation(true)} icon="refresh" />} />;
  if (!latest) return <StateFeedback icon="water-outline" title={t('No recent soil reading', 'Walang kamakailang soil reading')} message={t('Collect a soil reading to receive irrigation guidance.', 'Kumuha ng soil reading para makatanggap ng gabay sa patubig.')} />;

  return <ScrollView className="flex-1 px-5 pt-5" style={{ backgroundColor: colors.bg }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />} contentContainerStyle={{ paddingBottom: 110 }}>
    <Text style={{ fontSize: fs(14), color: colors.subText }}>{t('Irrigation guide', 'Gabay sa patubig')}</Text>
    <Text className="mt-1" style={{ fontSize: fs(25), fontWeight: '800', color: colors.text }}>{t('Does your field need water?', 'Kailangan ba ng tubig ang inyong bukid?')}</Text>
    <View className="mt-5 rounded-3xl p-5" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderWidth: 1 }}>
      <View className="flex-row items-start justify-between"><StatusBadge label={decision.title} tone={decision.tone} /><Ionicons name={decision.icon} size={26} color={decision.color} /></View>
      <Text className="mt-5" style={{ fontSize: fs(42), lineHeight: fs(48), fontWeight: '800', color: decision.color }}>{latest.moisture === null ? '—' : `${latest.moisture.toFixed(1)}%`}</Text>
      <Text style={{ fontSize: fs(14), color: colors.subText }}>{t('Current soil moisture', 'Kasalukuyang halumigmig ng lupa')}</Text>
      <Text className="mt-5" style={{ fontSize: fs(20), fontWeight: '800', color: colors.text }}>{decision.title}</Text>
      <Text className="mt-1" style={{ fontSize: fs(14), lineHeight: fs(21), color: colors.subText }}>{decision.message}</Text>
    </View>
    <View className="mt-6 rounded-2xl border" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}>
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center"><View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: colors.cardBgAlt }}><Ionicons name="shield-checkmark-outline" size={19} color={colors.primaryDark} /></View><View className="ml-3"><Text style={{ fontSize: fs(12), color: colors.subText }}>{t('Confidence', 'Katiyakan')}</Text><Text style={{ fontSize: fs(21), fontWeight: '800', color: colors.text }}>{Math.round(latest.confidence)}%</Text></View></View>
        <StatusBadge label={decision.tone === 'healthy' ? t('Good level', 'Magandang antas') : t('Check field', 'Suriin ang bukid')} tone={decision.tone} />
      </View>
      <View className="flex-row items-center border-t p-4" style={{ borderColor: colors.border }}>
        <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: colors.cardBgAlt }}><Ionicons name="time-outline" size={19} color={colors.primaryDark} /></View>
        <View className="ml-3 flex-1"><Text style={{ fontSize: fs(12), color: colors.subText }}>{t('Last updated', 'Huling update')}</Text><Text className="mt-0.5" style={{ fontSize: fs(13), fontWeight: '700', color: colors.text }}>{new Date(latest.created_at).toLocaleString()}</Text></View>
      </View>
    </View>
    <View className="mt-7"><SectionHeader title={t('Recent moisture readings', 'Kamakailang moisture readings')} subtitle={t('Previous irrigation guidance', 'Mga nakaraang gabay sa patubig')} /></View>
    {recommendations.slice(1).map((item) => { const itemDecision = getDecision(item.moisture, t); return <View key={item.id} className="mb-3 flex-row items-center rounded-2xl border p-4" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}><View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: colors.cardBgAlt }}><Ionicons name="water-outline" size={19} color={colors.primaryDark} /></View><View className="ml-3 flex-1"><Text style={{ fontSize: fs(14), fontWeight: '800', color: colors.text }}>{item.moisture === null ? '—' : `${item.moisture.toFixed(1)}%`}</Text><Text className="mt-0.5" style={{ fontSize: fs(12), color: colors.subText }}>{new Date(item.created_at).toLocaleString()}</Text></View><StatusBadge label={itemDecision.title} tone={itemDecision.tone} /></View>; })}
  </ScrollView>;
}
