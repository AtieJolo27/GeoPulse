import { getSoilTypeRanges } from '@/lib/soilTypeRanges';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { getApiUrl } from '@/lib/apiConfig';
import { SENSOR_REFERENCE_RANGES, parseSensorNumber } from '@/lib/soilHealthScore';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import FertilizerAdviceCard from './FertilizerAdviceCard';
import { FertilizerAdvice, parseFertilizerAdvice } from '@/lib/fertilizerAdvice';

export default function GroqFertilizerRecommendations({ zoneId, crop }: { zoneId: number; crop?: string | null }) {
  const { t, language, fontScale, zones } = useApp();
  const soilType = zones.find(zone => zone.id === zoneId)?.soil_type;
  const colors = useThemeColors();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ loading: boolean; advice?: FertilizerAdvice; error?: string; date?: string; nutrients?: { key: string; value: number }[] }>({ loading: true });
  const [newReading, setNewReading] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    setState({ loading: true });
    void (async () => {
      try {
        const { data: reading, error } = await supabase.from('sensor_readings').select('*').eq('zone_id', zoneId)
          .order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(1).abortSignal(controller.signal).maybeSingle();
        if (error) throw new Error(error.message);
        if (!reading) throw new Error(t('No sensor readings for this zone yet.', 'Wala pang datos ng sensor sa sonang ito.'));
        const nutrients = ['nitrogen', 'phosphorus', 'potassium'].map(key => {
          const value = parseSensorNumber(reading[key]);
          if (value === null || value < 0) throw new Error(`Missing or invalid ${key}. Refresh after a complete sensor reading.`);
          return { key, value };
        });
        const soilRanges = getSoilTypeRanges(soilType);
        const targets = Object.fromEntries(nutrients.map(({ key }) => [key, (soilRanges ?? SENSOR_REFERENCE_RANGES)[key as 'nitrogen' | 'phosphorus' | 'potassium']]));
        const optional = Object.fromEntries(['ph', 'soil_temperature', 'air_temperature', 'humidity', 'soil_moisture'].map(key => [key, parseSensorNumber(reading[key])]));
        const response = await fetch(getApiUrl('/api/groq'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ mode: 'fertilizer', format: 'cards', prompt: `Respond in ${language === 'tagalog' ? 'Tagalog' : 'English'}. Assess fertilizer options using this context: ${JSON.stringify({ soil_type: soilType, planted_crop: crop?.trim() || null, nutrients_ppm: Object.fromEntries(nutrients.map(item => [item.key, item.value])), provisional_reference_ranges: targets, other_readings: optional })}. Explain the nutrient gaps and cite the supplied references by number. Do not give an application dose.` }) });
        let json;
        try { json = await response.json(); } catch { throw new Error('The hosted Groq route did not return JSON. Deploy the updated Expo API route.'); }
        if (!response.ok || typeof json.data !== 'string' || !json.data.trim()) throw new Error(json.error || 'No fertilizer advice returned.');
        let advice: FertilizerAdvice;
        try { advice = parseFertilizerAdvice(json.data); }
        catch { throw new Error('Unable to load fertilizer cards. Deploy the updated Expo API route, then refresh.'); }
        if (active) setState({ loading: false, advice, date: reading.created_at, nutrients });
      } catch (error) {
        if (active) setState({ loading: false, error: controller.signal.aborted ? t('Request timed out. Please retry.', 'Nag-timeout. Subukan muli.') : error instanceof Error ? error.message : 'Unable to load fertilizer advice.' });
      } finally { clearTimeout(timeout); }
    })();
    const channel = supabase.channel(`groq-fertilizer-${zoneId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'sensor_readings', filter: `zone_id=eq.${zoneId}` }, () => { if (active) setNewReading(true); }).subscribe();
    return () => { active = false; controller.abort(); clearTimeout(timeout); void supabase.removeChannel(channel); };
  }, [zoneId, crop, soilType, language, attempt]);
  return <View style={{ gap: 16 }}>
    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 * fontScale }}>{crop ? `${t('Planted crop', 'Itinanim na pananim')}: ${crop.replace(/_/g, ' ')}` : t('No crop planted: soil nutrient targets', 'Walang pananim: batayang sustansiya ng lupa')}</Text>
    {newReading && <Text style={{ color: colors.subText }}>{t('New readings available. Refresh to update advice.', 'May bagong datos. I-refresh para i-update ang payo.')}</Text>}
    <TouchableOpacity accessibilityRole="button" disabled={state.loading} onPress={() => { setNewReading(false); setAttempt(value => value + 1); }} style={{ padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}><Text style={{ color: colors.greenText }}>{t('Refresh fertilizer advice', 'I-refresh ang payo sa pataba')}</Text></TouchableOpacity>
    {state.loading ? <ActivityIndicator color={colors.primary} /> : state.error ? <Text accessibilityRole="alert" style={{ color: colors.subText }}>{state.error}</Text> : <>
      <Text style={{ color: colors.subText }}>{t('Source reading', 'Pinagmulang datos')}: {state.date ? new Date(state.date).toLocaleString() : '--'}</Text>
      {state.nutrients?.map(item => <Text key={item.key} style={{ color: colors.text, textTransform: 'capitalize' }}>{item.key}: {item.value} ppm</Text>)}
      <Text style={{ color: colors.subText, fontSize: 14 * fontScale, lineHeight: 21 * fontScale }}>{state.advice?.assessment}</Text>
      {state.advice?.recommendations.map((item, index) => <FertilizerAdviceCard key={item.id} suggestion={item} rank={index + 1} />)}
      {state.advice?.recommendations.length === 0 && <View style={{ padding: 20, borderRadius: 20, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder }}><Text style={{ color: colors.text, fontWeight: '700' }}>{t('No fertilizer addition suggested', 'Walang mungkahing dagdag na pataba')}</Text></View>}
      <Text style={{ color: colors.subText, fontSize: 12 * fontScale }}>{t('AI advice from Groq. Reference ranges are provisional; confirm with a calibrated soil test and local DA staff before applying fertilizer.', 'Payo ng AI mula sa Groq. Pansamantala ang mga saklaw; kumpirmahin sa soil test at lokal na DA bago maglagay ng pataba.')}</Text>
    </>}
  </View>;
}
