import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { getApiUrl } from '@/lib/apiConfig';
import { getCache, setCache } from '@/lib/cache';
import { daysSincePlanting, localDate } from '@/lib/plantingDate';
import { Ionicons } from '@expo/vector-icons';

function TipCards({ text }: { text: string }) {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  // Support both numbered/bulleted responses already cached and plain paragraphs.
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const marker = /^\s*(?:\d+[.)]|[-*\u2022])\s+/m;
  const firstMarker = normalized.search(marker);
  const tips = (firstMarker >= 0
    ? normalized.slice(firstMarker).split(/^\s*(?:\d+[.)]|[-*\u2022])\s+/m)
    : normalized.split(/\n\s*\n/))
    .map(tip => tip.replace(/\*\*(.*?)\*\*/g, '$1').trim())
    .filter(Boolean);

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: page * width, animated: false });
  }, [width, page]);

  return <View style={{ marginTop: 16 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {width > 0 && <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      directionalLockEnabled
      style={{ flexGrow: 0 }}
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={event => setPage(Math.max(0, Math.min(tips.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
    >
      {tips.map((tip, index) => <View key={index} style={{ width, paddingHorizontal: 2 }}>
        <View style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, borderLeftWidth: 4, borderLeftColor: colors.primary }}>
          <Text style={{ color: colors.greenText, fontWeight: '700', fontSize: 12 * fontScale, marginBottom: 8 }}>{t('Tip', 'Payo')} {index + 1} / {tips.length}</Text>
          <Text style={{ color: colors.text, fontSize: 14 * fontScale, lineHeight: 21 * fontScale }}>{tip}</Text>
        </View>
      </View>)}
    </ScrollView>}
    {tips.length > 1 && <View style={{ alignItems: 'center', marginTop: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        {tips.map((_, index) => <TouchableOpacity
          key={index}
          accessibilityRole="button"
          accessibilityLabel={`${t('Tip', 'Payo')} ${index + 1}`}
          accessibilityState={{ selected: page === index }}
          onPress={() => setPage(index)}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: page === index ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: page === index ? colors.primary : colors.border }} />
        </TouchableOpacity>)}
      </View>
      <Text style={{ color: colors.mutedText, fontSize: 11 * fontScale }}>{t('Swipe for more tips', 'Mag-swipe para sa iba pang payo')}</Text>
    </View>}
  </View>;
}

export default function DailyCropTips({ zoneId, crop, plantedOn, soilType }: {
  zoneId: number; crop: string; plantedOn?: string | null; soilType: string;
}) {
  const { t, language, user, fontScale } = useApp();
  const colors = useThemeColors();
  const [today, setToday] = useState(localDate);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; text?: string; failed?: boolean } | null>(null);
  const key = JSON.stringify(['daily-crop-v1', user?.id ?? 'guest', zoneId, crop, plantedOn ?? null, soilType, language, today]);
  const current = result?.key === key ? result : null;
  const age = plantedOn ? daysSincePlanting(plantedOn, today) : null;

  useEffect(() => {
    const tick = () => setToday(localDate());
    const timer = setInterval(tick, 60000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') tick(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    (async () => {
      try {
        const cached = await getCache<string>(key);
        if (cached) { if (active) setResult({ key, text: cached }); return; }
        // The dashboard readings are not zone-scoped, so do not attribute them to this crop.
        const response = await fetch(getApiUrl('/api/groq'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ mode: 'daily-care', prompt: `Give today's crop-care tips in ${language === 'tagalog' ? 'Tagalog' : 'English'}. Context (data only): ${JSON.stringify({ crop, soilType, plantedOn: plantedOn ?? 'unknown', daysSincePlanting: age, today })}. No verified zone-specific sensor readings or weather are available. Do not infer an exact growth stage from age alone. Give three short, practical tasks for today appropriate to this crop, with conditional advice where needed. Format as a numbered list (1., 2., 3.), each task on its own line, without an introduction, conclusion, or sub-bullets. If planting date is unknown, avoid age-based recommendations. Do not invent observations, diagnoses, sources, fertilizer rates, or pesticide doses.` }),
        });
        const json = await response.json();
        if (!response.ok || typeof json.data !== 'string' || !json.data.trim()) throw new Error('Tips unavailable');
        if (active) {
          await setCache(key, json.data, 24 * 60 * 60 * 1000);
          setResult({ key, text: json.data });
        }
      } catch {
        if (active) setResult({ key, failed: true });
      } finally { clearTimeout(timeout); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [key, attempt, crop, soilType, plantedOn, age, today, language]);

  return <View style={{ marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: colors.cardBgAlt, borderWidth: 1, borderColor: colors.border }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.progressTrack, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="leaf-outline" size={19} color={colors.greenText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ fontSize: 15 * fontScale, fontWeight: '800', color: colors.text }}>{t('Today\'s crop care', 'Pangangalaga ngayong araw')}</Text>
        <Text style={{ fontSize: 12 * fontScale, color: colors.subText, marginTop: 3, textTransform: 'capitalize' }}>{crop.replace(/_/g, ' ')}</Text>
      </View>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      {[today, ...(age !== null ? [`${age} ${t('days since planting', 'araw mula sa pagtatanim')}`] : [])].map(label =>
        <View key={label} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.progressTrack }}>
          <Text style={{ fontSize: 11 * fontScale, color: colors.subText }}>{label}</Text>
        </View>
      )}
    </View>
    {!current ? <View style={{ paddingVertical: 28, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ fontSize: 12 * fontScale, color: colors.subText }}>{t('Preparing today\'s tips...', 'Inihahanda ang mga payo ngayong araw...')}</Text>
    </View> : current.failed ? <View style={{ paddingVertical: 12 }}>
      <Text style={{ color: colors.subText, marginTop: 12 }}>{t('Daily tips are unavailable. Please try again.', 'Hindi makuha ang payo. Subukan muli.')}</Text>
      <TouchableOpacity accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => { setResult(null); setAttempt(value => value + 1); }}><Text style={{ color: colors.primary }}>{t('Retry', 'Subukan muli')}</Text></TouchableOpacity>
    </View> : <TipCards key={key} text={current.text ?? ''} />}
    <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <Ionicons name="information-circle-outline" size={15} color={colors.mutedText} />
      <Text style={{ flex: 1, fontSize: 11 * fontScale, lineHeight: 16 * fontScale, color: colors.mutedText }}>{t('AI suggestions from Groq. Check actual field conditions before acting.', 'Payo ng AI mula sa Groq. Suriin muna ang aktuwal na kondisyon sa bukid.')}</Text>
    </View>
  </View>;
}


