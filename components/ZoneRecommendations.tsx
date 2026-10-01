import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { supabase } from '@/lib/supabaseClient';
import { loadZoneRecommendations } from '@/lib/zoneRecommendations';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import RecommendationCard from './RecommendationCard';
import { Ionicons } from '@expo/vector-icons';

type Result = {
  zone_id: number;
  reading: { id: number | string; created_at: string } | null;
  crop: { recommendations: { crop: string; confidence: number }[] } | null;
  fertilizer: { recommendations: { fertilizer: string; confidence: number }[] } | null;
  fertilizer_error?: string;
  fertilizer_crop?: string;
  fertilizer_crop_source?: string;
};

export default function ZoneRecommendations({ kind }: { kind: 'crop' | 'fertilizer' }) {
  const { zones, activeZoneId, t, fontScale } = useApp();
  const colors = useThemeColors();
  const zone = zones.find(item => item.id === activeZoneId);
  // Remount on zone/crop changes so previous results cannot appear under a new zone.
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
    <Text style={{ fontSize: 24 * fontScale, fontWeight: '800', color: colors.text }}>{kind === 'crop' ? t('Crop options to evaluate', 'Mga pananim na maaaring suriin') : t('Fertilizer options to review', 'Mga patabang maaaring suriin')}</Text>
    {zone && <Text style={{ marginTop: 8, marginBottom: 16, fontSize: 14 * fontScale, color: colors.subText }}>{t(zone.name_en, zone.name_tl)}</Text>}
    {zone ? <ZoneResults key={`${zone.id}:${zone.current_crop}`} zoneId={zone.id} kind={kind} /> : <Text style={{ marginTop: 16, color: colors.subText }}>{t('Select a zone on the dashboard to see recommendations.', 'Pumili ng sona sa dashboard para makita ang mga mungkahi.')}</Text>}
  </ScrollView>;
}

