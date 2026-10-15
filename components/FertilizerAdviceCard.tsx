import { useApp } from '@/app/lib/AppContext';
import { getFertilizerImage } from '@/app/lib/cropImages';
import { useThemeColors } from '@/app/lib/useThemeColors';
import type { FertilizerAdvice } from '@/lib/fertilizerAdvice';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import FertilizerEvidence from './FertilizerEvidence';

export default function FertilizerAdviceCard({ suggestion, rank }: { suggestion: FertilizerAdvice['recommendations'][number]; rank: number }) {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const featured = rank === 1;
  const fs = (size: number) => Math.round(size * fontScale);

  return <View style={{ padding: featured ? 20 : 16, borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${suggestion.name}, ${t('Review details', 'Suriin ang detalye')}`} activeOpacity={0.7} onPress={() => setExpanded(value => !value)}>
      {featured && <Text style={{ fontSize: fs(12), fontWeight: '700', color: colors.subText, marginBottom: 12 }}>{t('Top fertilizer suggestion', 'Nangungunang mungkahing pataba')}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Image source={getFertilizerImage(suggestion.name)} style={{ width: 48, height: 48, borderRadius: 24 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fs(featured ? 22 : 16), fontWeight: '800', color: colors.text }}>{suggestion.name}</Text>
          <Text style={{ marginTop: 6, fontSize: fs(12), color: colors.subText }}>Top {rank} · {suggestion.inDataset ? t('In dataset', 'Kasama sa dataset') : t('Cited alternative', 'Alternatibong may sanggunian')}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedText} />
      </View>
      <Text numberOfLines={expanded ? undefined : 2} style={{ marginTop: 14, fontSize: fs(13), lineHeight: fs(19), color: colors.subText }}>{suggestion.reason}</Text>
      <Text style={{ marginTop: 12, fontSize: fs(13), fontWeight: '700', color: colors.greenText }}>{expanded ? t('Hide details', 'Itago ang detalye') : t('Review details', 'Suriin ang detalye')}</Text>
    </TouchableOpacity>
    {(expanded || !suggestion.inDataset) && <FertilizerEvidence inDataset={suggestion.inDataset} sources={suggestion.sources} />}
  </View>;
}