function ZoneResults({ zoneId, kind }: { zoneId: number; kind: 'crop' | 'fertilizer' }) {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const [attempt, setAttempt] = useState(0);
  const [newReadingAvailable, setNewReadingAvailable] = useState(false);
  const [state, setState] = useState<{ result?: Result; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    let request = 0;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || !active) return;
      inFlight = true;
      const current = ++request;
      controller?.abort();
      controller = new AbortController();
      const requestController = controller;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('Recommendations took too long to load. Tap Refresh recommendations to retry.'));
          requestController.abort();
        }, 30000);
      });
      setState({ loading: true });
      try {
        const base = process.env.EXPO_PUBLIC_API_URL ?? 'https://capstone-eem0.onrender.com';
        const json = await Promise.race([loadZoneRecommendations(base, zoneId, requestController.signal), deadline]);
        if (json.zone_id !== zoneId) throw new Error('The returned result does not match this zone.');
        if (active && current === request) setState({ loading: false, result: json });
      } catch (error) {
        if (active && current === request) setState({ loading: false, error: error instanceof Error ? error.message : 'Unable to load recommendations.' });
      } finally { clearTimeout(timeout); inFlight = false; }
    };
    void refresh();
    const channel = supabase.channel(`zone-recommendations-${zoneId}-${kind}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sensor_readings', filter: `zone_id=eq.${zoneId}` }, () => {
        // /predict may itself insert readings. Automatically predicting again
        // here can create an endless read -> predict -> insert loop.
        if (active) setNewReadingAvailable(true);
      })
      .subscribe();
    return () => { active = false; controller?.abort(); void supabase.removeChannel(channel); };
  }, [zoneId, kind, attempt]);
  const result = state.result;
  const rows = kind === 'crop'
    ? result?.crop?.recommendations.map(row => ({ name: row.crop, score: row.confidence })) ?? []
    : result?.fertilizer?.recommendations.map(row => ({ name: row.fertilizer, score: row.confidence })) ?? [];
  const ranked = rows.filter(row => typeof row.name === 'string' && Number.isFinite(row.score) && row.score > 0 && row.score <= 100).sort((a, b) => b.score - a.score);
  return <View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
      <Text accessibilityRole="header" style={{ flexShrink: 1, fontSize: 16 * fontScale, fontWeight: '700', color: colors.text }}>{t('Suggestions', 'Mga mungkahi')}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('Refresh recommendations', 'I-refresh ang mga mungkahi')}
        accessibilityState={{ disabled: state.loading, busy: state.loading }}
        activeOpacity={0.7}
        disabled={state.loading}
        onPress={() => { setNewReadingAvailable(false); setAttempt(value => value + 1); }}
        style={{ minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: state.loading ? 0.7 : 1 }}
      >
        {state.loading ? <ActivityIndicator size="small" color={colors.greenText} /> : <Ionicons name="refresh-outline" size={18} color={colors.greenText} />}
        <Text style={{ color: colors.greenText, fontWeight: '700', fontSize: 13 * fontScale }}>{state.loading ? t('Loading...', 'Naglo-load...') : state.error ? t('Retry', 'Subukan muli') : t('Refresh', 'I-refresh')}</Text>
      </TouchableOpacity>
    </View>
    {newReadingAvailable && !state.loading && <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, marginBottom: 16, borderRadius: 12, backgroundColor: colors.progressTrack }}>
      <Ionicons name="information-circle-outline" size={18} color={colors.greenText} />
      <Text style={{ flex: 1, color: colors.subText, fontSize: 12 * fontScale, lineHeight: 18 * fontScale }}>{t('New readings available. Tap Refresh to update suggestions.', 'May bagong datos. Pindutin ang I-refresh para i-update ang mga mungkahi.')}</Text>
    </View>}
    {state.loading || state.error || !result?.reading ? <View style={{ padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg, alignItems: 'center', gap: 10 }}>
      <Ionicons name={state.loading ? 'hourglass-outline' : state.error ? 'cloud-offline-outline' : 'leaf-outline'} size={28} color={colors.mutedText} />
      <Text accessibilityRole={state.error ? 'alert' : 'text'} style={{ color: colors.subText, fontSize: 13 * fontScale, lineHeight: 20 * fontScale, textAlign: 'center' }}>{state.loading ? t('Preparing suggestions from this zone\'s latest readings...', 'Inihahanda ang mga mungkahi mula sa pinakahuling datos ng sonang ito...') : state.error ?? t('No sensor readings are linked to this zone yet.', 'Wala pang datos ng sensor na nakaugnay sa sonang ito.')}</Text>
    </View> : <>
      <Text style={{ color: colors.subText, fontSize: 13 * fontScale, marginBottom: 12 }}>{t('Based on this zone\'s latest recorded reading', 'Batay sa pinakahuling datos ng sonang ito')}: {new Date(result.reading.created_at).toLocaleString()}</Text>
      <Text style={{ color: colors.subText, fontSize: 13 * fontScale, marginBottom: 16 }}>{t('Model scores rank options; they are not verified suitability ratings or chances of success.', 'Iniraranggo ng iskor ang mga opsyon; hindi ito napatunayang kaangkupan o tsansa ng tagumpay.')}</Text>
      {kind === 'fertilizer' && <Text style={{ color: colors.subText, marginBottom: 16 }}>{result.fertilizer_crop_source === 'planted' ? t('Planted crop', 'Itinanim na pananim') : result.fertilizer_crop_source === 'legacy-predicted' ? t('This server evaluates fertilizer for the model-predicted crop, which may differ from your planted crop', 'Sinusuri ng server ang pataba para sa hinulaang pananim, na maaaring iba sa itinanim mo') : t('No planted crop recorded. Using model-predicted crop', 'Walang naitalang pananim. Gamit ang hinulaang pananim')}: {result.fertilizer_crop?.replace(/_/g, ' ')}</Text>}
      {ranked.map((row, index) => <RecommendationCard key={row.name} name={row.name} score={row.score} kind={kind} featured={index === 0} fontScale={fontScale} zoneId={zoneId} readingId={result.reading!.id} />)}
      {!ranked.length && <Text style={{ color: colors.subText }}>{result.fertilizer_error ?? t('No valid model suggestions available.', 'Walang wastong mungkahi ang modelo.')}</Text>}
    </>}
  </View>;
}
